import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import { EntryPoint } from "../src/handlers/EntryPoint.js";
import { runScores } from "../src/handlers/scores.js";
import { serveApi } from "../src/handlers/web.js";
import { runWorker } from "../src/handlers/worker.js";
import { LogSink } from "./LogSink.js";

const DEMO_WITHOUT_CORS = { JUNKSNAP_STAGE: "demo" };

function entry(service: "api" | "worker" | "scores") {
  const sink = new LogSink();
  const exit: Pick<NodeJS.Process, "exitCode"> = { exitCode: undefined };
  return { sink, exit, point: new EntryPoint({ service, destination: sink, exit }) };
}

describe("EntryPoint", () => {
  it("runs scores in demo without CORS_ORIGINS", async () => {
    const { sink, exit, point } = entry("scores");
    const job = { run: async () => ({ sites: 0, areas: 0 }) };
    await point.run(DEMO_WITHOUT_CORS, (context) => runScores(context, async () => job));
    expect(exit.exitCode).toBeUndefined();
    expect(sink.records()).toEqual([expect.objectContaining({ level: "INFO", service: "scores", stage: "demo" })]);
  });

  it("runs the worker in demo without CORS_ORIGINS until SIGTERM", async () => {
    const { sink, exit, point } = entry("worker");
    const signals = new EventEmitter();
    const done = point.run(DEMO_WITHOUT_CORS, (context) => runWorker(context, signals));
    signals.emit("SIGTERM");
    await done;
    expect(exit.exitCode).toBeUndefined();
    expect(sink.records().map((record) => record.message)).toEqual([
      "worker started",
      "worker stopping",
      "worker stopped",
    ]);
  });

  it("turns a settings failure into one JSON error line and exit code 1", async () => {
    const { sink, exit, point } = entry("scores");
    await point.run({}, runScores);
    expect(exit.exitCode).toBe(1);
    const [line, ...rest] = sink.records();
    expect(rest).toEqual([]);
    expect(line).toMatchObject({ level: "ERROR", service: "scores", stage: "unset", message: "scores failed" });
    expect(line?.error).toContain("JUNKSNAP_STAGE");
  });

  it("stops the api from starting in demo without CORS_ORIGINS", async () => {
    const { sink, exit, point } = entry("api");
    await point.run(DEMO_WITHOUT_CORS, serveApi);
    expect(exit.exitCode).toBe(1);
    expect(sink.records()[0]).toMatchObject({ level: "ERROR", service: "api", stage: "demo", message: "api failed" });
    expect(sink.records()[0]?.error).toContain("CORS_ORIGINS");
  });
});
