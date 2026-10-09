import { pino, type DestinationStream, type Logger } from "pino";

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

  static #errorText(value: unknown): string {
    return value instanceof Error ? (value.stack ?? value.message) : String(value);
  }
}
