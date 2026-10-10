import type { QueuedReport } from '../domain/QueuedReport';
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
    const flush = () => void this.#resume();
    const onVisible = () => {
      if (document.visibilityState === 'visible') flush();
    };
    const onAuth = () => {
      if (auth.currentUser()) void this.#queue.retry(QueueTriggers.#waitingForSignIn);
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

  /** Reads (and refreshes) the token first, so reports parked for sign-in go as soon as one is valid. */
  async #resume(): Promise<void> {
    const token = await this.#sources.auth.idToken().catch(() => null);
    if (token) await this.#queue.retry(QueueTriggers.#waitingForSignIn);
    else await this.#queue.flush();
  }

  static #waitingForSignIn(report: QueuedReport): boolean {
    return report.data.problem === 'sign_in';
  }
}
