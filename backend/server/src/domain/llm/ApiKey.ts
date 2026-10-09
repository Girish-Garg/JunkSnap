// OpenAI keys (sk-, sk-proj-, sk-svcacct-) start with sk-; anything else is a placeholder.
const KEY_SHAPE = /^sk-\S{17,}$/;

// Never prints its value: logs and errors show "[redacted]".
export class ApiKey {
  readonly #value: string;

  private constructor(value: string) {
    this.#value = value;
  }

  // null for a missing or placeholder key; a JSON secret may hold the key as its only value.
  static fromSecret(secret: string | null): ApiKey | null {
    const value = ApiKey.#unwrap((secret ?? "").trim()).trim();
    return KEY_SHAPE.test(value) ? new ApiKey(value) : null;
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
