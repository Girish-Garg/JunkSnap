import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { JsonLoggerFactory } from "../src/adapters/JsonLoggerFactory.js";
import { ConfigError, NotFoundError, ValidationError } from "../src/domain/errors.js";
import { createApp } from "../src/handlers/web.js";
import { CoreSettings } from "../src/settings/CoreSettings.js";
import { LogSink } from "./LogSink.js";

const failingRoutes: FastifyPluginAsync = async (app) => {
  app.get("/missing", async () => {
    throw new NotFoundError("No site with that id");
  });
  app.get("/invalid", async () => {
    throw new ValidationError("bbox must have four numbers");
  });
  app.get("/crash", async () => {
    throw new Error("table junksnap-dev-sites is unreachable");
  });
  const body = { type: "object", required: ["vote"], properties: { vote: { type: "string" } } };
  app.post("/votes", { schema: { body } }, async () => ({ ok: true }));
};

let app: FastifyInstance | undefined;
let sink: LogSink;

async function start(env: Record<string, string>): Promise<FastifyInstance> {
  const settings = CoreSettings.fromEnv(env);
  sink = new LogSink();
  const logger = new JsonLoggerFactory(sink).create({ service: "api", stage: settings.stage });
  app = await createApp(settings, [failingRoutes], logger);
  return app;
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("GET /healthz", () => {
  it("returns ok with a request id header", async () => {
    const response = await (await start({ JUNKSNAP_STAGE: "dev" })).inject({ url: "/healthz" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    expect(response.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("error shape", () => {
  it.each([
    ["/missing", 404, "not_found", "No site with that id"],
    ["/invalid", 400, "bad_request", "bbox must have four numbers"],
    ["/nowhere", 404, "not_found", "No route for GET /nowhere"],
  ])("GET %s returns %i %s", async (url, status, error, message) => {
    const response = await (await start({ JUNKSNAP_STAGE: "dev" })).inject({ url });
    expect(response.statusCode).toBe(status);
    expect(response.json()).toEqual({ error, message });
  });

  it("hides 500 details from the client and logs them with the request id", async () => {
    const response = await (await start({ JUNKSNAP_STAGE: "dev" })).inject({
      url: "/crash",
      headers: { "x-request-id": "req-test-1" },
    });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({ error: "server_error" });
    expect(response.body).not.toContain("unreachable");
    const failure = sink.records().find((record) => record.message === "request failed");
    expect(failure).toMatchObject({ level: "ERROR", request_id: "req-test-1", service: "api", stage: "dev" });
    expect(failure?.error).toContain("unreachable");
  });

  it.each([
    ["schema validation", { "content-type": "application/json" }, JSON.stringify({ vote: {} })],
    ["missing field", { "content-type": "application/json" }, JSON.stringify({})],
    ["broken JSON", { "content-type": "application/json" }, "{"],
  ])("maps a Fastify %s error to 400 bad_request", async (_case, headers, payload) => {
    const response = await (await start({ JUNKSNAP_STAGE: "dev" })).inject({
      method: "POST",
      url: "/votes",
      headers,
      payload,
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "bad_request" });
  });
});

describe("CORS", () => {
  const preflight = (origin: string) => ({
    method: "OPTIONS" as const,
    url: "/healthz",
    headers: { origin, "access-control-request-method": "GET" },
  });

  it("allows any origin in dev when CORS_ORIGINS is unset", async () => {
    const response = await (await start({ JUNKSNAP_STAGE: "dev" })).inject(preflight("http://localhost:5173"));
    expect(response.headers["access-control-allow-origin"]).toBe("*");
  });

  it("allows only the listed origins in demo", async () => {
    const env = { JUNKSNAP_STAGE: "demo", CORS_ORIGINS: "https://app.example.org" };
    const allowed = await (await start(env)).inject(preflight("https://app.example.org"));
    expect(allowed.headers["access-control-allow-origin"]).toBe("https://app.example.org");
    const other = await app?.inject(preflight("https://elsewhere.example.org"));
    expect(other?.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("allows DELETE from a listed origin, for withdrawing a report", async () => {
    const env = { JUNKSNAP_STAGE: "demo", CORS_ORIGINS: "https://app.example.org" };
    const request = { ...preflight("https://app.example.org"), headers: { origin: "https://app.example.org", "access-control-request-method": "DELETE" } };
    const response = await (await start(env)).inject(request);
    expect(response.headers["access-control-allow-methods"]).toContain("DELETE");
  });

  it("refuses to build the api in demo without CORS_ORIGINS", async () => {
    await expect(start({ JUNKSNAP_STAGE: "demo" })).rejects.toThrow(ConfigError);
  });
});
