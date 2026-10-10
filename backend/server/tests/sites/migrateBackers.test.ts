import { describe, expect, it } from "vitest";
import { buildBackerMigration } from "../../src/handlers/migrateBackers.js";
import { BackerMigration } from "../../src/services/sites/BackerMigration.js";
import { BackerMigrationSettings } from "../../src/settings/BackerMigrationSettings.js";
import { CoreSettings } from "../../src/settings/CoreSettings.js";
import { JsonLoggerFactory } from "../../src/adapters/JsonLoggerFactory.js";
import { LogSink } from "../LogSink.js";

describe("migrateBackers, run locally", () => {
  it("defaults the three tables to the stage's names", () => {
    expect(BackerMigrationSettings.fromEnv("dev", {})).toMatchObject({
      sitesTable: "junksnap-dev-sites",
      votesTable: "junksnap-dev-votes",
      reportsTable: "junksnap-dev-reports",
    });
    expect(BackerMigrationSettings.fromEnv("demo", { SITES_TABLE: "custom" }).sitesTable).toBe("custom");
  });

  it("builds from JUNKSNAP_STAGE alone, without the api's other variables", () => {
    const env = { JUNKSNAP_STAGE: "dev" };
    const logger = new JsonLoggerFactory(new LogSink()).create({ service: "worker", stage: "dev" });
    const migration = buildBackerMigration({ settings: CoreSettings.fromEnv(env), env, logger });
    expect(migration).toBeInstanceOf(BackerMigration);
  });
});
