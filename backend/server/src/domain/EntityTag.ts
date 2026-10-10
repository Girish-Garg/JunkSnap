import { createHash } from "node:crypto";

// A strong validator from the response bytes: equal bodies give equal tags, so a 304 never hides a change.
export class EntityTag {
  readonly #quoted: string;

  private constructor(quoted: string) {
    this.#quoted = quoted;
  }

  static ofBody(body: string | Uint8Array): EntityTag {
    return new EntityTag(`"${createHash("sha256").update(body).digest("base64url").slice(0, 27)}"`);
  }

  toHeader(): string {
    return this.#quoted;
  }

  // If-None-Match uses the weak comparison (RFC 9110 13.1.2), so W/"x" also matches "x".
  matchedBy(ifNoneMatch: string | readonly string[] | undefined): boolean {
    const header = typeof ifNoneMatch === "string" ? ifNoneMatch : (ifNoneMatch ?? []).join(",");
    return header
      .split(",")
      .map((candidate) => candidate.trim().replace(/^W\//, ""))
      .some((candidate) => candidate === "*" || candidate === this.#quoted);
  }
}
