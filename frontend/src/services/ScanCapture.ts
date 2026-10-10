import { GPS_TRACK_TICK_MS, GpsTrack } from '../domain/GpsTrack';
import type { QueuedScan } from '../domain/QueuedScan';
import type { GpsFix } from '../domain/ReportUpload';
import type { ScanDraft } from '../domain/ScanUpload';
import type { Clock } from './Clock';
import type { GpsWatcher } from './GpsWatcher';
import type { PhotoHasher } from './PhotoHasher';
import type { Recording } from './RecordingSession';
import type { ScanHintLog } from './ScanHintLog';
import type { ScanQueue } from './ScanQueue';
import type { VideoRecorder } from './VideoRecorder';

export interface ScanCaptureDeps {
  readonly recorder: VideoRecorder;
  readonly gps: GpsWatcher;
  readonly hasher: PhotoHasher;
  readonly queue: ScanQueue;
  readonly clock: Clock;
}

/** The fix that unlocked Start; without takenAtMs it counts as taken at the start. */
export interface FirstFix {
  readonly fix: GpsFix;
  readonly takenAtMs?: number;
}

export interface ScanStart {
  readonly stream: MediaStream;
  /** Recording waits for a fix, so t_ms 0 always has one. */
  readonly firstFix: FirstFix;
  readonly choice: Pick<ScanDraft, 'report_type' | 'context'>;
  readonly onTick: (elapsedMs: number) => void;
  /** Edge mode only: collects on-phone detections timed from the start of the video. */
  readonly hints?: ScanHintLog;
}

export interface ActiveScan {
  stop(): void;
  /** The recording, hashed and saved in the queue; rejects with CaptureError when it cannot be used. */
  readonly saved: Promise<QueuedScan>;
}

/** Records the video and its GPS track on one clock, then saves both to the scan queue. */
export class ScanCapture {
  readonly #deps: ScanCaptureDeps;

  constructor(deps: ScanCaptureDeps) {
    this.#deps = deps;
  }

  start({ stream, firstFix, choice, onTick, hints }: ScanStart): ActiveScan {
    const now = () => this.#deps.clock.now().getTime();
    const session = this.#deps.recorder.start(stream);
    hints?.begin(session.startedAtMs);
    const track = new GpsTrack(session.startedAtMs, { fix: firstFix.fix, takenAtMs: firstFix.takenAtMs ?? session.startedAtMs });
    const unwatch = this.#deps.gps.watch({ onFix: (fix, takenAtMs) => track.add({ fix, takenAtMs }), onProblem: () => undefined });
    const ticker = setInterval(() => {
      track.pad(now());
      onTick(now() - session.startedAtMs);
    }, GPS_TRACK_TICK_MS);
    const finished = session.finished.finally(() => {
      clearInterval(ticker);
      unwatch();
    });
    return { stop: () => session.stop(), saved: finished.then((recording) => this.#save(recording, track, { choice, hints })) };
  }

  async #save(recording: Recording, track: GpsTrack, { choice, hints }: Pick<ScanStart, 'choice' | 'hints'>): Promise<QueuedScan> {
    const { bytes, startedAtMs, durationMs, contentType } = recording;
    track.pad(startedAtMs + durationMs);
    const found = hints?.hints(durationMs);
    const draft: ScanDraft = {
      ...choice,
      started_at: new Date(startedAtMs).toISOString(),
      ended_at: new Date(startedAtMs + durationMs).toISOString(),
      duration_ms: durationMs,
      content_type: contentType,
      video_sha256: await this.#deps.hasher.sha256(bytes),
      size_bytes: bytes.byteLength,
      gps_track: track.fixes(durationMs),
      ...(found ? { hints: found } : {}),
    };
    return this.#deps.queue.add(draft, bytes);
  }
}
