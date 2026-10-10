import { describe, expect, it } from "vitest";
import type { BrandLabel, LocationLookup, ModerationResult, VerificationResult } from "../../src/contracts/index.gen.js";
import type { BlurredImage } from "../../src/domain/brands/BlurredImage.js";
import { CleanupJob } from "../../src/domain/CleanupJob.js";
import { InternalDataError, NotFoundError } from "../../src/domain/errors.js";
import type { PhotoSubmission } from "../../src/domain/moderation/PhotoSubmission.js";
import { QueueMessage } from "../../src/domain/QueueMessage.js";
import { Report } from "../../src/domain/Report.js";
import type { MergeEvidence } from "../../src/domain/sites/MergeableReport.js";
import { Site } from "../../src/domain/sites/Site.js";
import type { CleanupOutcome } from "../../src/domain/sites/Cleanup.js";
import type { BrandLabeller } from "../../src/services/brands/BrandLabeller.js";
import type { ModerationService } from "../../src/services/moderation/ModerationService.js";
import { GeoPoint } from "../../src/domain/sites/GeoPoint.js";
import { BinLocator } from "../../src/services/BinLocator.js";
import { NearPlacesFinder } from "../../src/services/NearPlacesFinder.js";
import type { CleanupService } from "../../src/services/sites/CleanupService.js";
import type { MergeResult, SiteMerger } from "../../src/services/sites/SiteMerger.js";
import { LabellerBrandReader } from "../../src/services/wiring/LabellerBrandReader.js";
import { ServiceCleanupModerator } from "../../src/services/wiring/ServiceCleanupModerator.js";
import { ServiceReportModerator } from "../../src/services/wiring/ServiceReportModerator.js";
import { SiteCleanupRecorder } from "../../src/services/wiring/SiteCleanupRecorder.js";
import { SiteReportMerger } from "../../src/services/wiring/SiteReportMerger.js";
import { fixture, upload } from "../reportFakes.js";
import { report as mergeable } from "../sites/builders.js";
import { FakeSiteRepository } from "../sites/fakes.js";

const RECEIVED = "2026-10-10T02:14:52Z";
const moderation = () => fixture<ModerationResult>("moderation_result.jdh-1");
const verification = () => fixture<VerificationResult>("verification_result.jdh-1");
const location = () => fixture<LocationLookup>("location_lookup.jdh-1");

class FakeModerationService {
  readonly submissions: PhotoSubmission[] = [];

  async moderate(submission: PhotoSubmission): Promise<ModerationResult> {
    this.submissions.push(submission);
    return moderation();
  }

  as(): ModerationService {
    return this as unknown as ModerationService;
  }
}

async function siteRepository(): Promise<{ sites: FakeSiteRepository; site: Site }> {
  const sites = new FakeSiteRepository();
  const site = Site.found(mergeable());
  await sites.create(site);
  return { sites, site };
}

function cleanupJob(siteId: string): CleanupJob {
  const body = {
    kind: "cleanup", cleanup_id: "cln_jdh_3c", site_id: siteId, upload_id: "upl_jdh_3c",
    device_token: "3f6c2a1e-8b4d-4c7a-9e21-5d0b7f3a6c14", sha256: "a".repeat(64),
    gps: { lat: 26.2701, lon: 73.0458, accuracy_m: 8 },
    captured_at: "2026-10-09T06:20:00Z", received_at: "2026-10-09T06:20:41Z",
  };
  return CleanupJob.fromMessage(new QueueMessage(body, 1, 3));
}

describe("ServiceReportModerator", () => {
  it("moderates the report photo with its upload fields and received time", async () => {
    const service = new FakeModerationService();
    const request = Report.receive(upload(), RECEIVED).moderationRequest();
    expect(await new ServiceReportModerator(service.as()).moderate(request)).toEqual(moderation());
    const fields = service.submissions[0]?.fields;
    expect(fields).toMatchObject({ sha256: upload().sha256, captureMode: "snap", site: null });
    expect(fields?.receivedAt.toISOString()).toBe("2026-10-10T02:14:52.000Z");
  });
});

