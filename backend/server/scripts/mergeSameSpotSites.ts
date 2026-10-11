// One-off for decision 20261011-1610-hem-same-spot-merge: lists, for one stage, every group of open same-type photo
// sites within SITE_SAME_SPOT_M (20 m) of an older one, the duplicates the old merge rule left ("2 sites at this spot").
// Usage (from backend/server, AWS_PROFILE set): npx tsx scripts/mergeSameSpotSites.ts <dev|demo>
// It only reads the stage's sites table. --apply is refused until the site contract has a removed_reason for a merged
// site (see scripts/sameSpot/SameSpotArgs.ts).
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { pino } from "pino";
import { JsonLoggerFactory } from "../src/adapters/JsonLoggerFactory.js";
import { AwsCalls } from "../src/adapters/sites/AwsCalls.js";
import { DynamoSiteRepository } from "../src/adapters/sites/DynamoSiteRepository.js";
import { NgeohashCells } from "../src/adapters/sites/NgeohashCells.js";
import { SiteItemMapper } from "../src/adapters/sites/SiteItemMapper.js";
import { awsClientConfig } from "../src/handlers/utils.js";
import { SiteRuleSettings } from "../src/settings/SiteRuleSettings.js";
import { TimeoutSettings } from "../src/settings/TimeoutSettings.js";
import { parseSameSpotArgs, type SameSpotRun } from "./sameSpot/SameSpotArgs.js";
import { SameSpotGrouper } from "./sameSpot/SameSpotGrouper.js";
import { SameSpotLines } from "./sameSpot/SameSpotLines.js";
import { SameSpotScan } from "./sameSpot/SameSpotScan.js";

const REGION = "ap-south-1";

async function main(run: SameSpotRun): Promise<void> {
  const rules = SiteRuleSettings.fromEnv(process.env);
  const config = awsClientConfig(REGION, TimeoutSettings.fromEnv(process.env).aws.quick);
  const client = DynamoDBDocumentClient.from(new DynamoDBClient(config));
  // Skipped rows are logged to stderr, so stdout stays the listing.
  const logger = new JsonLoggerFactory(pino.destination({ dest: 2, sync: true })).create({ service: "worker", stage: run.stage });
  const sites = new DynamoSiteRepository(client, run.sitesTable, new SiteItemMapper(new NgeohashCells(), logger, rules), new AwsCalls());
  const findings = await new SameSpotScan(sites, new SameSpotGrouper(rules.siteSameSpotM, new Date())).run();
  for (const line of new SameSpotLines(run.stage, rules.siteSameSpotM).lines(findings)) {
    process.stdout.write(`${line}\n`);
  }
}

await main(parseSameSpotArgs(process.argv.slice(2)));
