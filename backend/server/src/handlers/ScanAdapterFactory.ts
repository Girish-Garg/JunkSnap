import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { SQSClient } from "@aws-sdk/client-sqs";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { DynamoFrameOutcomeReader } from "../adapters/DynamoFrameOutcomeReader.js";
import { DynamoFrameReportRepository } from "../adapters/DynamoFrameReportRepository.js";
import { DynamoScanRepository } from "../adapters/DynamoScanRepository.js";
import { S3ScanMediaStore } from "../adapters/S3ScanMediaStore.js";
import { S3ScanUploadSigner } from "../adapters/S3ScanUploadSigner.js";
import { SqsScanQueue } from "../adapters/SqsScanQueue.js";
import type { ScanSettings } from "../settings/ScanSettings.js";
import { AWS_TIMEOUTS, awsClientConfig } from "./utils.js";

// Builds the AWS clients once per process and the scan adapters on top of them.
export class ScanAdapterFactory {
  readonly #settings: ScanSettings;
  readonly #signingS3: S3Client;
  readonly #mediaS3: S3Client;
  readonly #dynamo: DynamoDBDocumentClient;
  readonly #sqs: SQSClient;

  constructor(settings: ScanSettings, region: string) {
    this.#settings = settings;
    const s3 = ScanAdapterFactory.s3Configs(region);
    this.#signingS3 = new S3Client(s3.signing);
    this.#mediaS3 = new S3Client(s3.media);
    const marshallOptions = { removeUndefinedValues: true };
    this.#dynamo = DynamoDBDocumentClient.from(new DynamoDBClient(awsClientConfig(region)), { marshallOptions });
    this.#sqs = new SQSClient(awsClientConfig(region));
  }

  // Checksums only when we pass them (presigned URLs would demand a CRC32 of an empty body); the media client pipes the video, so no idle timeout.
  static s3Configs(region: string) {
    const checksums = { requestChecksumCalculation: "WHEN_REQUIRED" } as const;
    return {
      signing: { ...awsClientConfig(region, AWS_TIMEOUTS.transfer), ...checksums },
      media: { ...awsClientConfig(region, AWS_TIMEOUTS.stream), ...checksums },
    };
  }

  uploadSigner(): S3ScanUploadSigner {
    return new S3ScanUploadSigner(this.#signingS3, this.#settings.originalsBucket, this.#settings.presignTtlSeconds);
  }

  mediaStore(): S3ScanMediaStore {
    return new S3ScanMediaStore(this.#mediaS3, this.#settings.originalsBucket);
  }

  scans(): DynamoScanRepository {
    return new DynamoScanRepository(this.#dynamo, this.#settings.scansTable);
  }

  frameReports(): DynamoFrameReportRepository {
    return new DynamoFrameReportRepository(this.#dynamo, this.#settings.reportsTable);
  }

  frameOutcomes(): DynamoFrameOutcomeReader {
    return new DynamoFrameOutcomeReader(this.#dynamo, this.#settings.reportsTable);
  }

  queue(): SqsScanQueue {
    return new SqsScanQueue(this.#sqs, this.#settings.reportsQueueUrl);
  }
}
