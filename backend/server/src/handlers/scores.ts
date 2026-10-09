import { JunkSnapError } from "../domain/errors.js";
import type { ScoresJob } from "../services/ScoresJob.js";
import { EntryPoint, type EntryContext } from "./EntryPoint.js";
import { ScoresJobFactory } from "./ScoresJobFactory.js";

export type ScoresJobSource = (context: EntryContext) => Promise<Pick<ScoresJob, "run">>;

const buildScoresJob: ScoresJobSource = (context) => new ScoresJobFactory().create(context);

// Failed areas and skipped sites are logged one by one; any of them makes the CronJob exit non-zero after the rest are scored.
export async function runScores(context: EntryContext, source: ScoresJobSource = buildScoresJob): Promise<void> {
  const job = await source(context);
  const summary = await job.run(new Date());
  context.logger.info({ ...summary }, "scores done");
  if (summary.failed > 0) {
    throw new JunkSnapError(`${summary.failed} areas or site items failed`);
  }
}

if (import.meta.main) {
  await new EntryPoint({ service: "scores" }).run(process.env, runScores);
}
