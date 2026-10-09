const MIN_LENGTH = 20;
const PLACEHOLDER = /^(placeholder|replace|changeme|change-me|todo|tbd|dummy|xxx|<)/i;
const WHITESPACE = /\s/;

// Never prints its value: logs and errors show "[redacted]".
export class ApiKey {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  // null for a missing, short or placeholder key; a JSON secret may hold the key as its only value.
  static fromSecret(secret: string | null): ApiKey | null {
    const value = ApiKey.#unwrap((secret ?? "").trim()).trim();
    const usable = value.length >= MIN_LENGTH && !WHITESPACE.test(value) && !PLACEHOLDER.test(value);
    return usable ? new ApiKey(value) : null;
  }

  static #unwrap(secret: string): string {
    if (!secret.startsWith("{")) {
      return secret;
    }
    const values = Object.values(ApiKey.#parse(secret));
    const only = values.length === 1 ? values[0] : undefined;
    return typeof only === "string" ? only : "";
  }

  static #parse(secret: string): object {
    try {
      const parsed: unknown = JSON.parse(secret);
      return typeof parsed === "object" && parsed !== null ? parsed : {};
    } catch (error) {
      if (error instanceof SyntaxError) {
        return {};
      }
      throw error;
    }
  }

  bearer(): string {
    return `Bearer ${this.#value}`;
  }

  toString(): string {
    return "[redacted]";
  }

  toJSON(): string {
    return "[redacted]";
  }
}
