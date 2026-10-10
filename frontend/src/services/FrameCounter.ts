/** The part of HTMLVideoElement that reports each frame it presents. */
export interface FrameSource {
  requestVideoFrameCallback?(callback: VideoFrameRequestCallback): number;
  cancelVideoFrameCallback?(handle: number): void;
}

/**
 * Counts the frames the viewfinder presents (requestVideoFrameCallback). A count that stops
 * growing while the page is visible means the camera has frozen. It keeps counting when the
 * video is scrolled off screen; it pauses while the page is hidden.
 */
export class FrameCounter {
  readonly #source: FrameSource;
  #handle: number | null = null;
  #count = 0;

  private constructor(source: FrameSource) {
    this.#source = source;
  }

  /** A counter for this video, or null where the browser cannot report frames (no watchdog then). */
  static for(source: FrameSource): FrameCounter | null {
    return typeof source.requestVideoFrameCallback === 'function' ? new FrameCounter(source) : null;
  }

  get count(): number {
    return this.#count;
  }

  start(): void {
    if (this.#handle === null) this.#next();
  }

  stop(): void {
    if (this.#handle !== null) this.#source.cancelVideoFrameCallback?.(this.#handle);
    this.#handle = null;
  }

  #next(): void {
    this.#handle =
      this.#source.requestVideoFrameCallback?.(() => {
        this.#count += 1;
        if (this.#handle !== null) this.#next();
      }) ?? null;
  }
}
