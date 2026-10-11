import { DeleteMessageCommand, ReceiveMessageCommand, type Message, type SQSClient } from "@aws-sdk/client-sqs";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { JsonLoggerFactory } from "../src/adapters/JsonLoggerFactory.js";
import { SqsQueuePoller } from "../src/adapters/SqsQueuePoller.js";
import { ConfigError, ExternalServiceError, ValidationError } from "../src/domain/errors.js";
import type { QueueMessage } from "../src/domain/QueueMessage.js";
import { buildReportQueuePoller } from "../src/handlers/reportWorker.js";
import type { MessageHandler } from "../src/ports/MessageHandler.js";
import { CoreSettings } from "../src/settings/CoreSettings.js";
import { LogSink } from "./LogSink.js";

const QUEUE_URL = "https://sqs.ap-south-1.amazonaws.com/123456789012/junksnap-dev-reports";

function logger(sink = new LogSink()) {
  return new JsonLoggerFactory(sink).create({ service: "worker", stage: "dev" });
}

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

function poller(sqs: FakeSqs, handler: MessageHandler = new KindRecorder(), sink = new LogSink(), messageDeadlineMs?: number) {
  return new SqsQueuePoller(sqs.client(), { queueUrl: QUEUE_URL, maxReceiveCount: 3, messageDeadlineMs }, handler, logger(sink));
}

// Never settles for report rpt_hung; records the rest.
class HangingHandler extends KindRecorder {
  override async handle(message: QueueMessage): Promise<void> {
    return message.field("report_id") === "rpt_hung" ? new Promise(() => undefined) : super.handle(message);
  }
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

  it("logs a failed delete and keeps polling: SQS redelivers the handled message", async () => {
    const sink = new LogSink();
    const handler = new KindRecorder();
    const sqs = new FakeSqs([sqsMessage("m1", JSON.stringify({ kind: "report", report_id: "rpt_a" }))]);
    sqs.failDelete = true;
    await expect(poller(sqs, handler, sink).pollOnce(new AbortController().signal)).resolves.toBeUndefined();
    expect(handler.seen).toHaveLength(1);
    const warned = sink.records().filter((record) => record.message === "could not delete a handled message; SQS will redeliver it");
    expect(warned.map((record) => [record.level, record.message_id])).toEqual([["WARN", "m1"]]);
  });

  it("abandons a message that runs past its deadline without deleting it, and finishes the rest", async () => {
    const sink = new LogSink();
    const handler = new HangingHandler();
    const sqs = new FakeSqs([
      sqsMessage("m1", JSON.stringify({ kind: "report", report_id: "rpt_hung" })),
      sqsMessage("m2", JSON.stringify({ kind: "report", report_id: "rpt_b" })),
    ]);
    await expect(poller(sqs, handler, sink, 20).pollOnce(new AbortController().signal)).resolves.toBeUndefined();
    expect(sqs.deleted).toEqual(["receipt-m2"]);
    const failed = sink.records().filter((record) => record.message === "message failed; SQS will retry it");
    expect(failed.map((record) => record.message_id)).toEqual(["m1"]);
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
    SITES_TABLE: "junksnap-dev-sites",
    VOTES_TABLE: "junksnap-dev-votes",
    CLEANUPS_TABLE: "junksnap-dev-cleanups",
    SCANS_TABLE: "junksnap-dev-scans",
    SCORES_TABLE: "junksnap-dev-scores",
    ORIGINALS_BUCKET: "junksnap-dev-originals-123456789012",
    PUBLIC_BUCKET: "junksnap-dev-public-123456789012",
    PUBLIC_BASE_URL: "https://d111111abcdef8.cloudfront.net",
    ASSETS_DIR: "../../data",
  };
  const context = (vars: Record<string, string | undefined>) => ({
    settings: CoreSettings.fromEnv(vars),
    logger: logger(),
    env: vars,
  });
  // Startup lists the crawler's crawl/wards/ files; the stub answers with none, so no request leaves the test.
  let s3Send: MockInstance<S3Client["send"]>;

  beforeEach(() => {
    s3Send = vi.spyOn(S3Client.prototype, "send").mockResolvedValue({ Contents: [] } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds the SQS poller from the environment and the repo data without touching the network", async () => {
    expect(await buildReportQueuePoller(context(env))).toBeInstanceOf(SqsQueuePoller);
    const sent = s3Send.mock.calls.map(([command]) => command);
    expect(sent).toEqual([expect.any(ListObjectsV2Command)]);
    expect(sent[0]?.input).toMatchObject({ Prefix: "crawl/wards/" });
  });

  it("names a missing variable", async () => {
    await expect(buildReportQueuePoller(context({ ...env, ML_URL: undefined }))).rejects.toThrow(ConfigError);
    await expect(buildReportQueuePoller(context({ ...env, ML_URL: undefined }))).rejects.toThrow(/ML_URL/);
  });
});
