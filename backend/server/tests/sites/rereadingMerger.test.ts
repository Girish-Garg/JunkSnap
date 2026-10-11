import { describe, expect, it } from "vitest";
import { Report } from "../../src/domain/Report.js";
import type { MergeOutcome, ReportRecord } from "../../src/domain/ReportRecord.js";
import { Site } from "../../src/domain/sites/Site.js";
import { VoteTally, type Vote } from "../../src/domain/sites/VoteTally.js";
import type { ReportMerger } from "../../src/ports/ReportMerger.js";
import { MergeStep } from "../../src/services/MergeStep.js";
import { RereadingReportMerger } from "../../src/services/wiring/RereadingReportMerger.js";
import { upload } from "../reportFakes.js";
import { report } from "./builders.js";
import { FakeSiteRepository, NOW } from "./fakes.js";
import { RULES } from "../defaults.js";

const SITE = "site_jdh_1";
const confirm = (n: number): Vote => ({ siteId: SITE, deviceToken: `d${n}`, userId: null, choice: "confirm", votedAt: NOW });

// Merges into an unverified site; the tenth backer's vote then lands before the worker saves the report.
class VoteAfterMerge implements ReportMerger {
  readonly #sites: FakeSiteRepository;

  constructor(sites: FakeSiteRepository) {
    this.#sites = sites;
  }

  async merge(): Promise<MergeOutcome> {
    const site = await this.#sites.get(SITE);
    site?.recordVotes(VoteTally.of([1, 2, 3, 4, 5, 6, 7, 8, 9].map(confirm)));
    if (site !== null) {
      await this.#sites.save(site);
    }
    return { siteId: SITE, verification: "unverified" };
  }
}

function processing(): Report {
  const record: ReportRecord = { ...Report.receive({ ...upload(), upload_id: "upl_jdh_2" }, NOW).toRecord(), status: "processing" };
  return Report.fromRecord(record);
}

describe("RereadingReportMerger", () => {
  it("gives the report the site's verification as it stands after the merge, so a vote landing meanwhile is kept", async () => {
    const sites = new FakeSiteRepository();
    sites.put(Site.found(report(), RULES));
    const merger = new RereadingReportMerger(new VoteAfterMerge(sites), sites);
    const merged = processing();
    await new MergeStep(merger).run(merged);
    expect(merged.toRecord()).toMatchObject({ site_id: SITE, status: "verified" });
  });

  it("keeps the merge's own outcome when the site cannot be read back", async () => {
    const inner: ReportMerger = { merge: async () => ({ siteId: "site_gone", verification: "unverified" }) };
    const outcome = await new RereadingReportMerger(inner, new FakeSiteRepository()).merge(processing().toRecord());
    expect(outcome).toEqual({ siteId: "site_gone", verification: "unverified" });
  });
});
