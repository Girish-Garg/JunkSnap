import type { QueueItemData } from '../domain/QueueItem';
import type { AuthService } from './AuthService';

/** What the triggers need from a photo or video queue. */
export interface SendableQueue {
  flush(): Promise<void>;
  retry(matches: (item: { readonly data: QueueItemData }) => boolean): Promise<void>;
}

export interface TriggerSources {
  readonly window: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  readonly document: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>;
  readonly auth: AuthService;
}

/** Sends the queues at start, when the phone is back online or back in the app, and after sign-in. */
export class QueueTriggers {
  readonly #queues: readonly SendableQueue[];
  readonly #sources: TriggerSources;

  constructor(queues: readonly SendableQueue[], sources: TriggerSources) {
    this.#queues = queues;
    this.#sources = sources;
  }

  /** Returns a function that stops listening. */
  start(): () => void {
    const { window, document, auth } = this.#sources;
    const flush = () => void this.#resume();
    const onVisible = () => {
      if (document.visibilityState === 'visible') flush();
    };
    const onAuth = () => {
      if (auth.currentUser()) void this.#retrySignIn();
    };
    window.addEventListener('online', flush);
    document.addEventListener('visibilitychange', onVisible);
    const unsubscribe = auth.subscribe(onAuth);
    flush();
    return () => {
      window.removeEventListener('online', flush);
      document.removeEventListener('visibilitychange', onVisible);
      unsubscribe();
    };
  }

  /** Reads (and refreshes) the token first, so items parked for sign-in go as soon as one is valid. */
  async #resume(): Promise<void> {
    const token = await this.#sources.auth.idToken().catch(() => null);
    if (token) await this.#retrySignIn();
    else await Promise.all(this.#queues.map((queue) => queue.flush()));
  }

  async #retrySignIn(): Promise<void> {
    await Promise.all(this.#queues.map((queue) => queue.retry((item) => item.data.problem === 'sign_in')));
  }
}
