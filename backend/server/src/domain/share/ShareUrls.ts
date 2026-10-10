import type { ShareImage } from "./ShareCard.js";

const LOGO_PATH = "/brand/icon-512.png";
const LOGO_SIZE = 512;
// Blurred copies only (contracts/README.md, S3 key layout): PUBLIC_BASE_URL/media/reports/{report_id}.jpg.
const BLURRED_REPORT = /^media\/reports\/rpt_[a-z0-9_]{1,40}\.jpg$/;

// The api's public base (CloudFront, where /share/* is served) and the web app, both without a trailing slash.
export interface ShareBases {
  readonly publicBaseUrl: string;
  readonly webUrl: string;
}

// Builds every URL a share card holds; a photo is used only when it is a blurred copy under PUBLIC_BASE_URL.
export class ShareUrls {
  readonly #publicBase: string;
  readonly #web: string;

  constructor(bases: ShareBases) {
    this.#publicBase = bases.publicBaseUrl.replace(/\/+$/, "");
    this.#web = bases.webUrl.replace(/\/+$/, "");
  }

  sharedSite(siteId: string): string {
    return `${this.#publicBase}/share/sites/${encodeURIComponent(siteId)}`;
  }

  sharedArea(kind: string, areaId: string): string {
    return `${this.#publicBase}/share/areas/${encodeURIComponent(kind)}/${encodeURIComponent(areaId)}`;
  }

  appSite(siteId: string): string {
    return `${this.#web}/sites/${encodeURIComponent(siteId)}`;
  }

  appArea(kind: string, areaId: string): string {
    return `${this.#web}/areas/${encodeURIComponent(kind)}/${encodeURIComponent(areaId)}`;
  }

  appHome(): string {
    return `${this.#web}/`;
  }

  logo(): ShareImage {
    const alt = "JunkSnap logo";
    return { url: `${this.#web}${LOGO_PATH}`, alt, large: false, width: LOGO_SIZE, height: LOGO_SIZE };
  }

  // The first photo that is a public blurred copy; never an original, a presigned URL or another host.
  blurredPhoto(urls: readonly string[]): string | null {
    return urls.find((url) => this.#isBlurredCopy(url)) ?? null;
  }

  #isBlurredCopy(url: string): boolean {
    const prefix = `${this.#publicBase}/`;
    return url.startsWith(prefix) && BLURRED_REPORT.test(url.slice(prefix.length));
  }
}
