import { pino, type DestinationStream, type Logger } from "pino";
import type { Stage } from "../settings/CoreSettings.js";

export interface LogFields {
  readonly service: "api" | "worker" | "scores";
  readonly stage: Stage;
}

// Same keys as the Python services: time, level, message, service, stage.
export function createLogger(fields: LogFields, destination?: DestinationStream): Logger {
  const options = {
    base: { ...fields },
    messageKey: "message",
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { level: (label: string) => ({ level: label }) },
  };
  return pino(options, destination ?? pino.destination({ dest: 1, sync: true }));
}
