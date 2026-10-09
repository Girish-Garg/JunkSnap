import { describe, expect, it } from "vitest";
import type { ModerationResult, VerificationResult } from "../../src/contracts/index.gen.js";
import { InternalDataError, ValidationError } from "../../src/domain/errors.js";
import type { CleanupRequest } from "../../src/domain/sites/Cleanup.js";
import { PublicMedia } from "../../src/domain/sites/PublicMedia.js";
import { Site } from "../../src/domain/sites/Site.js";
import { AlreadyCleanedError, CleanupPendingError, SiteNotFoundError } from "../../src/domain/sites/SiteErrors.js";
import { CleanupIntake } from "../../src/services/sites/CleanupIntake.js";
import { CleanupService } from "../../src/services/sites/CleanupService.js";
import { BASE_URL, DEVICE_B, fixture, report } from "./builders.js";
import { FakeCleanups, FakeQueue, FakeSiteRepository, FixedClock, NOW } from "./fakes.js";

const REQUEST: CleanupRequest = {
  upload_id: "upl_jdh_3c",
  device_token: DEVICE_B,
  sha256: "a".repeat(64),
  gps: { lat: 26.26185, lon: 73.00352, accuracy_m: 8 },
  captured_at: "2026-10-10T05:55:00Z",
};
const MODERATION = fixture<ModerationResult>("moderation_result.jdh-3.json");
const VERIFICATION = fixture<VerificationResult>("verification_result.jdh-3.json");
const PASSED = { moderation: MODERATION, verification: VERIFICATION };

function setup() {
  const sites = new FakeSiteRepository();
  sites.put(Site.found(report()));
  const cleanups = new FakeCleanups();
  const queue = new FakeQueue();
  const intake = new CleanupIntake({ sites, cleanups, queue, clock: new FixedClock() });
  const service = new CleanupService({ sites, cleanups, media: new PublicMedia(BASE_URL) });
  return { sites, cleanups, queue, intake, service };
}

describe("CleanupIntake", () => {
  it("marks the site checking, stores the record and queues it", async () => {
    const { intake, sites, cleanups, queue } = setup();
    const accepted = await intake.submit("site_jdh_1", REQUEST);
    expect(accepted).toEqual({ cleanup_id: "cln_jdh_3c", site_id: "site_jdh_1", status: "checking" });
    expect(sites.feature("site_jdh_1").properties.cleanup_status).toBe("checking");
    expect(cleanups.records.get("cln_jdh_3c")).toEqual({
      ...REQUEST,
      cleanup_id: "cln_jdh_3c",
      site_id: "site_jdh_1",
      received_at: NOW,
      status: "checking",
    });
    expect(queue.sent).toHaveLength(1);
  });

  it("answers a retried POST with the same record and re-queues it while checking", async () => {
    const { intake, queue } = setup();
    await intake.submit("site_jdh_1", REQUEST);
    expect(await intake.submit("site_jdh_1", REQUEST)).toMatchObject({ cleanup_id: "cln_jdh_3c", status: "checking" });
    expect(queue.sent).toHaveLength(2);
  });

  it("finishes the job when a retry follows a failure after the site was marked", async () => {
    const { intake, sites, cleanups, queue } = setup();
    const site = await sites.get("site_jdh_1");
    site?.startCleanup("cln_jdh_3c");
    if (site) {
      await sites.save(site);
    }
    await intake.submit("site_jdh_1", REQUEST);
    expect(cleanups.records.has("cln_jdh_3c")).toBe(true);
    expect(queue.sent).toHaveLength(1);
  });

  it("returns 409 cleanup_pending for a second after-photo while one is checking", async () => {
    const { intake } = setup();
    await intake.submit("site_jdh_1", REQUEST);
    const second = { ...REQUEST, upload_id: "upl_other" };
    await expect(intake.submit("site_jdh_1", second)).rejects.toThrow(CleanupPendingError);
  });

  it("returns 409 already_cleaned once the site is cleaned, but the stored status to a retry", async () => {
    const { intake, service } = setup();
    await intake.submit("site_jdh_1", REQUEST);
    await service.apply("cln_jdh_3c", PASSED);
    expect(await intake.submit("site_jdh_1", REQUEST)).toMatchObject({ status: "accepted" });
    await expect(intake.submit("site_jdh_1", { ...REQUEST, upload_id: "upl_new" })).rejects.toThrow(AlreadyCleanedError);
  });

  it("refuses an unknown site and an upload already used for another site", async () => {
    const { intake, sites } = setup();
    await expect(intake.submit("site_nope", REQUEST)).rejects.toThrow(SiteNotFoundError);
    sites.put(Site.found(report({ id: "jdh_9", lat: 26.3 })));
    await intake.submit("site_jdh_9", REQUEST);
    await expect(intake.submit("site_jdh_1", REQUEST)).rejects.toThrow(ValidationError);
  });
});

describe("CleanupService.apply", () => {
  it("accepts a passed, clean after-photo: the site is cleaned with its photo and decision time", async () => {
    const { intake, service, sites, cleanups } = setup();
    await intake.submit("site_jdh_1", REQUEST);
    expect(await service.apply("cln_jdh_3c", PASSED)).toBe("accepted");
    expect(sites.feature("site_jdh_1").properties).toMatchObject({
      status: "cleaned",
      cleanup_status: "accepted",
      cleanup_photo_url: `${BASE_URL}/media/cleanups/cln_jdh_3c.jpg`,
      cleaned_at: "2026-10-09T06:21:40Z",
    });
    expect(cleanups.finished.get("cln_jdh_3c")).toEqual({ status: "accepted", ...PASSED });
  });

  it.each([
    ["moderation rejected", { ...PASSED, moderation: { ...MODERATION, outcome: "rejected" as const } }],
    ["not clean", { ...PASSED, verification: { ...VERIFICATION, decision: "rejected" as const, is_clean: false } }],
    ["retries ran out", { moderation: null, verification: null }],
  ])("rejects when %s and leaves the site as it was", async (_case, outcome) => {
    const { intake, service, sites } = setup();
    await intake.submit("site_jdh_1", REQUEST);
    expect(await service.apply("cln_jdh_3c", outcome)).toBe("rejected");
    expect(sites.feature("site_jdh_1").properties).toMatchObject({ status: "open", cleanup_status: "rejected" });
  });

  it("is a no-op once the cleanup is no longer checking", async () => {
    const { intake, service, sites } = setup();
    await intake.submit("site_jdh_1", REQUEST);
    await service.apply("cln_jdh_3c", { moderation: null, verification: null });
    expect(await service.apply("cln_jdh_3c", PASSED)).toBe("rejected");
    expect(sites.feature("site_jdh_1").properties.status).toBe("open");
  });

  it("finishes the record when the site was already settled by an earlier attempt", async () => {
    const { intake, service, sites, cleanups } = setup();
    await intake.submit("site_jdh_1", REQUEST);
    const site = await sites.get("site_jdh_1");
    site?.rejectCleanup("cln_jdh_3c");
    if (site) {
      await sites.save(site);
    }
    expect(await service.apply("cln_jdh_3c", { moderation: null, verification: null })).toBe("rejected");
    expect(cleanups.records.get("cln_jdh_3c")?.status).toBe("rejected");
  });

  it("refuses results that belong to another photo", async () => {
    const { intake, service } = setup();
    await intake.submit("site_jdh_1", { ...REQUEST, upload_id: "upl_other" });
    await expect(service.apply("cln_other", PASSED)).rejects.toThrow(InternalDataError);
    await expect(service.apply("cln_missing", PASSED)).rejects.toThrow(InternalDataError);
  });
});
