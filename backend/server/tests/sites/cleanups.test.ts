import { describe, expect, it } from "vitest";
import type { ModerationResult, VerificationResult } from "../../src/contracts/index.gen.js";
import { InternalDataError, ValidationError } from "../../src/domain/errors.js";
import type { CleanupRecord, CleanupRequest } from "../../src/domain/sites/Cleanup.js";
import { PublicMedia } from "../../src/domain/sites/PublicMedia.js";
import { Site } from "../../src/domain/sites/Site.js";
import { AlreadyCleanedError, CleanupPendingError, SiteNotFoundError } from "../../src/domain/sites/SiteErrors.js";
import { CleanupIntake } from "../../src/services/sites/CleanupIntake.js";
import { CleanupService } from "../../src/services/sites/CleanupService.js";
import { ConflictRetry } from "../../src/services/sites/ConflictRetry.js";
import { BASE_URL, DEVICE_B, fixture, report } from "./builders.js";
import { FakeCleanups, FakeQueue, FakeSiteRepository, FakeVoteRepository, FixedClock, NOW } from "./fakes.js";
import { RETRY, RULES } from "../defaults.js";

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
const USER = "user-cleaner";

// SQS refuses the first send, then recovers.
class FlakyQueue extends FakeQueue {
  #failed = false;

  override async send(record: CleanupRecord): Promise<void> {
    if (!this.#failed) {
      this.#failed = true;
      throw new Error("queue unreachable");
    }
    await super.send(record);
  }
}

// The cleanups table refuses the first write, then recovers.
class FlakyCleanups extends FakeCleanups {
  #failed = false;

  override async create(record: CleanupRecord): Promise<void> {
    if (!this.#failed) {
      this.#failed = true;
      throw new Error("cleanups table unreachable");
    }
    await super.create(record);
  }
}

// The worker settles each photo as soon as it is queued, before the intake marks the site.
class EagerWorkerQueue extends FakeQueue {
  constructor(readonly settle: (record: CleanupRecord) => Promise<unknown>) {
    super();
  }

  override async send(record: CleanupRecord): Promise<void> {
    await super.send(record);
    await this.settle(record);
  }
}

function setup() {
  const sites = new FakeSiteRepository();
  sites.put(Site.found(report(), RULES));
  const cleanups = new FakeCleanups();
  const queue = new FakeQueue();
  const retry = new ConflictRetry(RETRY.saveAttempts);
  const intake = new CleanupIntake({ sites, cleanups, queue, clock: new FixedClock(), retry });
  const service = new CleanupService({ sites, cleanups, votes: new FakeVoteRepository(), media: new PublicMedia(BASE_URL), retry });
  return { sites, cleanups, queue, intake, service };
}

