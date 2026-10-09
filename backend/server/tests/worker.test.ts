import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { JsonLoggerFactory } from "../src/adapters/JsonLoggerFactory.js";
import { runWorker } from "../src/handlers/worker.js";
import type { QueuePoller } from "../src/ports/QueuePoller.js";
import { WorkerLoop } from "../src/services/WorkerLoop.js";
import { CoreSettings } from "../src/settings/CoreSettings.js";
import { LogSink } from "./LogSink.js";

class FakeQueuePoller implements QueuePoller {
  polls = 0;
  sawAbort = false;

  async pollOnce(signal: AbortSignal): Promise<void> {
    this.polls += 1;
    await new Promise<void>((resolve) => {
      signal.addEventListener("abort", () => resolve(), { once: true });
    });
    this.sawAbort = signal.aborted;
  }
}

class FailingQueuePoller implements QueuePoller {
  async pollOnce(): Promise<void> {
    throw new Error("queue unreachable");
  }
}

function workerLogger(sink: LogSink) {
  return new JsonLoggerFactory(sink).create({ service: "worker", stage: "dev" });
}

describe("runWorker", () => {
  it("stops on SIGTERM and logs JSON lines", async () => {
    const sink = new LogSink();
    const signals = new EventEmitter();
    const context = { settings: CoreSettings.fromEnv({ JUNKSNAP_STAGE: "dev" }), logger: workerLogger(sink), env: {} };
    const done = runWorker(context, signals, () => new FakeQueuePoller());
    signals.emit("SIGTERM");
    await done;
    const messages = sink.records().map((record) => [record.message, record.service, record.level]);
    expect(messages).toEqual([
      ["worker started", "worker", "INFO"],
      ["worker stopping", "worker", "INFO"],
      ["worker stopped", "worker", "INFO"],
    ]);
  });
});

describe("WorkerLoop", () => {
  it("aborts the poll in flight on stop", async () => {
    const poller = new FakeQueuePoller();
    const loop = new WorkerLoop(poller, workerLogger(new LogSink()));
    const running = loop.run();
    loop.stop("SIGTERM");
    await running;
    expect(poller).toMatchObject({ polls: 1, sawAbort: true });
  });

  it("ignores a second stop signal", async () => {
    const sink = new LogSink();
    const loop = new WorkerLoop(new FakeQueuePoller(), workerLogger(sink));
    const running = loop.run();
    loop.stop("SIGTERM");
    loop.stop("SIGINT");
    await running;
    expect(sink.records().filter((record) => record.message === "worker stopping")).toHaveLength(1);
  });

  it("ends run() when a poll fails so the pod restarts", async () => {
    const loop = new WorkerLoop(new FailingQueuePoller(), workerLogger(new LogSink()));
    await expect(loop.run()).rejects.toThrow("queue unreachable");
  });
});
