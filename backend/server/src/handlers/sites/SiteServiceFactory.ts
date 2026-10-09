import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { SQSClient } from "@aws-sdk/client-sqs";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoAreaScoreSeeder } from "../../adapters/sites/DynamoAreaScoreSeeder.js";
import { DynamoCleanupRepository } from "../../adapters/sites/DynamoCleanupRepository.js";
import { DynamoDeviceReputation } from "../../adapters/sites/DynamoDeviceReputation.js";
import { DynamoReportStatusWriter } from "../../adapters/sites/DynamoReportStatusWriter.js";
import { DynamoSiteRepository } from "../../adapters/sites/DynamoSiteRepository.js";
import { DynamoVoteRepository } from "../../adapters/sites/DynamoVoteRepository.js";
import { NgeohashCells } from "../../adapters/sites/NgeohashCells.js";
import { S3EmbeddingStore } from "../../adapters/sites/S3EmbeddingStore.js";
import { SiteItemMapper } from "../../adapters/sites/SiteItemMapper.js";
import { SqsCleanupQueue } from "../../adapters/sites/SqsCleanupQueue.js";
import { SystemClock } from "../../adapters/sites/SystemClock.js";
import { MergeableReportFactory } from "../../domain/sites/MergeableReportFactory.js";
import { PublicMedia } from "../../domain/sites/PublicMedia.js";
import { CleanupIntake } from "../../services/sites/CleanupIntake.js";
import { CleanupService } from "../../services/sites/CleanupService.js";
import { MergeTargetPicker } from "../../services/sites/MergeTargetPicker.js";
import { SiteFinder } from "../../services/sites/SiteFinder.js";
import { SiteMerger } from "../../services/sites/SiteMerger.js";
import { VoteService } from "../../services/sites/VoteService.js";
import type { CoreSettings } from "../../settings/CoreSettings.js";
import { SitesSettings } from "../../settings/SitesSettings.js";
import type { Env } from "../../settings/utils.js";

export interface SiteClients {
  readonly dynamo: DynamoDBDocumentClient;
  readonly s3: S3Client;
  readonly sqs: SQSClient;
}

// Builds the site services: the api uses finder, votes and cleanup intake; the worker merger and cleanups.
export class SiteServiceFactory {
  readonly #settings: SitesSettings;
  readonly #clients: SiteClients;
  readonly #clock = new SystemClock();
  readonly #cells = new NgeohashCells();

  constructor(settings: SitesSettings, clients: SiteClients) {
    this.#settings = settings;
    this.#clients = clients;
  }

  static fromEnv(core: CoreSettings, env: Env): SiteServiceFactory {
    const region = core.awsRegion;
    const marshallOptions = { removeUndefinedValues: true };
    const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), { marshallOptions });
    const clients = { dynamo, s3: new S3Client({ region }), sqs: new SQSClient({ region }) };
    return new SiteServiceFactory(SitesSettings.fromEnv(env), clients);
  }

  finder(): SiteFinder {
    return new SiteFinder(this.#sites(), this.#cells);
  }

  voteService(): VoteService {
    const { dynamo } = this.#clients;
    const { tables } = this.#settings;
    const votes = new DynamoVoteRepository(dynamo, tables.votes);
    const devices = new DynamoDeviceReputation(dynamo, tables.devices);
    return new VoteService({ sites: this.#sites(), votes, devices, reports: this.#reports(), clock: this.#clock });
  }

  cleanupIntake(): CleanupIntake {
    const queue = new SqsCleanupQueue(this.#clients.sqs, this.#settings.reportsQueueUrl);
    return new CleanupIntake({ sites: this.#sites(), cleanups: this.#cleanups(), queue, clock: this.#clock });
  }

  merger(): SiteMerger {
    const { dynamo, s3 } = this.#clients;
    return new SiteMerger({
      sites: this.#sites(),
      cells: this.#cells,
      picker: new MergeTargetPicker(new S3EmbeddingStore(s3, this.#settings.originalsBucket)),
      reports: this.#reports(),
      scores: new DynamoAreaScoreSeeder(dynamo, this.#settings.tables.scores),
      clock: this.#clock,
      reportFactory: new MergeableReportFactory(this.#media()),
    });
  }

  cleanupService(): CleanupService {
    return new CleanupService({ sites: this.#sites(), cleanups: this.#cleanups(), media: this.#media() });
  }

  #sites(): DynamoSiteRepository {
    const mapper = new SiteItemMapper(this.#cells);
    return new DynamoSiteRepository(this.#clients.dynamo, this.#settings.tables.sites, mapper);
  }

  #cleanups(): DynamoCleanupRepository {
    return new DynamoCleanupRepository(this.#clients.dynamo, this.#settings.tables.cleanups);
  }

  #reports(): DynamoReportStatusWriter {
    return new DynamoReportStatusWriter(this.#clients.dynamo, this.#settings.tables.reports, this.#clock);
  }

  #media(): PublicMedia {
    return new PublicMedia(this.#settings.publicBaseUrl);
  }
}
