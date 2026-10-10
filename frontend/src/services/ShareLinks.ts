import { areaPath, sitePath } from '../app/paths';

/**
 * Links people share. In live mode they point at the api's link-preview pages
 * (`/share/sites/{id}`, `/share/areas/{kind}/{id}`), which crawlers read for the photo, title and
 * counts and which send a person on to the web app. Mock mode has no api, so links open the web app
 * (VITE_WEB_URL, else this page's origin) directly.
 */
export class ShareLinks {
  readonly #apiUrl: string | null;
  readonly #webUrl: string;

  constructor(apiUrl: string | null, webUrl: string) {
    this.#apiUrl = apiUrl?.replace(/\/+$/, '') || null;
    this.#webUrl = webUrl.replace(/\/+$/, '');
  }

  site(siteId: string): string {
    if (this.#apiUrl === null) return `${this.#webUrl}${sitePath(siteId)}`;
    return `${this.#apiUrl}/share/sites/${encodeURIComponent(siteId)}`;
  }

  area(kind: string, areaId: string): string {
    if (this.#apiUrl === null) return `${this.#webUrl}${areaPath(kind, areaId)}`;
    return `${this.#apiUrl}/share/areas/${encodeURIComponent(kind)}/${encodeURIComponent(areaId)}`;
  }
}
