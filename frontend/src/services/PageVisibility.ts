/** Whether the page is on screen. Android hides it for the app's background and every permission dialog. */
export interface PageVisibility {
  visible(): boolean;
  /** Calls the listener on every change; the returned function stops it. */
  subscribe(listener: () => void): () => void;
}

/** The part of Document that PageVisibility reads. */
export interface VisibilityDocument {
  readonly visibilityState: DocumentVisibilityState;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

/** document.visibilityState and the visibilitychange event. */
export class DocumentVisibility implements PageVisibility {
  readonly #document: VisibilityDocument;

  constructor(document: VisibilityDocument) {
    this.#document = document;
  }

  visible(): boolean {
    return this.#document.visibilityState !== 'hidden';
  }

  subscribe(listener: () => void): () => void {
    this.#document.addEventListener('visibilitychange', listener);
    return () => this.#document.removeEventListener('visibilitychange', listener);
  }
}
