import { EnvReader } from './EnvReader';
import type { EnvVars } from './EnvVar';
import { Vars } from './Vars';

/** Request timeouts, how the offline queue backs off, and how long a presigned URL is reused. */
export interface NetworkSettings {
  /** An api call is given up as timed out after this; a letter drafts for up to 60 s. */
  readonly requestTimeoutMs: number;
  /** A presigned PUT gets this base time plus putMsPerChunk per putChunkBytes, at most putMaxTimeoutMs. */
  readonly putBaseTimeoutMs: number;
  readonly putMsPerChunk: number;
  /** 50 KiB a second is a weak 400 kbit/s uplink. */
  readonly putChunkBytes: number;
  /** 15 min: a 40 MB video on that uplink needs about 14. */
  readonly putMaxTimeoutMs: number;
  /** A send that failed offline is tried again after this (and on the online event). */
  readonly retryOfflineMs: number;
  /** A send the api rate-limited (429) is tried again after this. */
  readonly retryRateLimitedMs: number;
  /** A server error or timeout waits this long first, doubling each time up to retryMaxMs. */
  readonly retryFirstMs: number;
  readonly retryMaxMs: number;
  /** A presigned URL is reused this long; keep it under the api's PRESIGN_TTL_SECONDS (300 s). */
  readonly presignReuseMs: number;
  /** Mock mode's pretend network delay. */
  readonly mockDelayMs: number;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

export const NETWORK_VARS: EnvVars<NetworkSettings> = {
  requestTimeoutMs: Vars.ms('VITE_REQUEST_TIMEOUT_MS', 75_000, 10 * MINUTE_MS),
  putBaseTimeoutMs: Vars.ms('VITE_PUT_BASE_TIMEOUT_MS', 30_000, HOUR_MS),
  putMsPerChunk: Vars.ms('VITE_PUT_MS_PER_CHUNK', 1_000, MINUTE_MS),
  putChunkBytes: Vars.count('VITE_PUT_CHUNK_BYTES', 50 * 1024, 100 * 1024 * 1024),
  putMaxTimeoutMs: Vars.ms('VITE_PUT_MAX_TIMEOUT_MS', 900_000, HOUR_MS),
  retryOfflineMs: Vars.ms('VITE_RETRY_OFFLINE_MS', 30_000),
  retryRateLimitedMs: Vars.ms('VITE_RETRY_RATE_LIMITED_MS', 5 * MINUTE_MS),
  retryFirstMs: Vars.ms('VITE_RETRY_FIRST_MS', 30_000),
  retryMaxMs: Vars.ms('VITE_RETRY_MAX_MS', 10 * MINUTE_MS),
  presignReuseMs: Vars.ms('VITE_PRESIGN_REUSE_MS', 240_000),
  mockDelayMs: Vars.number('VITE_MOCK_DELAY_MS', 400, { min: 0, max: MINUTE_MS, integer: true }),
};

export const NETWORK_DEFAULTS: NetworkSettings = EnvReader.defaults(NETWORK_VARS);
