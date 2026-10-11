import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { SQSClient } from "@aws-sdk/client-sqs";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { AwsCalls } from "../../adapters/sites/AwsCalls.js";
import { DynamoAreaScoreSeeder } from "../../adapters/sites/DynamoAreaScoreSeeder.js";
import { DynamoCleanupRepository } from "../../adapters/sites/DynamoCleanupRepository.js";
import { DynamoLetterCounter } from "../../adapters/letters/DynamoLetterCounter.js";
import { DynamoReportStatusWriter } from "../../adapters/sites/DynamoReportStatusWriter.js";
import { DynamoReportWithdrawer } from "../../adapters/sites/DynamoReportWithdrawer.js";
import { DynamoSiteReportReader } from "../../adapters/sites/DynamoSiteReportReader.js";
import { DynamoSiteRepository } from "../../adapters/sites/DynamoSiteRepository.js";
import { DynamoVoteRepository } from "../../adapters/sites/DynamoVoteRepository.js";
import { NgeohashCells } from "../../adapters/sites/NgeohashCells.js";
import { S3EmbeddingStore } from "../../adapters/sites/S3EmbeddingStore.js";
import { SiteItemMapper } from "../../adapters/sites/SiteItemMapper.js";
import { SqsCleanupQueue } from "../../adapters/sites/SqsCleanupQueue.js";
import { SystemClock } from "../../adapters/sites/SystemClock.js";
import { MergeableReportFactory } from "../../domain/sites/MergeableReportFactory.js";
import { PublicMedia } from "../../domain/sites/PublicMedia.js";
import type { Logger } from "../../ports/Logger.js";
import type { PhotoFlagServiceDeps } from "../../services/flags/PhotoFlagService.js";
import { CleanupIntake } from "../../services/sites/CleanupIntake.js";
import { LetterRateLimiter } from "../../services/letters/LetterRateLimiter.js";
import { CleanupService } from "../../services/sites/CleanupService.js";
import { ConflictRetry } from "../../services/sites/ConflictRetry.js";
import { MergeTargetPicker } from "../../services/sites/MergeTargetPicker.js";
import { SiteFinder } from "../../services/sites/SiteFinder.js";
import { SiteMerger } from "../../services/sites/SiteMerger.js";
import { VoteService } from "../../services/sites/VoteService.js";
import { WithdrawalService } from "../../services/sites/WithdrawalService.js";
import type { CoreSettings } from "../../settings/CoreSettings.js";
import { PagingSettings } from "../../settings/PagingSettings.js";
import { QueueSettings } from "../../settings/QueueSettings.js";
import { RateLimitSettings } from "../../settings/RateLimitSettings.js";
import { RetrySettings } from "../../settings/RetrySettings.js";
import { ScoreSettings } from "../../settings/ScoreSettings.js";
import { SiteRuleSettings } from "../../settings/SiteRuleSettings.js";
import { SitesSettings } from "../../settings/SitesSettings.js";
import type { Env } from "../../settings/utils.js";
import { TimeoutSettings } from "../../settings/TimeoutSettings.js";
import { awsClientConfig } from "../utils.js";

export type FlagSiteParts = Pick<PhotoFlagServiceDeps, "sites" | "rows" | "clock" | "retry" | "radiusM">;

// The tunable numbers the site services take, each read once from its variable.
export interface SiteTunables {
  readonly limits: RateLimitSettings;
  readonly rules: SiteRuleSettings;
  readonly scores: ScoreSettings;
  readonly queue: QueueSettings;
  readonly retry: RetrySettings;
  readonly paging: PagingSettings;
}

export interface SiteClients {
  readonly dynamo: DynamoDBDocumentClient;
  readonly s3: S3Client;
  readonly sqs: SQSClient;
}

// Builds the site services: the api uses finder, votes and cleanup intake; the worker merger and cleanups.
export class SiteServiceFactory {
  readonly #settings: SitesSettings;
  readonly #clients: SiteClients;
  readonly #mapper: SiteItemMapper;
  readonly #clock = new SystemClock();
  readonly #cells = new NgeohashCells();
  readonly #calls = new AwsCalls();
  readonly #retry: ConflictRetry;
  readonly #logger: Logger;
  readonly #tunables: SiteTunables;

  constructor(settings: SitesSettings, clients: SiteClients, logger: Logger, tunables = SiteServiceFactory.tunables({})) {
    this.#settings = settings;
    this.#clients = clients;
    this.#logger = logger;
    this.#tunables = tunables;
    this.#retry = new ConflictRetry(tunables.retry.saveAttempts);
    this.#mapper = new SiteItemMapper(this.#cells, logger, tunables.rules);
  }

  static tunables(env: Env): SiteTunables {
    return {
      limits: RateLimitSettings.fromEnv(env),
      rules: SiteRuleSettings.fromEnv(env),
      scores: ScoreSettings.fromEnv(env),
      queue: QueueSettings.fromEnv(env),
      retry: RetrySettings.fromEnv(env),
      paging: PagingSettings.fromEnv(env),
    };
  }