describe("CleanupIntake", () => {
  it("marks the site checking, stores the record and queues it", async () => {
    const { intake, sites, cleanups, queue } = setup();
    const accepted = await intake.submit("site_jdh_1", REQUEST, USER);
    expect(accepted).toEqual({ cleanup_id: "cln_jdh_3c", site_id: "site_jdh_1", status: "checking" });
    expect(sites.feature("site_jdh_1").properties.cleanup_status).toBe("checking");
    expect(cleanups.records.get("cln_jdh_3c")).toEqual({
      ...REQUEST,
      cleanup_id: "cln_jdh_3c",
      site_id: "site_jdh_1",
      user_id: USER,
      received_at: NOW,
      status: "checking",
    });
    expect(queue.sent).toHaveLength(1);
  });

  it("stores a guest's cleanup without a user", async () => {
    const { intake, cleanups } = setup();
    await intake.submit("site_jdh_1", REQUEST, null);
    expect(cleanups.records.get("cln_jdh_3c")?.user_id).toBeNull();
  });

  it("answers a retried POST with the same record and re-queues it while checking", async () => {
    const { intake, queue } = setup();
    await intake.submit("site_jdh_1", REQUEST, USER);
    expect(await intake.submit("site_jdh_1", REQUEST, USER)).toMatchObject({ cleanup_id: "cln_jdh_3c", status: "checking" });
    expect(queue.sent).toHaveLength(2);
  });

  it("finishes the job when a retry follows a failure after the site was marked", async () => {
    const { intake, sites, cleanups, queue } = setup();
    const site = await sites.get("site_jdh_1");
    site?.startCleanup("cln_jdh_3c", new Date(NOW));
    if (site) {
      await sites.save(site);
    }
    await intake.submit("site_jdh_1", REQUEST, USER);
    expect(cleanups.records.has("cln_jdh_3c")).toBe(true);
    expect(queue.sent).toHaveLength(1);
  });

  it("leaves the site free when queueing fails, and a retried POST marks it and queues the photo", async () => {
    const { sites, cleanups } = setup();
    const queue = new FlakyQueue();
    const intake = new CleanupIntake({ sites, cleanups, queue, clock: new FixedClock(), retry: new ConflictRetry(RETRY.saveAttempts) });
    await expect(intake.submit("site_jdh_1", REQUEST, USER)).rejects.toThrow("queue unreachable");
    expect(sites.feature("site_jdh_1").properties.cleanup_status).toBe("none");
    expect(await intake.submit("site_jdh_1", REQUEST, USER)).toMatchObject({ cleanup_id: "cln_jdh_3c", status: "checking" });
    expect(sites.feature("site_jdh_1").properties.cleanup_status).toBe("checking");
    expect(queue.sent).toHaveLength(1);
  });

  it("leaves the site free for the next after-photo when storing the record fails", async () => {
    const { sites, queue } = setup();
    const intake = new CleanupIntake({ sites, cleanups: new FlakyCleanups(), queue, clock: new FixedClock(), retry: new ConflictRetry(RETRY.saveAttempts) });
    await expect(intake.submit("site_jdh_1", REQUEST, USER)).rejects.toThrow("cleanups table unreachable");
    expect(sites.feature("site_jdh_1").properties.cleanup_status).toBe("none");
    await expect(intake.submit("site_jdh_1", { ...REQUEST, upload_id: "upl_other" }, USER)).resolves.toMatchObject({ status: "checking" });
  });

  it("does not leave the site checking when the worker settles the photo before the site is marked", async () => {
    const { sites, cleanups, service } = setup();
    const passed = (id: string) => ({ moderation: { ...MODERATION, report_id: id }, verification: { ...VERIFICATION, report_id: id } });
    const queue = new EagerWorkerQueue((record) => service.apply(record.cleanup_id, passed(record.cleanup_id)));
    const intake = new CleanupIntake({ sites, cleanups, queue, clock: new FixedClock(), retry: new ConflictRetry(RETRY.saveAttempts) });
    await intake.submit("site_jdh_1", REQUEST, USER);
    expect(cleanups.records.get("cln_jdh_3c")?.status).toBe("accepted");
    expect(sites.feature("site_jdh_1").properties.cleanup_status).not.toBe("checking");
    await expect(intake.submit("site_jdh_1", { ...REQUEST, upload_id: "upl_other" }, USER)).resolves.toMatchObject({ status: "checking" });
  });

  it("refuses a second after-photo while one is checking before storing or queueing it", async () => {
    const { intake, cleanups, queue } = setup();
    await intake.submit("site_jdh_1", REQUEST, USER);
    await expect(intake.submit("site_jdh_1", { ...REQUEST, upload_id: "upl_other" }, USER)).rejects.toThrow(CleanupPendingError);
    expect(cleanups.records.has("cln_other")).toBe(false);
    expect(queue.sent).toHaveLength(1);
  });

  it("returns 409 cleanup_pending for a second after-photo while one is checking", async () => {
    const { intake } = setup();
    await intake.submit("site_jdh_1", REQUEST, USER);
    const second = { ...REQUEST, upload_id: "upl_other" };
    await expect(intake.submit("site_jdh_1", second, USER)).rejects.toThrow(CleanupPendingError);
  });

  it("takes more after-photos while pending, then returns 409 already_cleaned, but the stored status to a retry", async () => {
    const { intake, service } = setup();
    for (const person of [USER, "user-two", "user-three"]) {
      const upload = { ...REQUEST, upload_id: `upl_${person}` };
      const { cleanup_id: cleanupId } = await intake.submit("site_jdh_1", upload, person);
      await service.apply(cleanupId, { moderation: { ...MODERATION, report_id: cleanupId }, verification: { ...VERIFICATION, report_id: cleanupId } });
    }
    expect(await intake.submit("site_jdh_1", { ...REQUEST, upload_id: `upl_${USER}` }, USER)).toMatchObject({ status: "accepted" });
    await expect(intake.submit("site_jdh_1", { ...REQUEST, upload_id: "upl_new" }, USER)).rejects.toThrow(AlreadyCleanedError);
  });

  it("refuses an unknown site and an upload already used for another site", async () => {
    const { intake, sites } = setup();
    await expect(intake.submit("site_nope", REQUEST, USER)).rejects.toThrow(SiteNotFoundError);
    sites.put(Site.found(report({ id: "jdh_9", lat: 26.3 }), RULES));
    await intake.submit("site_jdh_9", REQUEST, USER);
    await expect(intake.submit("site_jdh_1", REQUEST, USER)).rejects.toThrow(ValidationError);
  });
});

