// A public URL is PUBLIC_BASE_URL + "/" + key (contracts/README.md, S3 key layout).
export class PublicMedia {
  readonly #baseUrl: string;

  constructor(baseUrl: string) {
    this.#baseUrl = baseUrl.replace(/\/+$/, "");
  }

  urlFor(key: string): string {
    return `${this.#baseUrl}/${key}`;
  }
}
