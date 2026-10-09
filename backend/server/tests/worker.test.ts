import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { IdleQueuePoller } from "../src/adapters/IdleQueuePoller.js";
import { createLogger } from "../src/handlers/logger.js";
import { runWorker } from "../src/handlers/worker.js";
import type { QueuePoller } from "../src/ports/QueuePoller.js";
import { WorkerLoop } from "../src/services/WorkerLoop.js";
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
  return createLogger({ service: "worker", stage: "dev" }, sink);
}

describe("worker", () => {
  it("stops on SIGTERM, aborting the poll in flight, and logs JSON lines", async () => {
    const sink = new LogSink();
    const poller = new FakeQueuePoller();
    const signals = new EventEmitter();
    const done = runWorker({ loop: new WorkerLoop(poller, workerLogger(sink)), logger: workerLogger(sink), signals });
    signals.emit("SIGTERM");
    await done;
    expect(poller).toMatchObject({ polls: 1, sawAbort: true });
    const messages = sink.records().map((record) => [record.message, record.service, record.level]);
    expect(messages).toEqual([
      ["worker started", "worker", "info"],
      ["worker stopping", "worker", "info"],
      ["worker stopped", "worker", "info"],
    ]);
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

  it("IdleQueuePoller returns as soon as it is aborted", async () => {
    const stopper = new AbortController();
    const started = Date.now();
    const poll = new IdleQueuePoller(60_000).pollOnce(stopper.signal);
    stopper.abort();
    await poll;
    expect(Date.now() - started).toBeLessThan(1_000);
  });
});
