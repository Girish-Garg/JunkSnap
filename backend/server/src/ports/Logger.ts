// Structured JSON logger; pino's and Fastify's loggers satisfy it.
export interface Logger {
  info: LogMethod;
  warn: LogMethod;
  error: LogMethod;
}

export interface LogMethod {
  (fields: object, message: string): void;
  (message: string): void;
}
