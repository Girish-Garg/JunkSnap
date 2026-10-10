import type { FrameDetections } from '../domain/EdgeModel';
import type { EdgeDetector } from './EdgeDetector';
import type { Timer } from './Timer';

export type { Timer };

/** About 4 frames a second: enough for live boxes, light on a phone's battery. */
export const HINT_INTERVAL_MS = 250;

export interface LoopPorts {
  readonly detector: Pick<EdgeDetector, 'detect'>;
  readonly video: () => HTMLVideoElement | null;
  readonly onFrame: (frame: FrameDetections) => void;
  readonly timer: Timer;
  /** Frames the viewfinder has presented; a frame already analysed is skipped. Absent: analyse every turn. */
  readonly frames?: () => number;
  /** False while the page is hidden (background, permission dialog): nothing is grabbed then. */
  readonly visible?: () => boolean;
}

/**
 * Runs the detector on the viewfinder at a throttled rate, one frame in flight at a time. Each
 * grab copies the frame on the main thread, so the loop only grabs a new frame of a visible
 * page, and a slow phone backs off: it is never busy more than half the time.
 */
export class EdgeHintLoop {
  readonly #ports: LoopPorts;
  readonly #intervalMs: number;
  #handle: number | null = null;
  #running = false;
  #analysed = -1;

  constructor(ports: LoopPorts, intervalMs = HINT_INTERVAL_MS) {
    this.#ports = ports;
    this.#intervalMs = intervalMs;
  }

  start(): void {
    if (this.#running) return;
    this.#running = true;
    this.#schedule(0);
  }

  stop(): void {
    this.#running = false;
    if (this.#handle !== null) this.#ports.timer.clear(this.#handle);
    this.#handle = null;
  }

  #schedule(ms: number): void {
    if (this.#running) this.#handle = this.#ports.timer.set(() => void this.#tick(), ms);
  }

  // The next turn waits at least as long as this one took, so slow inference halves the rate.
  async #tick(): Promise<void> {
    const started = performance.now();
    const video = this.#fresh() ? this.#ports.video() : null;
    const frame = video ? await this.#ports.detector.detect(video).catch(() => null) : null;
    if (frame && this.#running) this.#ports.onFrame(frame);
    const spent = performance.now() - started;
    this.#schedule(Math.max(this.#intervalMs - spent, spent));
  }

  // A visible page with a frame the detector has not seen yet (a frozen or hidden video has none).
  #fresh(): boolean {
    if (this.#ports.visible && !this.#ports.visible()) return false;
    const shown = this.#ports.frames?.();
    if (shown === undefined) return true;
    if (shown === this.#analysed) return false;
    this.#analysed = shown;
    return true;
  }
}
