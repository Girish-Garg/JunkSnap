import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { JsonLoggerFactory } from "../../src/adapters/JsonLoggerFactory.js";
import { validateLetterDraft } from "../../src/contracts/index.gen.js";
import { ConfigError, UnauthorizedError } from "../../src/domain/errors.js";
import { LettersEndpoint, type UserGuard } from "../../src/handlers/letters/LettersEndpoint.js";
import { buildLettersRoutes } from "../../src/handlers/lettersRoutes.js";
import { createApp } from "../../src/handlers/web.js";
import { CoreSettings } from "../../src/settings/CoreSettings.js";
import { LogSink } from "../LogSink.js";
import { DEVICE, FIXTURE_RULES_DIR, letterService, siteWith, USER, wardSite } from "./support.js";

const core = CoreSettings.fromEnv({ JUNKSNAP_STAGE: "dev" });
const jodhpur = wardSite();
const body = { device_token: DEVICE, channel: "local_body", language: "en" };
const sites = [
  jodhpur,
  siteWith(jodhpur, { site_id: "site_jdh_9", verification: "unverified" }),
  siteWith(jodhpur, { site_id: "site_far_1" }, { local_body: null }),
];

let app: FastifyInstance | undefined;
let tempDir: string | undefined;

async function start(routes: FastifyPluginAsync): Promise<FastifyInstance> {
  const logger = new JsonLoggerFactory(new LogSink()).create({ service: "api", stage: "dev" });
  app = await createApp(core, [routes], logger);
  return app;
}

// Stands in for RouteGuard: the bearer token is the user id itself.
const fakeGuard: UserGuard = {
  async requireUser(request) {
    const token = /^Bearer (\S+)$/.exec(request.headers.authorization ?? "")?.[1];
    if (token === undefined) {
      throw new UnauthorizedError("Sign in to do this.");
    }
    return { userId: token };
  },
};

async function withFakes(): Promise<FastifyInstance> {
  return start(new LettersEndpoint(await letterService({ sites }), fakeGuard).plugin());
}

function post(server: FastifyInstance, siteId: string, payload: object = body, user: string | null = USER) {
  const headers = user === null ? {} : { authorization: `Bearer ${user}` };
  return server.inject({ method: "POST", url: `/sites/${siteId}/letters`, payload, headers });
}

afterEach(async () => {
  await app?.close();
  app = undefined;
  if (tempDir !== undefined) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe("POST /sites/{id}/letters", () => {
  it("returns a letter_draft that validates, with verified N of N", async () => {
    const response = await post(await withFakes(), "site_jdh_1");
    expect(response.statusCode).toBe(200);
    const letter = validateLetterDraft(response.json());
    expect(letter.verifier).toEqual({ verified: 3, total: 3 });
    expect(letter.citations.every((citation) => citation.verified)).toBe(true);
  });

  it.each([
    ["no device token", { channel: "local_body", language: "en" }],
    ["a device token that is not a UUID", { ...body, device_token: "abc" }],
    ["an unknown channel", { ...body, channel: "twitter" }],
    ["a language other than en or hi", { ...body, language: "fr" }],
  ])("returns 400 bad_request for %s", async (_name, payload) => {
    const response = await post(await withFakes(), "site_jdh_1", payload);
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "bad_request" });
  });

  it("returns 400 bad_request for a channel that does not fit the site", async () => {
    const response = await post(await withFakes(), "site_jdh_1", { ...body, channel: "pollution_board" });
    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain("pollution_board");
  });

  it.each(["site_none_1", "SITE-1"])("returns 404 not_found for %s", async (siteId) => {
    const response = await post(await withFakes(), siteId);
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: "not_found" });
  });

  it("returns 409 not_verified for a site waiting for a neighbour check", async () => {
    const response = await post(await withFakes(), "site_jdh_9");
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: "not_verified" });
  });

  it("returns 422 no_local_body when there is no local body to address", async () => {
    const response = await post(await withFakes(), "site_far_1");
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ error: "no_local_body" });
  });

  it("returns 401 unauthorized without a sign-in token, before reading anything else", async () => {
    const response = await post(await withFakes(), "SITE-1", {}, null);
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: "unauthorized" });
  });

  it("counts the signed-in user across devices", async () => {
    const server = await withFakes();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await post(server, "site_jdh_1")).statusCode).toBe(200);
    }
    const otherDevice = { ...body, device_token: "0b9c8d7e-6f5a-4b3c-8d2e-1f0a9b8c7d6e" };
    expect((await post(server, "site_jdh_1", otherDevice)).json()).toMatchObject({ error: "rate_limited" });
    expect((await post(server, "site_jdh_1", otherDevice, "another-user")).statusCode).toBe(200);
  });

  it("returns 429 rate_limited on the sixth letter in an hour from one device", async () => {
    const server = await withFakes();
    const codes = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      codes.push((await post(server, "site_jdh_1")).statusCode);
    }
    expect(codes).toEqual([200, 200, 200, 200, 200, 429]);
    expect((await post(server, "site_jdh_1")).json()).toMatchObject({ error: "rate_limited" });
  });
});

