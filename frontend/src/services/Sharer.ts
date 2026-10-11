export type ShareResult = 'shared' | 'copied' | 'cancelled';

export type ShareApi = Pick<Navigator, 'clipboard'> & Partial<Pick<Navigator, 'share'>>;

/** Native share sheet where there is one, otherwise copy the link. */
export class Sharer {
  readonly #navigator: ShareApi;

  constructor(navigator: ShareApi) {
    this.#navigator = navigator;
  }

  copy(text: string): Promise<void> {
    return this.#navigator.clipboard.writeText(text);
  }

  /** `text` is a message to send with the link; without a share sheet the copy holds both. */
  async share(title: string, url: string, text?: string): Promise<ShareResult> {
    if (!this.#navigator.share) {
      await this.#navigator.clipboard.writeText(text ? `${text} ${url}` : url);
      return 'copied';
    }
    try {
      await this.#navigator.share(text ? { title, text, url } : { title, url });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      throw error;
    }
  }
}
