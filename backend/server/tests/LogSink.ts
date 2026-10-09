import type { DestinationStream } from "pino";

// Collects pino's JSON lines in memory so tests can assert on them.
export class LogSink implements DestinationStream {
  readonly #lines: string[] = [];

  write(line: string): void {
    this.#lines.push(line);
  }

  records(): Record<string, unknown>[] {
    return this.#lines.map((line) => JSON.parse(line) as Record<string, unknown>);
  }
}
