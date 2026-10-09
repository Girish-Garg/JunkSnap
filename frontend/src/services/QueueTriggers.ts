import type { AuthService } from './AuthService';
import type { ReportQueue } from './ReportQueue';

export interface TriggerSources {
  readonly window: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  readonly document: Pick<Document, 'addEventListener' | 'removeEventListener' | 'visibilityState'>;
  readonly auth: AuthService;
}

/** Sends the queue at start, when the phone is back online or back in the app, and after sign-in. */
export class QueueTriggers {
  readonly #queue: ReportQueue;
  readonly #sources: TriggerSources;

  constructor(queue: ReportQueue, sources: TriggerSources) {
    this.#queue = queue;
    this.#sources = sources;
  }

  /** Returns a function that stops listening. */
  start(): () => void {
    const { window, document, auth } = this.#sources;
    const flush = () => void this.#queue.flush();
    const onVisible = () => {
      if (document.visibilityState === 'visible') flush();
    };
    const onAuth = () => {
      if (auth.currentUser()) void this.#queue.retry((report) => report.data.problem === 'sign_in');
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
}