describe("ServiceCleanupModerator", () => {
  it("passes the site's position for the near_site check", async () => {
    const { sites, site } = await siteRepository();
    const service = new FakeModerationService();
    await new ServiceCleanupModerator(service.as(), sites).moderate(cleanupJob(site.siteId));
    const claimed = service.submissions[0]?.fields.site;
    expect(claimed).toMatchObject({ id: site.siteId, point: { lat: site.point.lat, lon: site.point.lon } });
  });

  it("fails for a cleanup of a site that does not exist", async () => {
    const moderator = new ServiceCleanupModerator(new FakeModerationService().as(), new FakeSiteRepository());
    await expect(moderator.moderate(cleanupJob("site_gone"))).rejects.toThrow(InternalDataError);
  });
});

describe("LabellerBrandReader", () => {
  it("labels the blurred copy named by the report id", async () => {
    const images: BlurredImage[] = [];
    const labels = [fixture<BrandLabel>("brand_label.jdh-1")];
    const labeller = { label: async (image: BlurredImage) => (images.push(image), labels) };
    const reader = new LabellerBrandReader(labeller as unknown as BrandLabeller);
    expect(await reader.read({ reportId: "rpt_jdh_1", blurredKey: "ignored" })).toEqual(labels);
    expect(images[0]?.key).toBe("media/reports/rpt_jdh_1.jpg");
  });
});

describe("SiteCleanupRecorder", () => {
  function recorder(sites: FakeSiteRepository) {
    const applied: [string, CleanupOutcome][] = [];
    const service = { apply: async (id: string, outcome: CleanupOutcome) => (applied.push([id, outcome]), "accepted") };
    return { applied, recorder: new SiteCleanupRecorder(sites, service as unknown as CleanupService) };
  }

  it("reads the site's type and context", async () => {
    const { sites, site } = await siteRepository();
    expect(await recorder(sites).recorder.siteKind(site.siteId)).toEqual({ report_type: "waste_dump", context: "vacant_plot" });
    await expect(recorder(sites).recorder.siteKind("site_gone")).rejects.toThrow(NotFoundError);
  });

  it("settles with the results and gives up with none, so the sites task rejects it", async () => {
    const { sites, site } = await siteRepository();
    const { applied, recorder: subject } = recorder(sites);
    const job = cleanupJob(site.siteId);
    await subject.settle(job, { moderation: moderation(), verification: null });
    await subject.giveUp(job);
    expect(applied).toEqual([
      ["cln_jdh_3c", { moderation: moderation(), verification: null }],
      ["cln_jdh_3c", { moderation: null, verification: null }],
    ]);
  });
});

describe("SiteReportMerger", () => {
  const layer = {
    kind: "school" as const,
    source: { source_url: "https://overpass.example/api", fetched_at: "2026-10-09T22:00:00Z", page_sha256: "b".repeat(64) },
    features: [{ ref: "osm:node/1", coords: [[26.26201, 73.00352]] as [number, number][] }],
  };

  function merger(result: MergeResult) {
    const seen: MergeEvidence[] = [];
    const sites = { merge: async (evidence: MergeEvidence) => (seen.push(evidence), result) };
    const bin = { point: new GeoPoint(26.2702, 73.0035), ref: "osm:node/2", source: layer.source };
    const bins = new BinLocator({ bins: [bin], mappedTowns: ["jodhpur"] }, 3000);
    return { seen, subject: new SiteReportMerger(sites as unknown as SiteMerger, new NearPlacesFinder([layer]), bins) };
  }

  it("hands over the evidence with nearby places and the nearest bin, and follows the site's status", async () => {
    const { seen, subject } = merger({ siteId: "site_jdh_1", outcome: "founded", reportStatus: "verified" });
    const record = { ...Report.receive(upload(), RECEIVED).toRecord(), moderation_result: moderation(), verification_result: verification(), location: location() };
    expect(await subject.merge(record)).toEqual({ siteId: "site_jdh_1", verification: "verified" });
    const near = [{ kind: "school", ref: "osm:node/1", distance_m: 20 }];
    expect(seen[0]).toMatchObject({ upload: { upload_id: "upl_jdh_1" }, location: location(), brands: [], near });
    expect(seen[0]?.bin).toMatchObject({ nearest_bin: { ref: "osm:node/2" }, no_bin_within_3km: false });
  });

  it("refuses a report that skipped moderation, verification or location", async () => {
    const { subject } = merger({ siteId: "site_jdh_1", outcome: "founded", reportStatus: "verified" });
    await expect(subject.merge(Report.receive(upload(), RECEIVED).toRecord())).rejects.toThrow(InternalDataError);
  });
});
