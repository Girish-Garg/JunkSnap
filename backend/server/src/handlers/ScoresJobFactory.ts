import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoAreaReportReader } from "../adapters/DynamoAreaReportReader.js";
import { DynamoAreaSiteReader } from "../adapters/DynamoAreaSiteReader.js";
import { DynamoScoreRepository } from "../adapters/DynamoScoreRepository.js";
import { DynamoSiteExpirer } from "../adapters/DynamoSiteExpirer.js";
import { SiteItemParser } from "../adapters/SiteItemParser.js";
import { WardRecordAreaFacts } from "../adapters/WardRecordAreaFacts.js";
import { AreaGrouper } from "../services/AreaGrouper.js";
import { ScoreCalculator } from "../services/ScoreCalculator.js";
import { ScoresJob } from "../services/ScoresJob.js";
import { CrawledWardSettings } from "../settings/CrawledWardSettings.js";
import { ScoreSettings } from "../settings/ScoreSettings.js";
import { ScoresSettings } from "../settings/ScoresSettings.js";
import { SiteRuleSettings } from "../settings/SiteRuleSettings.js";
import type { EntryContext } from "./EntryPoint.js";
import { TimeoutSettings } from "../settings/TimeoutSettings.js";
import { awsClientConfig } from "./utils.js";
import { WardFilesFactory } from "./WardFilesFactory.js";

// Composition root of the scores CronJob.
export class ScoresJobFactory {
  async create(context: EntryContext): Promise<ScoresJob> {
    const { settings: core, env, logger } = context;
    const settings = ScoresSettings.fromEnv(env);
    const { ttlDays } = SiteRuleSettings.fromEnv(env);
    const client = DynamoDBDocumentClient.from(new DynamoDBClient(awsClientConfig(core.awsRegion, TimeoutSettings.fromEnv(env).aws.quick)));
    const ports = {
      sites: new DynamoAreaSiteReader(client, settings.sitesTable, new SiteItemParser(ttlDays)),
      reports: new DynamoAreaReportReader(client, settings.reportsTable, logger),
      facts: await ScoresJobFactory.#facts(context, settings.assetsDir),
      scores: new DynamoScoreRepository(client, settings.scoresTable),
      expirer: new DynamoSiteExpirer(client, settings.sitesTable, ttlDays),
    };
    return new ScoresJob(ports, ScoreCalculator.standard(ScoreSettings.fromEnv(env)), new AreaGrouper(), logger);
  }

  // Without ASSETS_DIR there are no local bodies to match ward files to, so neither source is read.
  static async #facts({ settings: core, env, logger }: EntryContext, assetsDir: string | null): Promise<WardRecordAreaFacts> {
    if (assetsDir === null) {
      return WardRecordAreaFacts.fromDirectory(null);
    }
    const { originalsBucket } = CrawledWardSettings.fromEnv(env);
    const files = new WardFilesFactory().create({ assetsDir, originalsBucket, awsRegion: core.awsRegion, timeouts: TimeoutSettings.fromEnv(env).aws.transfer }, logger);
    return WardRecordAreaFacts.fromFiles(files, assetsDir);
  }
}
