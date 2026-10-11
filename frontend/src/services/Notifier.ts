/** One step the toast offers, e.g. Open app settings; key is the button's i18n key. */
export interface ToastAction {
  readonly key: string;
  readonly run: () => void;
}

export interface Toast {
  readonly id: number;
  /** i18n key; the toast is worded when shown, so a language switch rewords it. */
  readonly key: string;
  readonly params?: Readonly<Record<string, number | string>>;
  /** i18n key of a second sentence, e.g. where to allow location. */
  readonly detail?: string;
  /** A toast with a step stays until the person takes it or dismisses it, the next line drops it, or ui.stepToastMs (useToast). */
  readonly action?: ToastAction;
  readonly tone: 'info' | 'alert';
}

export type ToastInput = Omit<Toast, 'id' | 'tone'> & { readonly tone?: Toast['tone'] };

const sameText = (a: ToastInput, b: ToastInput) => a.key === b.key && JSON.stringify(a.params ?? {}) === JSON.stringify(b.params ?? {});

/**
 * The app's toast queue: one toast shows at a time, the rest wait their turn; the same line is never queued twice. A
 * toast with a step barely leaves by itself, so any new line drops every step toast, shown or waiting; the tap that
 * showed one shows it again.
 */
export class Notifier {
  #queue: readonly Toast[] = [];
  #nextId = 1;
  readonly #listeners = new Set<() => void>();

  /** Queues a line; returns its id, or the id of the same line already waiting. */
  push(input: ToastInput): number {
    const toast: Toast = { ...input, tone: input.tone ?? 'info', id: this.#nextId++ };
    const kept = this.#queue.filter((queued) => queued.action === undefined);
    const [current, ...waiting] = kept;
    const queued = waiting.find((other) => sameText(other, input));
    if (queued) {
      this.#replace(kept);
      return queued.id;
    }
    // Tapping a blocked action again shows its reason afresh (a new id restarts the timer) instead of queueing it.
    this.#replace(current && sameText(current, input) ? [toast, ...waiting] : [...kept, toast]);
    return toast.id;
  }

  dismiss(id: number): void {
    this.#replace(this.#queue.filter((toast) => toast.id !== id));
  }

  /** Drops every toast with this key, e.g. "You're offline" once the connection is back. */
  drop(key: string): void {
    this.#replace(this.#queue.filter((toast) => toast.key !== key));
  }

  /** The toast on screen, or null. */
  current(): Toast | null {
    return this.#queue[0] ?? null;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #replace(next: readonly Toast[]): void {
    if (next.length === this.#queue.length && next.every((toast, index) => toast === this.#queue[index])) return;
    this.#queue = next;
    this.#emit();
  }

  #emit(): void {
    for (const listener of this.#listeners) listener();
  }
}
