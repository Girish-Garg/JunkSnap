import { ErrorClassifier, type ClassifiedError } from '../domain/ErrorClassifier';

export interface WarnSink {
  warn(...data: unknown[]): void;
}

/** What the page offers for crashes nobody caught. */
export interface ErrorEvents {
  addEventListener(type: 'error' | 'unhandledrejection', listener: (event: Event) => void): void;
}

export const ERROR_TAG = '[junksnap:error]';

/**
 * Classifies every failure the app handles and logs it once with a structured tag, for debugging in the browser
 * or the WebView console. Nothing leaves the phone: there is no telemetry service.
 */
export class ErrorReporter {
  readonly #sink: WarnSink;
  readonly #online: () => boolean;

  constructor(sink: WarnSink, online: () => boolean) {
    this.#sink = sink;
    this.#online = online;
  }

  /** where: the action or screen, e.g. "vote" or "sheet". */
  report(where: string, error: unknown): ClassifiedError {
    const classified = ErrorClassifier.classify(error, this.#online());
    const detail = error instanceof Error ? { name: error.name, message: error.message } : { value: String(error) };
    this.#sink.warn(ERROR_TAG, { where, ...classified, ...detail });
    return classified;
  }

  /** Logs uncaught errors and rejected promises too, so a field report shows them with the same tag. */
  watch(events: ErrorEvents): void {
    events.addEventListener('error', (event) => this.report('uncaught', (event as ErrorEvent).error ?? event));
    events.addEventListener('unhandledrejection', (event) => this.report('unhandled', (event as PromiseRejectionEvent).reason));
  }
}