describe("buildLettersRoutes", () => {
  const env = (assetsDir: string) => ({
    JUNKSNAP_STAGE: "dev",
    ASSETS_DIR: assetsDir,
    SITES_TABLE: "junksnap-dev-sites",
    DEVICES_TABLE: "junksnap-dev-devices",
    USERS_TABLE: "junksnap-dev-users",
    SCORES_TABLE: "junksnap-dev-scores",
    COGNITO_USER_POOL_ID: "ap-south-1_TestPool1",
    COGNITO_CLIENT_ID: "test-client-id",
  });

  it("loads the rule book from ASSETS_DIR and serves the route behind sign-in", async () => {
    const server = await start(buildLettersRoutes({ core, env: env(join(FIXTURE_RULES_DIR, "..")) }));
    const response = await post(server, "site_jdh_1", body, null);
    expect(response.statusCode).toBe(401);
  });

  it("refuses to start without its settings", async () => {
    await expect(start(buildLettersRoutes({ core, env: { JUNKSNAP_STAGE: "dev" } }))).rejects.toThrow(/ASSETS_DIR/);
  });

  it("refuses to start when a stored text no longer matches its SHA-256", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "server-22-letters-"));
    await cp(FIXTURE_RULES_DIR, join(tempDir, "rules"), { recursive: true });
    await writeFile(join(tempDir, "rules", "texts", "sample_rules_en.txt"), "=== PDF page 3 ===\nedited\n");
    const failure = start(buildLettersRoutes({ core, env: env(tempDir) }));
    await expect(failure).rejects.toThrow(ConfigError);
    await expect(failure).rejects.toThrow(/does not match rules.json/);
  });

  it("refuses to start when a rule's document or hash differs from its text entry", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "server-22-letters-"));
    await cp(FIXTURE_RULES_DIR, join(tempDir, "rules"), { recursive: true });
    const rulesPath = join(tempDir, "rules", "rules.json");
    const rules = (await readFile(rulesPath, "utf8")).replace(`"f1f1f1f1${"f1".repeat(28)}"`, `"${"0".repeat(64)}"`);
    await writeFile(rulesPath, rules);
    await expect(start(buildLettersRoutes({ core, env: env(tempDir) }))).rejects.toThrow(
      "rules.json: fx-dumpsites does not match the text entry for texts/sample_rules_en.txt",
    );
  });

  it("refuses to start when a rule's quote is not word for word on its page", async () => {
    tempDir = await mkdtemp(join(tmpdir(), "server-22-letters-"));
    await cp(FIXTURE_RULES_DIR, join(tempDir, "rules"), { recursive: true });
    const rulesPath = join(tempDir, "rules", "rules.json");
    const rules = (await readFile(rulesPath, "utf8")).replace("hot spots for littering", "hot spots of littering");
    await writeFile(rulesPath, rules);
    await expect(start(buildLettersRoutes({ core, env: env(tempDir) }))).rejects.toThrow(
      "Quotes not found word for word on their page: fx-hot-spots",
    );
  });
});