  static fromEnv(core: CoreSettings, env: Env, logger: Logger): SiteServiceFactory {
    const region = core.awsRegion;
    const aws = TimeoutSettings.fromEnv(env).aws;
    const marshallOptions = { removeUndefinedValues: true };
    const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient(awsClientConfig(region, aws.quick)), { marshallOptions });
    const s3 = new S3Client(awsClientConfig(region, aws.transfer));
    const clients = { dynamo, s3, sqs: new SQSClient(awsClientConfig(region, aws.quick)) };
    return new SiteServiceFactory(SitesSettings.fromEnv(env), clients, logger, SiteServiceFactory.tunables(env));
  }

  // The worker reads site positions and kinds for cleanup moderation and recording.
  repository(): DynamoSiteRepository {
    return this.#sites();
  }

  finder(): SiteFinder {
    return new SiteFinder(this.#sites(), this.#cells, this.#clock, this.#tunables.paging.mapMaxSites);
  }

  voteService(): VoteService {
    return new VoteService({
      sites: this.#sites(),
      votes: this.#votes(),
      reports: this.#reports(),
      clock: this.#clock,
      retry: this.#retry,
    });
  }

  cleanupIntake(): CleanupIntake {
    const queue = new SqsCleanupQueue(this.#clients.sqs, this.#settings.reportsQueueUrl, this.#calls);
    const deps = { sites: this.#sites(), cleanups: this.#cleanups(), queue, clock: this.#clock, retry: this.#retry };
    return new CleanupIntake(deps);
  }

  merger(): SiteMerger {
    const { dynamo, s3 } = this.#clients;
    const embeddings = new S3EmbeddingStore(s3, this.#settings.originalsBucket, this.#calls);
    const { rules, scores, queue } = this.#tunables;
    return new SiteMerger({
      sites: this.#sites(),
      votes: this.#votes(),
      cells: this.#cells,
      picker: new MergeTargetPicker(embeddings, rules.mergeMinCosine),
      reports: this.#reports(),
      scores: new DynamoAreaScoreSeeder(dynamo, this.#settings.tables.scores, this.#calls),
      clock: this.#clock,
      reportFactory: new MergeableReportFactory(this.#media()),
      retry: new ConflictRetry(queue.mergeAttempts),
      rules,
      minVerifiedReports: scores.minVerifiedReports,
    });
  }

  withdrawalService(): WithdrawalService {
    const { dynamo } = this.#clients;
    const { tables } = this.#settings;
    const counter = (name: string, keyName: string) => new DynamoLetterCounter(dynamo, { name, keyName, prefix: "withdraw" }, this.#tunables.retry.counter);
    const counters = { devices: counter(tables.devices, "device_token"), users: counter(tables.users, "user_id") };
    return new WithdrawalService({
      sites: this.#sites(),
      rows: new DynamoSiteReportReader(dynamo, tables.reports, this.#media(), this.#calls),
      withdrawer: new DynamoReportWithdrawer(dynamo, tables.reports, this.#calls),
      reports: this.#reports(),
      limiter: new LetterRateLimiter(counters, this.#logger, this.#tunables.limits.withdrawalsPerHour, "withdrawals"),
      clock: this.#clock,
      retry: this.#retry,
    });
  }

  // Photo reports (decision 20261011-0310-hem-photo-flags) read and save sites like votes do.
  flagSiteParts(): FlagSiteParts {
    const rows = new DynamoSiteReportReader(this.#clients.dynamo, this.#settings.tables.reports, this.#media(), this.#calls);
    return { sites: this.#sites(), rows, clock: this.#clock, retry: this.#retry, radiusM: this.#tunables.rules.flags.radiusM };
  }

  cleanupService(): CleanupService {
    const deps = { sites: this.#sites(), cleanups: this.#cleanups(), votes: this.#votes(), media: this.#media(), retry: this.#retry };
    return new CleanupService(deps);
  }

  #votes(): DynamoVoteRepository {
    return new DynamoVoteRepository(this.#clients.dynamo, this.#settings.tables.votes, this.#calls);
  }

  #sites(): DynamoSiteRepository {
    return new DynamoSiteRepository(this.#clients.dynamo, this.#settings.tables.sites, this.#mapper, this.#calls);
  }

  #cleanups(): DynamoCleanupRepository {
    return new DynamoCleanupRepository(this.#clients.dynamo, this.#settings.tables.cleanups, this.#calls);
  }

  #reports(): DynamoReportStatusWriter {
    return new DynamoReportStatusWriter(this.#clients.dynamo, this.#settings.tables.reports, this.#clock, this.#calls);
  }

  #media(): PublicMedia {
    return new PublicMedia(this.#settings.publicBaseUrl);
  }
}
