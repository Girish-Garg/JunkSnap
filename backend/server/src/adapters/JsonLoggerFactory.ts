import { pino, type DestinationStream, type Logger } from "pino";

// Stops a cyclic cause chain from looping forever.
const MAX_CAUSES = 10;

export interface LogFields {
  readonly service: "api" | "worker" | "scores";
  readonly stage: string;
}

// Same JSON keys as the Python services: time, level (uppercase), message, error, service, stage.
export class JsonLoggerFactory {
  readonly #destination: DestinationStream;

  constructor(destination: DestinationStream = pino.destination({ dest: 1, sync: true })) {
    this.#destination = destination;
  }

  create(fields: LogFields): Logger {
    const options = {
      base: { ...fields },
      messageKey: "message",
      errorKey: "error",
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: { level: (label: string) => ({ level: label.toUpperCase() }) },
      serializers: { error: JsonLoggerFactory.#errorText },
    };
    return pino(options, this.#destination);
  }

  // Adapters wrap SDK errors, so the cause chain is where the real failure is.
  static #errorText(value: unknown): string {
    const lines = [JsonLoggerFactory.#oneError(value)];
    let cause = JsonLoggerFactory.#causeOf(value);
    while (cause !== undefined && lines.length <= MAX_CAUSES) {
      lines.push(`Caused by: ${JsonLoggerFactory.#oneError(cause)}`);
      cause = JsonLoggerFactory.#causeOf(cause);
    }
    return lines.join("\n");
  }

  static #oneError(value: unknown): string {
    return value instanceof Error ? (value.stack ?? value.message) : String(value);
  }

  static #causeOf(value: unknown): unknown {
    return value instanceof Error ? (value.cause ?? undefined) : undefined;
  }
}
