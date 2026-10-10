import { EntryPoint, type EntryContext } from "./EntryPoint.js";
import { SiteServiceFactory } from "./sites/SiteServiceFactory.js";

// One-off after deploying decision 20261010-1530: node dist/handlers/migrateBackers.js in the worker image.
export async function runBackerMigration({ settings, env, logger }: EntryContext): Promise<void> {
  const migration = SiteServiceFactory.fromEnv(settings, env, logger).backerMigration();
  const summary = await migration.run();
  logger.info({ ...summary }, "backers migrated");
}

if (import.meta.main) {
  await new EntryPoint({ service: "worker" }).run(process.env, runBackerMigration);
}
