import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { SQSClient } from "@aws-sdk/client-sqs";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { FastifyPluginAsync } from "fastify";
import { DynamoLetterCounter } from "../adapters/letters/DynamoLetterCounter.js";
import { DynamoReportRepository } from "../adapters/DynamoReportRepository.js";
import { DynamoSnapCounter } from "../adapters/DynamoSnapCounter.js";
import { DynamoUserReportLister } from "../adapters/DynamoUserReportLister.js";
import { S3UploadSigner } from "../adapters/S3UploadSigner.js";
import { SqsReportQueue } from "../adapters/SqsReportQueue.js";
import { SystemClock } from "../adapters/SystemClock.js";
import { UlidIdGenerator } from "../adapters/UlidIdGenerator.js";
import type { Logger } from "../ports/Logger.js";
import { LetterRateLimiter } from "../services/letters/LetterRateLimiter.js";
import { ReportConfirmer } from "../services/ReportConfirmer.js";
import { MyReportsQuery } from "../services/MyReportsQuery.js";
import { ReportIntake } from "../services/ReportIntake.js";
import { ReportStatusReader } from "../services/ReportStatusReader.js";
import { SnapLimit } from "../services/SnapLimit.js";
import { UploadPresigner } from "../services/UploadPresigner.js";
import { ConfirmSettings } from "../settings/ConfirmSettings.js";
import { IntakeSettings } from "../settings/IntakeSettings.js";
import { RateLimitSettings } from "../settings/RateLimitSettings.js";
import type { Env } from "../settings/utils.js";
import { RouteGuard } from "./auth/RouteGuard.js";
import { ReportConfirmEndpoint } from "./ReportConfirmEndpoint.js";
import { ReportEndpoints } from "./ReportEndpoints.js";
import type { RouteContext } from "./RouteBuilder.js";
import { awsClientConfig } from "./utils.js";

// Settings load inside the plugin, so createApp's CORS check still fails first.
export function buildReportRoutes({ core, env }: RouteContext): FastifyPluginAsync {
  return async (app) => {
    const settings = IntakeSettings.fromEnv(env);
    const limits = RateLimitSettings.fromEnv(env);
    const region = core.awsRegion;
    const marshallOptions = { removeUndefinedValues: true };
    const documents = DynamoDBDocumentClient.from(new DynamoDBClient(awsClientConfig(region)), { marshallOptions });
    const reports = new DynamoReportRepository(documents, settings.reportsTable);
    const clock = new SystemClock();
    const snapLimit = new SnapLimit(new DynamoSnapCounter(documents, settings.reportsTable), limits.snapPerHour);
    const signer = new S3UploadSigner(new S3Client(awsClientConfig(region)), settings.originalsBucket);
    const presigner = new UploadPresigner({ signer, ids: new UlidIdGenerator(), clock, snapLimit }, settings.presignTtlSeconds);
    const queue = new SqsReportQueue(new SQSClient(awsClientConfig(region)), settings.reportsQueueUrl);
    const intake = new ReportIntake({ reports, snapLimit, queue, clock });
    const statuses = new ReportStatusReader(reports, settings.publicBaseUrl, clock);
    const lister = new DynamoUserReportLister(documents, settings.reportsTable, app.log);
    const mine = new MyReportsQuery(lister, settings.publicBaseUrl, clock);
    const guard = RouteGuard.fromEnv(env);
    await app.register(new ReportEndpoints({ presigner, intake, statuses, mine }, guard).plugin());
    const limiter = confirmLimiter(documents, env, limits.confirmationsPerHour, app.log);
    const confirmer = new ReportConfirmer({ reports, queue, limiter, clock, publicBaseUrl: settings.publicBaseUrl });
    await app.register(new ReportConfirmEndpoint(confirmer, guard).plugin());
  };
}

// Windowed counters on confirm_window_start and confirm_count in the devices and users rows.
function confirmLimiter(documents: DynamoDBDocumentClient, env: Env, perHour: number, logger: Logger): LetterRateLimiter {
  const { devicesTable, usersTable } = ConfirmSettings.fromEnv(env);
  const counter = (name: string, keyName: string) => new DynamoLetterCounter(documents, { name, keyName, prefix: "confirm" });
  const counters = { devices: counter(devicesTable, "device_token"), users: counter(usersTable, "user_id") };
  return new LetterRateLimiter(counters, logger, perHour, "confirmations");
}
