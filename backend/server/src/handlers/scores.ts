import { CoreSettings } from "../settings/CoreSettings.js";
import type { Env } from "../settings/utils.js";
import { createLogger } from "./logger.js";

// One CronJob run; scoring arrives with its own task.
function main(env: Env): void {
  const settings = CoreSettings.fromEnv(env);
  const logger = createLogger({ service: "scores", stage: settings.stage });
  logger.info("scores started");
}

if (import.meta.main) {
  main(process.env);
}
