import { CaptureError } from '../domain/CaptureError';
import { SCAN_LIMITS, type VideoType } from '../domain/ScanUpload';
import type { Clock } from './Clock';

export interface Recording {
  readonly bytes: ArrayBuffer;
  readonly contentType: VideoType;
  readonly startedAtMs: number;
  readonly durationMs: number;
}

// Chunks arrive once a second, so the size check and the 60 s stop are never more than a second late.
const TIMESLICE_MS = 1_000;
// Stop early with room for the last chunk and the container's index.
const STOP_AT_BYTES = SCAN_LIMITS.maxBytes - 2 * 1024 * 1024;
// Half a second short of 60 s, so the encoded video never runs past the limit the worker checks.
export const AUTO_STOP_MS = SCAN_LIMITS.maxDurationMs - 500;

/** One recording: auto-stops at 60 s or near 40 MB; finished resolves with the whole video. */
export class RecordingSession {
  readonly startedAtMs: number;
  readonly finished: Promise<Recording>;
  readonly #recorder: MediaRecorder;
  readonly #chunks: Blob[] = [];
  #bytes = 0;

  constructor(recorder: MediaRecorder, contentType: VideoType, clock: Clock) {
    this.#recorder = recorder;
    recorder.ondataavailable = (event) => this.#collect(event.data);
    this.finished = new Promise((resolve, reject) => {
      recorder.onstop = () => void this.#finish(contentType, clock.now().getTime()).then(resolve, reject);
    });
    const autoStop = setTimeout(() => this.stop(), AUTO_STOP_MS);
    void this.finished.finally(() => clearTimeout(autoStop)).catch(() => undefined);
    recorder.start(TIMESLICE_MS);
    this.startedAtMs = clock.now().getTime();
  }

  stop(): void {
    if (this.#recorder.state !== 'inactive') this.#recorder.stop();
  }

  #collect(chunk: Blob): void {
    if (chunk.size === 0) return;
    this.#chunks.push(chunk);
    this.#bytes += chunk.size;
    if (this.#bytes >= STOP_AT_BYTES) this.stop();
  }

  async #finish(contentType: VideoType, endedAtMs: number): Promise<Recording> {
    const durationMs = Math.min(Math.round(endedAtMs - this.startedAtMs), SCAN_LIMITS.maxDurationMs);
    if (durationMs < SCAN_LIMITS.minDurationMs) throw new CaptureError('video_too_short', `Only ${durationMs} ms`);
    const bytes = await new Blob(this.#chunks, { type: contentType }).arrayBuffer();
    if (bytes.byteLength > SCAN_LIMITS.maxBytes) throw new CaptureError('video_too_large', `${bytes.byteLength} bytes`);
    return { bytes, contentType, startedAtMs: this.startedAtMs, durationMs };
  }
}
