import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoDeviceRegistry } from "../../adapters/moderation/DynamoDeviceRegistry.js";
import { DynamoReputationReader } from "../../adapters/DynamoReputationReader.js";
import { HttpMlVerifyClient } from "../../adapters/HttpMlVerifyClient.js";
import type { ModerationService } from "../../services/moderation/ModerationService.js";
import { ReporterReputation } from "../../services/ReporterReputation.js";
import { ReportWorkerSettings } from "../../settings/ReportWorkerSettings.js";
import type { EntryContext } from "../EntryPoint.js";
import { ModerationServiceFactory } from "../moderation/ModerationServiceFactory.js";
import { SiteServiceFactory } from "../sites/SiteServiceFactory.js";
import { TimeoutSettings } from "../../settings/TimeoutSettings.js";
import { awsClientConfig } from "../utils.js";

// What the report, cleanup and scan handlers share; built once per worker process.
export class WorkerDeps {
  readonly context: EntryContext;
  readonly settings: ReportWorkerSettings;
  readonly documents: DynamoDBDocumentClient;
  readonly sites: SiteServiceFactory;
  readonly moderation: ModerationService;
  readonly verifier: HttpMlVerifyClient;
  readonly reputation: ReporterReputation;

  constructor(context: EntryContext) {
    const { settings: core, env, logger } = context;
    this.context = context;
    this.settings = ReportWorkerSettings.fromEnv(env);
    const marshallOptions = { removeUndefinedValues: true };
    this.documents = DynamoDBDocumentClient.from(new DynamoDBClient(awsClientConfig(core.awsRegion, TimeoutSettings.fromEnv(env).aws.quick)), { marshallOptions });
    this.sites = SiteServiceFactory.fromEnv(core, env, logger);
    const tables = { reports: this.settings.reportsTable, devices: this.settings.devicesTable, users: this.settings.usersTable };
    this.moderation = ModerationServiceFactory.forWorker(context, new DynamoDeviceRegistry(this.documents, tables));
    this.verifier = new HttpMlVerifyClient(this.settings.mlUrl, TimeoutSettings.fromEnv(env).mlVerifyMs);
    this.reputation = new ReporterReputation(new DynamoReputationReader(this.documents, tables));
  }
}
