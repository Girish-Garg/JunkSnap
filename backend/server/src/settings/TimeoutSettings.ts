import { z } from "zod";
import { parseTunables, type Env } from "./utils.js";

// One AWS SDK client's limits: connect, whole request (stops once headers arrive) and idle socket (covers the body read).
export interface AwsTimeouts {
  readonly connectionTimeout: number;
  readonly requestTimeout: number;
  readonly socketTimeout?: number;
}

export interface AwsTimeoutProfiles {
  readonly quick: AwsTimeouts;
  // S3 bodies read whole into memory, so the socket only idles when S3 or the network stalls.
  readonly transfer: AwsTimeouts;
  // Rekognition and the SQS long poll stay silent for seconds before they answer, so no idle timeout.
  readonly wait: AwsTimeouts;
  // A body piped to a slow consumer (the scan video to disk) pauses the socket under backpressure, so no idle timeout.
  readonly stream: AwsTimeouts;
  readonly secrets: AwsTimeouts;
}

const ms = (min: number, max: number, fallback: number) => z.coerce.number().int().min(min).max(max).default(fallback);
// smithy 4.12 arms a socketTimeout under 6 s at once and drops a longer one when headers come within 3 s.
const idle = (fallback: number) => ms(100, 5_999, fallback);

const TimeoutEnv = z.object({
  AWS_CONNECT_TIMEOUT_MS: ms(100, 60_000, 3_000),
  AWS_QUICK_TIMEOUT_MS: ms(1_000, 300_000, 10_000),
  AWS_QUICK_IDLE_MS: idle(5_000),
  AWS_TRANSFER_TIMEOUT_MS: ms(1_000, 300_000, 30_000),
  AWS_TRANSFER_IDLE_MS: idle(5_000),
  // Longer than the SQS long poll (WORKER_WAIT_SECONDS, at most 20 s).
  AWS_WAIT_TIMEOUT_MS: ms(21_000, 300_000, 30_000),
  AWS_STREAM_TIMEOUT_MS: ms(1_000, 300_000, 30_000),
  SECRET_TIMEOUT_MS: idle(5_000),
  LLM_CALL_TIMEOUT_MS: ms(1_000, 300_000, 25_000),
  LLM_BUDGET_MS: ms(1_000, 600_000, 45_000),
  NOTE_LLM_CALL_TIMEOUT_MS: ms(1_000, 300_000, 15_000),
  NOTE_LLM_BUDGET_MS: ms(1_000, 600_000, 30_000),
  // Must equal ML_WORKER_BUDGET_S on the ml workload.
  ML_VERIFY_TIMEOUT_S: z.coerce.number().int().min(1).max(600).default(60),
  FFMPEG_TIMEOUT_MS: ms(1_000, 600_000, 60_000),
});

type TimeoutValues = z.output<typeof TimeoutEnv>;

export interface LlmTimeouts {
  // Per attempt; the router's budget caps the whole fallback chain.
  readonly callMs: number;
  readonly budgetMs: number;
}

// Every timeout the api, worker and scores set on outside calls; contracts/README.md lists each variable.
export class TimeoutSettings {
  readonly aws: AwsTimeoutProfiles;
  // Letters (api) and the brand judge (worker); the budget leaves letters time for the template inside CloudFront's 60 s.
  readonly llm: LlmTimeouts;
  // The Bedrock-only note router (note moderation and analysis).
  readonly notes: LlmTimeouts;
  readonly mlVerifyMs: number;
  readonly ffmpegMs: number;

  private constructor(values: TimeoutValues) {
    this.aws = TimeoutSettings.#aws(values);
    this.llm = Object.freeze({ callMs: values.LLM_CALL_TIMEOUT_MS, budgetMs: values.LLM_BUDGET_MS });
    this.notes = Object.freeze({ callMs: values.NOTE_LLM_CALL_TIMEOUT_MS, budgetMs: values.NOTE_LLM_BUDGET_MS });
    this.mlVerifyMs = values.ML_VERIFY_TIMEOUT_S * 1_000;
    this.ffmpegMs = values.FFMPEG_TIMEOUT_MS;
    Object.freeze(this);
  }

  static fromEnv(env: Env): TimeoutSettings {
    return new TimeoutSettings(parseTunables(TimeoutEnv, env));
  }

  static #aws(values: TimeoutValues): AwsTimeoutProfiles {
    const connectionTimeout = values.AWS_CONNECT_TIMEOUT_MS;
    const profile = (requestTimeout: number, socketTimeout?: number): AwsTimeouts =>
      Object.freeze(socketTimeout === undefined ? { connectionTimeout, requestTimeout } : { connectionTimeout, requestTimeout, socketTimeout });
    return Object.freeze({
      quick: profile(values.AWS_QUICK_TIMEOUT_MS, values.AWS_QUICK_IDLE_MS),
      transfer: profile(values.AWS_TRANSFER_TIMEOUT_MS, values.AWS_TRANSFER_IDLE_MS),
      wait: profile(values.AWS_WAIT_TIMEOUT_MS),
      stream: profile(values.AWS_STREAM_TIMEOUT_MS),
      secrets: profile(values.SECRET_TIMEOUT_MS, values.SECRET_TIMEOUT_MS),
    });
  }
}
