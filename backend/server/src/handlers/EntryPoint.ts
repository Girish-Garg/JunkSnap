import type { DestinationStream, Logger } from "pino";
import { JsonLoggerFactory, type LogFields } from "../adapters/JsonLoggerFactory.js";
import { CoreSettings } from "../settings/CoreSettings.js";
import type { Env } from "../settings/utils.js";

export interface EntryContext {
  readonly settings: CoreSettings;
  readonly logger: Logger;
  readonly env: Env;
}

export interface EntryOptions {
  readonly service: LogFields["service"];
  readonly destination?: DestinationStream;
  readonly exit?: Pick<NodeJS.Process, "exitCode">;
}

// Any startup or run failure becomes one JSON error line and exit code 1, never a raw stack trace.
export class EntryPoint {
  readonly #options: EntryOptions;

  constructor(options: EntryOptions) {
    this.#options = options;
  }

  async run(env: Env, body: (context: EntryContext) => Promise<void>): Promise<void> {
    const { service, destination, exit = process } = this.#options;
    const stage = env.JUNKSNAP_STAGE ?? "unset";
    const logger = new JsonLoggerFactory(destination).create({ service, stage });
    try {
      await body({ settings: CoreSettings.fromEnv(env), logger, env });
    } catch (error) {
      logger.error({ error }, `${service} failed`);
      exit.exitCode = 1;
    }
  }
}
