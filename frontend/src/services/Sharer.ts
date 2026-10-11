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

  /** The browser has a share sheet (Web Share API). */
  canShare(): boolean {
    return this.#navigator.share !== undefined;
  }

  /** `text` is a message to send with the link; without a share sheet the copy holds both. */
  share(title: string, url: string, text?: string): Promise<ShareResult> {
    return this.#send(text ? { title, text, url } : { title, url }, text ? `${text} ${url}` : url);
  }

  /** A whole text, such as a letter, through the share sheet; copied where there is none. */
  shareText(title: string, text: string): Promise<ShareResult> {
    return this.#send({ title, text }, text);
  }

  async #send(data: ShareData, copied: string): Promise<ShareResult> {
    if (!this.#navigator.share) {
      await this.#navigator.clipboard.writeText(copied);
      return 'copied';
    }
    try {
      await this.#navigator.share(data);
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      throw error;
    }
  }
}
