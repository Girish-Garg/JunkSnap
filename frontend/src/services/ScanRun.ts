import type { Recording, RecordingSession } from './RecordingSession';

/**
 * One Scan recording's life. stop() keeps the clip. cancel() abandons it while it still runs (the sheet closed, the
 * stage went away): the recording, its ticker and its GPS watch stop, and the clip is never queued. Once stopped, or
 * ended at its 60 s or 40 MB limit, the clip is the person's and cancel() changes nothing.
 */
export class ScanRun {
  readonly finished: Promise<Recording>;
  readonly #session: RecordingSession;
  readonly #release: () => void;
  #released = false;
  #ending = false;
  #cancelled = false;

  /** release stops the ticker and the GPS watch; it runs once, when the recording ends or is cancelled. */
  constructor(session: RecordingSession, release: () => void) {
    this.#session = session;
    this.#release = release;
    this.finished = session.finished.finally(() => {
      this.#ending = true;
      this.#releaseOnce();
    });
  }

  get cancelled(): boolean {
    return this.#cancelled;
  }

  stop(): void {
    this.#ending = true;
    this.#session.stop();
  }

  cancel(): void {
    if (this.#ending) return;
    this.#cancelled = true;
    this.#releaseOnce();
    this.#session.stop();
  }

  /** A cancelled recording that fails (too short, say) is not a problem to show: nothing was kept anyway. */
  discard(error: unknown): null {
    if (this.#cancelled) return null;
    throw error;
  }

  #releaseOnce(): void {
    if (this.#released) return;
    this.#released = true;
    this.#release();
  }
}
