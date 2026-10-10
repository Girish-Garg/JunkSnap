import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SQSClient } from "@aws-sdk/client-sqs";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoReportRepository } from "../adapters/DynamoReportRepository.js";
import { DynamoReputationReader } from "../adapters/DynamoReputationReader.js";
import { HttpMlVerifyClient } from "../adapters/HttpMlVerifyClient.js";
import { SqsQueuePoller } from "../adapters/SqsQueuePoller.js";
import { StandInNearbyCounter } from "../adapters/StandInNearbyCounter.js";
import { StandInStep } from "../adapters/StandInStep.js";
import { SystemClock } from "../adapters/SystemClock.js";
import { UnwiredMessageHandler } from "../adapters/UnwiredMessageHandler.js";
import type { QueuePoller } from "../ports/QueuePoller.js";
import { MessageRouter } from "../services/MessageRouter.js";
import { ReporterReputation } from "../services/ReporterReputation.js";
import { ReportPipeline } from "../services/ReportPipeline.js";
import { VerifyStep } from "../services/VerifyStep.js";
import { ReportWorkerSettings } from "../settings/ReportWorkerSettings.js";
import type { EntryContext } from "./EntryPoint.js";

// The worker's object graph. Stand-ins mark steps other tasks build (integration debt in the PR).
export function buildReportQueuePoller({ settings: core, env, logger }: EntryContext): QueuePoller {
  const settings = ReportWorkerSettings.fromEnv(env);
  const region = core.awsRegion;
  const marshallOptions = { removeUndefinedValues: true };
  const documents = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), { marshallOptions });
  const reports = new DynamoReportRepository(documents, settings.reportsTable);
  const tables = { devices: settings.devicesTable, users: settings.usersTable };
  const reputation = new ReporterReputation(new DynamoReputationReader(documents, tables));
  const verify = new VerifyStep(new HttpMlVerifyClient(settings.mlUrl), reputation, new StandInNearbyCounter());
  const steps = [
    new StandInStep("moderate"),
    verify,
    new StandInStep("brands"),
    new StandInStep("locate"),
    new StandInStep("merge"),
  ];
  const report = new ReportPipeline({ steps, reports, clock: new SystemClock(), logger });
  const cleanup = new UnwiredMessageHandler("cleanup");
  const router = new MessageRouter({ report, cleanup, scan: new UnwiredMessageHandler("scan") });
  const options = { queueUrl: settings.reportsQueueUrl, maxReceiveCount: ReportWorkerSettings.MAX_RECEIVE_COUNT };
  return new SqsQueuePoller(new SQSClient({ region }), options, router, logger);
}
