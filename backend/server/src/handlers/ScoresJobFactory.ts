import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoAreaReportReader } from "../adapters/DynamoAreaReportReader.js";
import { DynamoAreaSiteReader } from "../adapters/DynamoAreaSiteReader.js";
import { DynamoScoreRepository } from "../adapters/DynamoScoreRepository.js";
import { SiteItemParser } from "../adapters/SiteItemParser.js";
import { WardRecordAreaFacts } from "../adapters/WardRecordAreaFacts.js";
import { AreaGrouper } from "../services/AreaGrouper.js";
import { ScoreCalculator } from "../services/ScoreCalculator.js";
import { ScoresJob } from "../services/ScoresJob.js";
import { ScoresSettings } from "../settings/ScoresSettings.js";
import type { EntryContext } from "./EntryPoint.js";

// Composition root of the scores CronJob.
export class ScoresJobFactory {
  async create({ settings: core, env }: EntryContext): Promise<ScoresJob> {
    const settings = ScoresSettings.fromEnv(env);
    const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: core.awsRegion }));
    const ports = {
      sites: new DynamoAreaSiteReader(client, settings.sitesTable, new SiteItemParser()),
      reports: new DynamoAreaReportReader(client, settings.reportsTable),
      facts: await WardRecordAreaFacts.fromDirectory(settings.assetsDir),
      scores: new DynamoScoreRepository(client, settings.scoresTable),
    };
    return new ScoresJob(ports, ScoreCalculator.standard(), new AreaGrouper());
  }
}
