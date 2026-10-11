// One-off for decisions 20261011-1610-hem-same-spot-merge and 20261011-1730-hem-merged-sites: lists, for one stage, every
// group of open same-type photo sites within SITE_SAME_SPOT_M (20 m) of an older one, the duplicates the old merge rule
// left ("2 sites at this spot"). With --apply it merges each group into its oldest site and prints every action.
// Usage (from backend/server, AWS_PROFILE set):
//   npx tsx scripts/mergeSameSpotSites.ts <dev|demo>                                      (dry run: reads only)
//   PUBLIC_BASE_URL=<the stage's https base URL> npx tsx scripts/mergeSameSpotSites.ts <dev|demo> --apply
// Run --apply only after the api, worker and scores of that stage are deployed with this code: older images reject
// removed_reason merged. A duplicate that takes a new report during the run is printed as left open: run again to
// finish it. Once every group is merged, a further run changes nothing.
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { pino } from "pino";
import { DynamoReportRepository } from "../src/adapters/DynamoReportRepository.js";
import { JsonLoggerFactory } from "../src/adapters/JsonLoggerFactory.js";
import { DynamoNoteStore } from "../src/adapters/notes/DynamoNoteStore.js";
import { AwsCalls } from "../src/adapters/sites/AwsCalls.js";
import { DynamoReportStatusWriter } from "../src/adapters/sites/DynamoReportStatusWriter.js";
import { DynamoSiteRepository } from "../src/adapters/sites/DynamoSiteRepository.js";
import { DynamoVoteRepository } from "../src/adapters/sites/DynamoVoteRepository.js";
import { NgeohashCells } from "../src/adapters/sites/NgeohashCells.js";
import { SiteItemMapper } from "../src/adapters/sites/SiteItemMapper.js";
import { SystemClock } from "../src/adapters/sites/SystemClock.js";
import { MergeableReportFactory } from "../src/domain/sites/MergeableReportFactory.js";
import { PublicMedia } from "../src/domain/sites/PublicMedia.js";
import { awsClientConfig } from "../src/handlers/utils.js";
import { ConflictRetry } from "../src/services/sites/ConflictRetry.js";
import { PagingSettings } from "../src/settings/PagingSettings.js";
import { RetrySettings } from "../src/settings/RetrySettings.js";
import { SiteRuleSettings } from "../src/settings/SiteRuleSettings.js";
import { TimeoutSettings } from "../src/settings/TimeoutSettings.js";
import type { Env } from "../src/settings/utils.js";
import { GroupMerger } from "./sameSpot/GroupMerger.js";
import { GroupPlanner } from "./sameSpot/GroupPlanner.js";
import { SameSpotApply } from "./sameSpot/SameSpotApply.js";
import { SameSpotArgs, type SameSpotRun } from "./sameSpot/SameSpotArgs.js";
import { SameSpotGrouper } from "./sameSpot/SameSpotGrouper.js";
import { SameSpotLines } from "./sameSpot/SameSpotLines.js";
import { SameSpotScan } from "./sameSpot/SameSpotScan.js";
import { StoredReportEvidence } from "./sameSpot/StoredReportEvidence.js";

const REGION = "ap-south-1";

// The stage's DynamoDB tables behind the ports the scan, the planner and the merger take.
class SameSpotWiring {
  readonly rules: SiteRuleSettings;
  readonly #run: SameSpotRun;
  readonly #env: Env;
  readonly #calls = new AwsCalls();
  readonly #client: DynamoDBDocumentClient;

  constructor(run: SameSpotRun, env: Env) {
    this.#run = run;
    this.#env = env;
    this.rules = SiteRuleSettings.fromEnv(env);
    // The report rows need absent fields left out (DynamoReportRepository).
    const config = awsClientConfig(REGION, TimeoutSettings.fromEnv(env).aws.quick);
    this.#client = DynamoDBDocumentClient.from(new DynamoDBClient(config), { marshallOptions: { removeUndefinedValues: true } });
  }

  // Skipped rows are logged to stderr, so stdout stays the listing.
  sites(): DynamoSiteRepository {
    const logger = new JsonLoggerFactory(pino.destination({ dest: 2, sync: true })).create({ service: "worker", stage: this.#run.stage });
    return new DynamoSiteRepository(this.#client, this.#run.tables.sites, new SiteItemMapper(new NgeohashCells(), logger, this.rules), this.#calls);
  }

  applier(publicBaseUrl: string, print: (line: string) => void): SameSpotApply {
    const { tables } = this.#run;
    const [client, calls, clock, sites] = [this.#client, this.#calls, new SystemClock(), this.sites()];
    const reports = new DynamoReportRepository(client, tables.reports);
    const votes = new DynamoVoteRepository(client, tables.votes, calls);
    const notes = new DynamoNoteStore(client, tables.notes, PagingSettings.fromEnv(this.#env).notesMaxPages);
    const evidence = new StoredReportEvidence(new MergeableReportFactory(new PublicMedia(publicBaseUrl)));
    const statuses = new DynamoReportStatusWriter(client, tables.reports, clock, calls);
    const retry = new ConflictRetry(RetrySettings.fromEnv(this.#env).saveAttempts);
    const merger = new GroupMerger({ sites, reports, statuses, votes, retry, rules: this.rules, clock, print });
    return new SameSpotApply(new GroupPlanner({ sites, reports, notes, evidence }), merger, print);
  }
}

async function main(run: SameSpotRun, env: Env): Promise<void> {
  const print = (line: string) => void process.stdout.write(`${line}\n`);
  const wiring = new SameSpotWiring(run, env);
  const { siteSameSpotM } = wiring.rules;
  const findings = await new SameSpotScan(wiring.sites(), new SameSpotGrouper(siteSameSpotM, new Date())).run();
  new SameSpotLines(run.stage, siteSameSpotM).lines(findings).forEach(print);
  if (run.apply === null) {
    print("dry run: nothing was written; add --apply to merge");
    return;
  }
  await wiring.applier(run.apply.publicBaseUrl, print).run(findings.groups);
}

await main(new SameSpotArgs(process.env).parse(process.argv.slice(2)), process.env);
