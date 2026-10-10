import type { FrameSource } from '../src/services/FrameCounter';
import type { PageVisibility } from '../src/services/PageVisibility';
import type { Timer } from '../src/services/Timer';

/** A clock and setTimeout that only move when the test says so. */
export class ManualTimer implements Timer {
  now = 0;
  readonly #due = new Map<number, { readonly at: number; readonly run: () => void }>();
  #next = 1;

  set(run: () => void, ms: number): number {
    const handle = this.#next++;
    this.#due.set(handle, { at: this.now + ms, run });
    return handle;
  }

  clear(handle: number): void {
    this.#due.delete(handle);
  }

  get pending(): number {
    return this.#due.size;
  }

  /** Moves the clock forward, running every timer that falls due on the way, in order. */
  advance(ms: number): void {
    const end = this.now + ms;
    for (let next = this.#earliest(end); next; next = this.#earliest(end)) {
      this.#due.delete(next[0]);
      this.now = next[1].at;
      next[1].run();
    }
    this.now = Math.max(this.now, end);
  }

  #earliest(end: number) {
    const due = [...this.#due.entries()].filter(([, timer]) => timer.at <= end);
    return due.sort((a, b) => a[1].at - b[1].at)[0];
  }
}

export class FakePage implements PageVisibility {
  shown = true;
  readonly #listeners = new Set<() => void>();

  visible(): boolean {
    return this.shown;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  get listeners(): number {
    return this.#listeners.size;
  }

  set(shown: boolean): void {
    this.shown = shown;
    this.#listeners.forEach((listener) => listener());
  }
}

/** A video track that can end like a real one. */
export class FakeTrack extends EventTarget {
  stopped = false;
  muted = false;

  stop(): void {
    this.stopped = true;
  }

  end(): void {
    this.dispatchEvent(new Event('ended'));
  }
}

export function fakeStream(track = new FakeTrack()): MediaStream & { readonly track: FakeTrack } {
  return { track, getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream & { readonly track: FakeTrack };
}

/** The <video> as LiveCamera and FrameCounter see it; present() delivers one frame. */
export class FakeScreen implements FrameSource {
  srcObject: MediaProvider | null = null;
  plays = 0;
  #callbacks = new Map<number, VideoFrameRequestCallback>();
  #next = 1;

  async play(): Promise<void> {
    this.plays += 1;
  }

  requestVideoFrameCallback(callback: VideoFrameRequestCallback): number {
    const handle = this.#next++;
    this.#callbacks.set(handle, callback);
    return handle;
  }

  cancelVideoFrameCallback(handle: number): void {
    this.#callbacks.delete(handle);
  }

  get waiting(): number {
    return this.#callbacks.size;
  }

  present(): void {
    const callbacks = [...this.#callbacks.values()];
    this.#callbacks.clear();
    callbacks.forEach((callback) => callback(0, {} as VideoFrameCallbackMetadata));
  }
}

export const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
