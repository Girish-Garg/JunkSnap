const CONNECT_TIMEOUT_MS = 3_000;

export interface AwsTimeouts {
  readonly requestTimeout: number;
  readonly socketTimeout?: number;
}

// requestTimeout stops once headers arrive; socketTimeout (idle) also covers the body read after them.
// smithy 4.12 arms a socketTimeout under 6 s at once and drops a longer one when headers come within 3 s.
export const AWS_TIMEOUTS = {
  quick: { requestTimeout: 10_000, socketTimeout: 5_000 },
  // S3 bodies read whole into memory, so the socket only idles when S3 or the network stalls.
  transfer: { requestTimeout: 30_000, socketTimeout: 5_000 },
  // Rekognition and the SQS long poll stay silent for seconds before they answer, so no idle timeout.
  wait: { requestTimeout: 30_000 },
  // A body piped to a slow consumer (the scan video to disk) pauses the socket under backpressure, so no idle timeout.
  stream: { requestTimeout: 30_000 },
} as const satisfies Record<string, AwsTimeouts>;

export interface AwsClientConfig {
  readonly region: string;
  readonly requestHandler: AwsTimeouts & { readonly connectionTimeout: number; readonly throwOnRequestTimeout: true };
}

// Every AWS SDK client: smithy sets no timeout by default, and requestTimeout without throwOnRequestTimeout only warns.
export function awsClientConfig(region: string, timeouts: AwsTimeouts = AWS_TIMEOUTS.quick): AwsClientConfig {
  return { region, requestHandler: { ...timeouts, connectionTimeout: CONNECT_TIMEOUT_MS, throwOnRequestTimeout: true } };
}
