import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { AwsCalls } from "../adapters/sites/AwsCalls.js";
import { DynamoReportStatusWriter } from "../adapters/sites/DynamoReportStatusWriter.js";
import { DynamoSiteRepository } from "../adapters/sites/DynamoSiteRepository.js";
import { DynamoVoteRepository } from "../adapters/sites/DynamoVoteRepository.js";
import { NgeohashCells } from "../adapters/sites/NgeohashCells.js";
import { SiteItemMapper } from "../adapters/sites/SiteItemMapper.js";
import { SystemClock } from "../adapters/sites/SystemClock.js";
import { BackerMigration } from "../services/sites/BackerMigration.js";
import { ConflictRetry } from "../services/sites/ConflictRetry.js";
import { BackerMigrationSettings } from "../settings/BackerMigrationSettings.js";
import { SiteRuleSettings } from "../settings/SiteRuleSettings.js";
import { EntryPoint, type EntryContext } from "./EntryPoint.js";
import { TimeoutSettings } from "../settings/TimeoutSettings.js";
import { awsClientConfig } from "./utils.js";

// Run once, locally, with your own AWS sign-in (the worker role cannot scan the sites table):
// cd backend/server; AWS_PROFILE=junksnap JUNKSNAP_STAGE=dev npm run migrate:backers
export function buildBackerMigration({ settings, env, logger }: EntryContext): BackerMigration {
  const tables = BackerMigrationSettings.fromEnv(settings.stage, env);
  const marshallOptions = { removeUndefinedValues: true };
  const client = DynamoDBDocumentClient.from(new DynamoDBClient(awsClientConfig(settings.awsRegion, TimeoutSettings.fromEnv(env).aws.quick)), { marshallOptions });
  const calls = new AwsCalls();
  const mapper = new SiteItemMapper(new NgeohashCells(), logger, SiteRuleSettings.fromEnv(env));
  return new BackerMigration({
    sites: new DynamoSiteRepository(client, tables.sitesTable, mapper, calls),
    votes: new DynamoVoteRepository(client, tables.votesTable, calls),
    reports: new DynamoReportStatusWriter(client, tables.reportsTable, new SystemClock(), calls),
    retry: new ConflictRetry(),
  });
}

export async function runBackerMigration(context: EntryContext): Promise<void> {
  const summary = await buildBackerMigration(context).run();
  context.logger.info({ ...summary }, "backers migrated");
}

if (import.meta.main) {
  await new EntryPoint({ service: "worker" }).run(process.env, runBackerMigration);
}
