export type ShareResult = 'shared' | 'copied' | 'cancelled';

export type ShareApi = Pick<Navigator, 'clipboard'> & Partial<Pick<Navigator, 'share'>>;

/** Native share sheet where there is one, otherwise copy the link. */
export class Sharer {
  readonly #navigator: ShareApi;

  constructor(navigator: ShareApi) {
    this.#navigator = navigator;
  }

  async share(title: string, url: string): Promise<ShareResult> {
    if (!this.#navigator.share) {
      await this.#navigator.clipboard.writeText(url);
      return 'copied';
    }
    try {
      await this.#navigator.share({ title, url });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      throw error;
    }
  }
}
