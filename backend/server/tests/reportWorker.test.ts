import { DeleteMessageCommand, ReceiveMessageCommand, type Message, type SQSClient } from "@aws-sdk/client-sqs";
import { describe, expect, it } from "vitest";
import { JsonLoggerFactory } from "../src/adapters/JsonLoggerFactory.js";
import { SqsQueuePoller } from "../src/adapters/SqsQueuePoller.js";
import type { ModerationResult } from "../src/contracts/index.gen.js";
import type { CleanupJob, SiteKind } from "../src/domain/CleanupJob.js";
import { ConfigError, ExternalServiceError, ValidationError } from "../src/domain/errors.js";
import { QueueMessage } from "../src/domain/QueueMessage.js";
import { buildReportQueuePoller } from "../src/handlers/reportWorker.js";
import type { CleanupModerator } from "../src/ports/CleanupModerator.js";
import type { CleanupRecorder, CleanupVerdict } from "../src/ports/CleanupRecorder.js";
import type { MessageHandler } from "../src/ports/MessageHandler.js";
import { CleanupPipeline } from "../src/services/CleanupPipeline.js";
import { ReporterReputation } from "../src/services/ReporterReputation.js";
import { CoreSettings } from "../src/settings/CoreSettings.js";
import { LogSink } from "./LogSink.js";
import { FakeReputationReader, FakeVerifier, fixture, Journal } from "./reportFakes.js";

const QUEUE_URL = "https://sqs.ap-south-1.amazonaws.com/123456789012/junksnap-dev-reports";

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

// Answers ReceiveMessage from a script and records deletes; anything else fails the test.
class FakeSqs {
  readonly receives: ReceiveMessageCommand["input"][] = [];
  readonly deleted: (string | undefined)[] = [];
  failDelete = false;

  constructor(readonly batch: Message[] | (() => Promise<Message[]>)) {}

  async send(command: object, options?: { abortSignal?: AbortSignal }): Promise<object> {
    if (command instanceof ReceiveMessageCommand) {
      this.receives.push(command.input);
      const messages = typeof this.batch === "function" ? await this.batch() : this.batch;
      return options?.abortSignal?.aborted ? Promise.reject(new Error("aborted")) : { Messages: messages };
    }
    if (command instanceof DeleteMessageCommand && !this.failDelete) {
      this.deleted.push(command.input.ReceiptHandle);
      return {};
    }
    throw new Error("delete failed");
  }

  client(): SQSClient {
    return this as unknown as SQSClient;
  }
}

class KindRecorder implements MessageHandler {
  readonly seen: [string, number, boolean][] = [];

  async handle(message: QueueMessage): Promise<void> {
    if (message.kind !== "report") {
      throw new ValidationError(`unexpected kind ${message.kind}`);
    }
    this.seen.push([String(message.field("report_id")), message.receiveCount, message.isLastAttempt()]);
  }
}

const sqsMessage = (id: string, body: string, receiveCount = "1"): Message => ({
  MessageId: id,
  ReceiptHandle: `receipt-${id}`,
  Body: body,
  Attributes: { ApproximateReceiveCount: receiveCount },
});

function poller(sqs: FakeSqs, handler: MessageHandler = new KindRecorder(), sink = new LogSink()) {
  return new SqsQueuePoller(sqs.client(), { queueUrl: QUEUE_URL, maxReceiveCount: 3 }, handler, logger(sink));
}

describe("SqsQueuePoller", () => {
  it("long-polls 20 s for up to 10 messages with the receive count", async () => {
    const sqs = new FakeSqs([]);
    await poller(sqs).pollOnce(new AbortController().signal);
    expect(sqs.receives).toEqual([
      {
        QueueUrl: QUEUE_URL,
        MaxNumberOfMessages: 10,
        WaitTimeSeconds: 20,
        MessageSystemAttributeNames: ["ApproximateReceiveCount"],
      },
    ]);
  });

  it("isolates poison messages: deletes only the ones handled, logs the rest and carries on", async () => {
    const sink = new LogSink();
    const handler = new KindRecorder();
    const sqs = new FakeSqs([
      sqsMessage("m1", "{not json"),
      sqsMessage("m2", JSON.stringify({ kind: "letter" })),
      sqsMessage("m3", JSON.stringify({ kind: "report", report_id: "rpt_a" }), "3"),
      sqsMessage("m4", "[1, 2]"),
    ]);
    await poller(sqs, handler, sink).pollOnce(new AbortController().signal);
    expect(handler.seen).toEqual([["rpt_a", 3, true]]);
    expect(sqs.deleted).toEqual(["receipt-m3"]);
    const failed = sink.records().filter((record) => record.message === "message failed; SQS will retry it");
    expect(failed.map((record) => record.message_id).sort()).toEqual(["m1", "m2", "m4"]);
    expect(failed.every((record) => record.level === "ERROR" && record.receive_count === 1)).toBe(true);
  });

  it("returns quietly when stopped during the long poll", async () => {
    const stopper = new AbortController();
    const sqs = new FakeSqs(async () => {
      stopper.abort();
      return [];
    });
    await expect(poller(sqs).pollOnce(stopper.signal)).resolves.toBeUndefined();
  });

  it("rethrows a receive failure so the pod restarts", async () => {
    const sqs = new FakeSqs(async () => Promise.reject(new Error("throttled")));
    await expect(poller(sqs).pollOnce(new AbortController().signal)).rejects.toThrow(ExternalServiceError);
  });

  it("rethrows a failed delete as a transport failure after handling the batch", async () => {
    const handler = new KindRecorder();
    const sqs = new FakeSqs([sqsMessage("m1", JSON.stringify({ kind: "report", report_id: "rpt_a" }))]);
    sqs.failDelete = true;
    await expect(poller(sqs, handler).pollOnce(new AbortController().signal)).rejects.toThrow(ExternalServiceError);
    expect(handler.seen).toHaveLength(1);
  });
});

describe("buildReportQueuePoller", () => {
  const env = {
    JUNKSNAP_STAGE: "dev",
    REPORTS_TABLE: "junksnap-dev-reports",
    DEVICES_TABLE: "junksnap-dev-devices",
    USERS_TABLE: "junksnap-dev-users",
    REPORTS_QUEUE_URL: QUEUE_URL,
    ML_URL: "http://ml",
  };
  const context = (vars: Record<string, string | undefined>) => ({
    settings: CoreSettings.fromEnv(vars),
    logger: logger(),
    env: vars,
  });

  it("builds the SQS poller from the environment without touching the network", () => {
    expect(buildReportQueuePoller(context(env))).toBeInstanceOf(SqsQueuePoller);
  });

  it("names a missing variable", () => {
    expect(() => buildReportQueuePoller(context({ ...env, ML_URL: undefined }))).toThrow(ConfigError);
    expect(() => buildReportQueuePoller(context({ ...env, ML_URL: undefined }))).toThrow(/ML_URL/);
  });
});
