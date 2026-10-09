import { FetchError } from "aws-jwt-verify/error";
import type { Fetcher } from "aws-jwt-verify/https";
import { SimpleJwksCache, type Jwks, type JwksCache } from "aws-jwt-verify/jwk";

// Serves a JWKS from memory, or without one fails the way the library's fetcher does when Cognito is unreachable.
export class FakeJwksFetcher implements Fetcher {
  readonly #jwks: Jwks | undefined;
  readonly #uris: string[] = [];

  constructor(jwks?: Jwks) {
    this.#jwks = jwks;
  }

  get uris(): readonly string[] {
    return this.#uris;
  }

  async fetch(uri: string): Promise<ArrayBuffer> {
    this.#uris.push(uri);
    if (this.#jwks === undefined) {
      throw new FetchError(uri, "connect ECONNREFUSED");
    }
    return new TextEncoder().encode(JSON.stringify(this.#jwks)).buffer;
  }

  cache(): JwksCache {
    return new SimpleJwksCache({ fetcher: this });
  }
}
