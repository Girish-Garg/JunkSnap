import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { SQSClient } from "@aws-sdk/client-sqs";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import type { FastifyPluginAsync } from "fastify";
import { DynamoReportRepository } from "../adapters/DynamoReportRepository.js";
import { DynamoSnapCounter } from "../adapters/DynamoSnapCounter.js";
import { DynamoUserReportLister } from "../adapters/DynamoUserReportLister.js";
import { S3UploadSigner } from "../adapters/S3UploadSigner.js";
import { SqsReportQueue } from "../adapters/SqsReportQueue.js";
import { SystemClock } from "../adapters/SystemClock.js";
import { UlidIdGenerator } from "../adapters/UlidIdGenerator.js";
import { MyReportsQuery } from "../services/MyReportsQuery.js";
import { ReportIntake } from "../services/ReportIntake.js";
import { ReportStatusReader } from "../services/ReportStatusReader.js";
import { SnapLimit } from "../services/SnapLimit.js";
import { UploadPresigner } from "../services/UploadPresigner.js";
import { IntakeSettings } from "../settings/IntakeSettings.js";
import { RouteGuard } from "./auth/RouteGuard.js";
import { ReportEndpoints } from "./ReportEndpoints.js";
import type { RouteContext } from "./RouteBuilder.js";

// Settings load inside the plugin, so createApp's CORS check still fails first.
export function buildReportRoutes({ core, env }: RouteContext): FastifyPluginAsync {
  return async (app) => {
    const settings = IntakeSettings.fromEnv(env);
    const region = core.awsRegion;
    const marshallOptions = { removeUndefinedValues: true };
    const documents = DynamoDBDocumentClient.from(new DynamoDBClient({ region }), { marshallOptions });
    const reports = new DynamoReportRepository(documents, settings.reportsTable);
    const clock = new SystemClock();
    const snapLimit = new SnapLimit(new DynamoSnapCounter(documents, settings.reportsTable));
    const signer = new S3UploadSigner(new S3Client({ region }), settings.originalsBucket);
    const presigner = new UploadPresigner({ signer, ids: new UlidIdGenerator(), clock, snapLimit }, settings.presignTtlSeconds);
    const queue = new SqsReportQueue(new SQSClient({ region }), settings.reportsQueueUrl);
    const intake = new ReportIntake({ reports, snapLimit, queue, clock });
    const statuses = new ReportStatusReader(reports, settings.publicBaseUrl);
    const mine = new MyReportsQuery(new DynamoUserReportLister(documents, settings.reportsTable), settings.publicBaseUrl);
    const guard = RouteGuard.fromEnv(env);
    await app.register(new ReportEndpoints({ presigner, intake, statuses, mine }, guard).plugin());
  };
}
