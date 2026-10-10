import type { DetectRequest, EdgeReply, EdgeRequest, LoadRequest } from '../domain/EdgeProtocol';

/** The model behind the worker: loads once, then turns one frame into raw output rows. */
export interface ModelRunner {
  load(modelUrl: string, threads: number): Promise<string>;
  /** A blank frame, timed; used for the warm-up. */
  warmUp(): Promise<number>;
  detect(bitmap: ImageBitmap): Promise<readonly number[]>;
}

export type Post = (reply: EdgeReply) => void;

/** Answers the page's messages inside the worker; detect before load fails instead of waiting. */
export class EdgeWorkerHost {
  readonly #runner: ModelRunner;
  readonly #post: Post;
  readonly #now: () => number;
  #ready = false;

  constructor(runner: ModelRunner, post: Post, now: () => number) {
    this.#runner = runner;
    this.#post = post;
    this.#now = now;
  }

  handle(request: EdgeRequest): Promise<void> {
    return request.kind === 'load' ? this.#load(request) : this.#detect(request);
  }

  async #load({ modelUrl, threads }: LoadRequest): Promise<void> {
    try {
      const backend = await this.#runner.load(modelUrl, threads);
      await this.#runner.warmUp(); // the first run allocates; time the second
      const warmMs = await this.#runner.warmUp();
      this.#ready = true;
      this.#post({ kind: 'ready', warmMs, backend });
    } catch (error) {
      this.#post({ kind: 'failed', reason: String(error) });
    }
  }

  async #detect({ id, bitmap }: DetectRequest): Promise<void> {
    if (!this.#ready) {
      bitmap.close();
      this.#post({ kind: 'failed', id, reason: 'not loaded' });
      return;
    }
    const started = this.#now();
    try {
      const rows = await this.#runner.detect(bitmap);
      this.#post({ kind: 'result', id, rows, inferenceMs: Math.round(this.#now() - started) });
    } catch (error) {
      this.#post({ kind: 'failed', id, reason: String(error) });
    }
  }
}
