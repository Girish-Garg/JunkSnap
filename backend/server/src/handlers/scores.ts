import type { ScoresJob } from "../services/ScoresJob.js";
import { EntryPoint, type EntryContext } from "./EntryPoint.js";
import { ScoresJobFactory } from "./ScoresJobFactory.js";

export type ScoresJobSource = (context: EntryContext) => Promise<Pick<ScoresJob, "run">>;

const buildScoresJob: ScoresJobSource = (context) => new ScoresJobFactory().create(context);

export async function runScores(context: EntryContext, source: ScoresJobSource = buildScoresJob): Promise<void> {
  const job = await source(context);
  const summary = await job.run(new Date());
  context.logger.info({ ...summary }, "scores done");
}

if (import.meta.main) {
  await new EntryPoint({ service: "scores" }).run(process.env, runScores);
}
