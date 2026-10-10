import type { FrameDetections } from '../domain/EdgeModel';
import type { EdgeDetector } from './EdgeDetector';

/** About 4 frames a second: enough for live boxes, light on a phone's battery. */
export const HINT_INTERVAL_MS = 250;

export interface Timer {
  set(run: () => void, ms: number): number;
  clear(handle: number): void;
}

export interface LoopPorts {
  readonly detector: Pick<EdgeDetector, 'detect'>;
  readonly video: () => HTMLVideoElement | null;
  readonly onFrame: (frame: FrameDetections) => void;
  readonly timer: Timer;
}

/** Runs the detector on the viewfinder at a throttled rate, one frame in flight at a time. */
export class EdgeHintLoop {
  readonly #ports: LoopPorts;
  readonly #intervalMs: number;
  #handle: number | null = null;
  #running = false;

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

  // The next frame waits for this one, so a slow phone simply drops to a lower rate.
  async #tick(): Promise<void> {
    const started = performance.now();
    const video = this.#ports.video();
    const frame = video ? await this.#ports.detector.detect(video).catch(() => null) : null;
    if (frame && this.#running) this.#ports.onFrame(frame);
    this.#schedule(Math.max(0, this.#intervalMs - (performance.now() - started)));
  }
}
