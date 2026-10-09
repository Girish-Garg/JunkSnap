import { EntryPoint, type EntryContext } from "./EntryPoint.js";

// One CronJob run; scoring arrives with its own task.
export async function runScores({ logger }: EntryContext): Promise<void> {
  logger.info("scores started");
}

if (import.meta.main) {
  await new EntryPoint({ service: "scores" }).run(process.env, runScores);
}