describe("CleanupService.apply", () => {
  it("accepts a passed, clean after-photo as one person's word: the site waits for two more (decision 20261010-1855)", async () => {
    const { intake, service, sites, cleanups } = setup();
    await intake.submit("site_jdh_1", REQUEST, USER);
    expect(await service.apply("cln_jdh_3c", PASSED)).toBe("accepted");
    expect(sites.feature("site_jdh_1").properties).toMatchObject({
      status: "open",
      cleanup_status: "pending_confirmation",
      cleanup_photo_url: `${BASE_URL}/media/cleanups/cln_jdh_3c.jpg`,
      clearance: { count: 1, needed: 3, still_there: 0 },
      cleaned_at: null,
    });
    expect(sites.internals("site_jdh_1")?.cleanupPeople).toEqual([{ person: USER, at: NOW }]);
    expect(cleanups.finished.get("cln_jdh_3c")).toEqual({ status: "accepted", ...PASSED });
  });

  it.each([
    ["moderation rejected", { ...PASSED, moderation: { ...MODERATION, outcome: "rejected" as const } }],
    ["not clean", { ...PASSED, verification: { ...VERIFICATION, decision: "rejected" as const, is_clean: false } }],
    ["retries ran out", { moderation: null, verification: null }],
  ])("rejects when %s and leaves the site as it was", async (_case, outcome) => {
    const { intake, service, sites } = setup();
    await intake.submit("site_jdh_1", REQUEST, USER);
    expect(await service.apply("cln_jdh_3c", outcome)).toBe("rejected");
    expect(sites.feature("site_jdh_1").properties).toMatchObject({ status: "open", cleanup_status: "rejected" });
  });

  it("is a no-op once the cleanup is no longer checking", async () => {
    const { intake, service, sites } = setup();
    await intake.submit("site_jdh_1", REQUEST, USER);
    await service.apply("cln_jdh_3c", { moderation: null, verification: null });
    expect(await service.apply("cln_jdh_3c", PASSED)).toBe("rejected");
    expect(sites.feature("site_jdh_1").properties.status).toBe("open");
  });

  it("finishes the record when the site was already settled by an earlier attempt", async () => {
    const { intake, service, sites, cleanups } = setup();
    await intake.submit("site_jdh_1", REQUEST, USER);
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
    await intake.submit("site_jdh_1", { ...REQUEST, upload_id: "upl_other" }, USER);
    await expect(service.apply("cln_other", PASSED)).rejects.toThrow(InternalDataError);
    await expect(service.apply("cln_missing", PASSED)).rejects.toThrow(InternalDataError);
  });
});
