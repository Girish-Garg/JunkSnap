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
  /** A toast with a step stays until the person takes it, dismisses it, or the next line replaces it. */
  readonly action?: ToastAction;
  readonly tone: 'info' | 'alert';
}

export type ToastInput = Omit<Toast, 'id' | 'tone'> & { readonly tone?: Toast['tone'] };

const sameText = (a: ToastInput, b: ToastInput) => a.key === b.key && JSON.stringify(a.params ?? {}) === JSON.stringify(b.params ?? {});

/**
 * The app's toast queue: one toast shows at a time, the rest wait their turn; the same line is never queued twice. A
 * toast with a step (it never leaves by itself) gives way to the next line at once.
 */
export class Notifier {
  #queue: readonly Toast[] = [];
  #nextId = 1;
  readonly #listeners = new Set<() => void>();

  push(input: ToastInput): void {
    const toast: Toast = { ...input, tone: input.tone ?? 'info', id: this.#nextId++ };
    const [current, ...waiting] = this.#queue;
    // Tapping a blocked action again shows its reason afresh (a new id restarts the timer) instead of queueing it.
    if (current && (sameText(current, input) || current.action !== undefined)) this.#queue = [toast, ...waiting];
    else if (waiting.some((other) => sameText(other, input))) return;
    else this.#queue = [...this.#queue, toast];
    this.#emit();
  }

  dismiss(id: number): void {
    const next = this.#queue.filter((toast) => toast.id !== id);
    if (next.length === this.#queue.length) return;
    this.#queue = next;
    this.#emit();
  }

  /** Drops every toast with this key, e.g. "You're offline" once the connection is back. */
  drop(key: string): void {
    const next = this.#queue.filter((toast) => toast.key !== key);
    if (next.length === this.#queue.length) return;
    this.#queue = next;
    this.#emit();
  }

  /** The toast on screen, or null. */
  current(): Toast | null {
    return this.#queue[0] ?? null;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #emit(): void {
    for (const listener of this.#listeners) listener();
  }
}
