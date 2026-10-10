import { describe, expect, it } from "vitest";
import { JsonLoggerFactory } from "../src/adapters/JsonLoggerFactory.js";
import type { ModerationResult } from "../src/contracts/index.gen.js";
import type { CleanupJob, SiteKind } from "../src/domain/CleanupJob.js";
import { ValidationError } from "../src/domain/errors.js";
import { QueueMessage } from "../src/domain/QueueMessage.js";
import type { CleanupModerator } from "../src/ports/CleanupModerator.js";
import type { CleanupRecorder, CleanupVerdict } from "../src/ports/CleanupRecorder.js";
import { CleanupPipeline } from "../src/services/CleanupPipeline.js";
import { ReporterReputation } from "../src/services/ReporterReputation.js";
import { LogSink } from "./LogSink.js";
import { FakeReputationReader, FakeVerifier, fixture, Journal } from "./reportFakes.js";

function logger(sink = new LogSink()) {
  return new JsonLoggerFactory(sink).create({ service: "worker", stage: "dev" });
}

const cleanupBody = () => ({
  kind: "cleanup",
  cleanup_id: "cln_jdh_3c",
  site_id: "site_jdh_3",
  upload_id: "upl_jdh_3c",
  device_token: "3f6c2a1e-8b4d-4c7a-9e21-5d0b7f3a6c14",
  user_id: "5e2b8c41-7a3d-4f19-b6e0-93c1d2a4f8b7",
  sha256: "a".repeat(64),
  gps: { lat: 26.2701, lon: 73.0458, accuracy_m: 8 },
  captured_at: "2026-10-09T06:20:00Z",
  received_at: "2026-10-09T06:20:41Z",
});

class FakeCleanupModerator implements CleanupModerator {
  readonly jobs: CleanupJob[] = [];

  constructor(readonly journal: Journal, readonly result = fixture<ModerationResult>("moderation_result.jdh-3")) {}

  async moderate(job: CleanupJob): Promise<ModerationResult> {
    this.journal.record("moderate");
    this.jobs.push(job);
    return this.result;
  }
}

class FakeCleanupRecorder implements CleanupRecorder {
  readonly verdicts: CleanupVerdict[] = [];
  readonly gaveUp: string[] = [];

  async siteKind(): Promise<SiteKind> {
    return { report_type: "contaminated_water", context: "choked_drain" };
  }

  async settle(_job: CleanupJob, verdict: CleanupVerdict): Promise<void> {
    this.verdicts.push(verdict);
  }

  async giveUp(job: CleanupJob): Promise<void> {
    this.gaveUp.push(job.id);
  }
}

function cleanupPipeline(moderated?: ModerationResult) {
  const journal = new Journal();
  const moderator = new FakeCleanupModerator(journal, moderated);
  const verifier = new FakeVerifier(journal, fixture("verification_result.jdh-3"));
  const recorder = new FakeCleanupRecorder();
  const reputation = new ReporterReputation(new FakeReputationReader());
  const pipeline = new CleanupPipeline({ moderator, verifier, recorder, reputation, logger: logger() });
  return { journal, moderator, verifier, recorder, pipeline };
}

describe("CleanupPipeline", () => {
  it("moderates, verifies the blurred after-photo with purpose cleanup and settles", async () => {
    const { pipeline, moderator, verifier, recorder } = cleanupPipeline();
    await pipeline.handle(new QueueMessage(cleanupBody(), 1, 3));
    expect(moderator.jobs[0]?.originalKey()).toBe("cleanups/upl_jdh_3c.jpg");
    expect(verifier.requests).toEqual([
      {
        report_id: "cln_jdh_3c",
        purpose: "cleanup",
        blurred_key: "media/cleanups/cln_jdh_3c.jpg",
        report_type: "contaminated_water",
        context: "choked_drain",
        features: { gps_accuracy_m: 8, reputation: 0.5, nearby_verified_reports: 0 },
      },
    ]);
    expect(recorder.verdicts[0]?.verification).toMatchObject({ report_id: "cln_jdh_3c", purpose: "cleanup" });
  });

  it("settles without verifying when moderation rejects the after-photo", async () => {
    const rejected = { ...fixture<ModerationResult>("moderation_result.jdh-3"), outcome: "rejected" as const };
    const { pipeline, journal, recorder } = cleanupPipeline(rejected);
    await pipeline.handle(new QueueMessage(cleanupBody(), 1, 3));
    expect(journal.calls).toEqual(["moderate"]);
    expect(recorder.verdicts).toEqual([{ moderation: rejected, verification: null }]);
  });

  it("rejects the cleanup when the last receive fails", async () => {
    const { pipeline, journal, recorder } = cleanupPipeline();
    journal.failTimes("verify", 2);
    await expect(pipeline.handle(new QueueMessage(cleanupBody(), 2, 3))).rejects.toThrow("verify failed");
    expect(recorder.gaveUp).toEqual([]);
    await expect(pipeline.handle(new QueueMessage(cleanupBody(), 3, 3))).rejects.toThrow("verify failed");
    expect(recorder.gaveUp).toEqual(["cln_jdh_3c"]);
  });

  it.each(["cleanup_id", "gps", "upload_id", "user_id"])("refuses a message without a valid %s", async (field) => {
    const { pipeline } = cleanupPipeline();
    const body = { ...cleanupBody(), [field]: "bad value!" };
    await expect(pipeline.handle(new QueueMessage(body, 1, 3))).rejects.toThrow(ValidationError);
  });
});
