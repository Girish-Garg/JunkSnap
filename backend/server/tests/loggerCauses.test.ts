import { describe, expect, it } from "vitest";
import { JsonLoggerFactory } from "../src/adapters/JsonLoggerFactory.js";
import { ExternalServiceError } from "../src/domain/errors.js";
import { LogSink } from "./LogSink.js";

function logged(error: unknown): string {
  const sink = new LogSink();
  new JsonLoggerFactory(sink).create({ service: "worker", stage: "dev" }).error({ error }, "failed");
  return String(sink.records()[0]?.error);
}

describe("JsonLoggerFactory error chain", () => {
  it("logs every cause under the error key, outermost first", () => {
    const sdk = new Error("AccessDeniedException: not authorized", { cause: "HTTP 403" });
    const text = logged(new ExternalServiceError("Rekognition failed", { cause: sdk }));
    expect(text).toMatch(/^ExternalServiceError: Rekognition failed\n\s+at /);
    expect(text).toContain("\nCaused by: Error: AccessDeniedException: not authorized\n");
    expect(text).toMatch(/\nCaused by: HTTP 403$/);
  });

  it("logs an error without a cause as its stack only", () => {
    const text = logged(new Error("boom"));
    expect(text).toMatch(/^Error: boom\n\s+at /);
    expect(text).not.toContain("Caused by");
  });

  it("stops after ten causes when the chain loops", () => {
    const first = new Error("first");
    const second = new Error("second", { cause: first });
    first.cause = second;
    expect(logged(first).match(/Caused by: /g)).toHaveLength(10);
  });

  it("logs a thrown non-error as text", () => {
    expect(logged("plain failure")).toBe("plain failure");
  });
});
