import { describe, expect, it } from "vitest";
import {
  ConfigError,
  ExternalServiceError,
  JunkSnapError,
  NotFoundError,
  ValidationError,
  type ErrorCode,
} from "../src/domain/errors.js";
import { HttpErrorMapper } from "../src/handlers/HttpErrorMapper.js";

// The pattern a task uses for a specific contract code.
class AreaNotFoundError extends NotFoundError {
  override readonly code: ErrorCode = "area_not_found";
}

describe("domain errors", () => {
  it.each([
    [new ValidationError("x"), 400, "bad_request"],
    [new NotFoundError("x"), 404, "not_found"],
    [new AreaNotFoundError("x"), 404, "area_not_found"],
    [new ConfigError("x"), 500, "server_error"],
    [new ExternalServiceError("x"), 500, "server_error"],
  ])("%s maps to %i %s", (error, status, code) => {
    expect(error).toBeInstanceOf(JunkSnapError);
    expect(error.status).toBe(status);
    expect(error.code).toBe(code);
  });

  it("names the error after its class and keeps the cause", () => {
    const cause = new Error("AccessDenied");
    const error = new ExternalServiceError("Rekognition failed", { cause });
    expect(error.name).toBe("ExternalServiceError");
    expect(error.cause).toBe(cause);
  });
});

describe("HttpErrorMapper", () => {
  const mapper = new HttpErrorMapper();

  it("uses the domain status, code and message for client errors", () => {
    expect(mapper.map(new AreaNotFoundError("No scores for ward w99"))).toEqual({
      status: 404,
      body: { error: "area_not_found", message: "No scores for ward w99" },
    });
  });

  it("hides the message of a domain 500", () => {
    const response = mapper.map(new ExternalServiceError("secret table name"));
    expect(response.status).toBe(500);
    expect(response.body.error).toBe("server_error");
    expect(response.body.message).not.toContain("secret");
  });

  it("maps a framework 4xx to 400 bad_request", () => {
    const error = Object.assign(new Error("body must be object"), { statusCode: 415 });
    expect(mapper.map(error)).toEqual({ status: 400, body: { error: "bad_request", message: "body must be object" } });
  });

  it.each([new Error("boom"), "a string", undefined])("maps anything else (%s) to 500 server_error", (thrown) => {
    expect(mapper.map(thrown)).toMatchObject({ status: 500, body: { error: "server_error" } });
  });
});
