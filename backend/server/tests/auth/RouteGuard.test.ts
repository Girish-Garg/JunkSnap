import type { FastifyInstance, FastifyPluginAsync } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CognitoAuthenticator } from "../../src/adapters/CognitoAuthenticator.js";
import { JsonLoggerFactory } from "../../src/adapters/JsonLoggerFactory.js";
import { ConfigError } from "../../src/domain/errors.js";
import { RouteGuard } from "../../src/handlers/auth/RouteGuard.js";
import { createApp } from "../../src/handlers/web.js";
import { AuthSettings } from "../../src/settings/AuthSettings.js";
import { CoreSettings } from "../../src/settings/CoreSettings.js";
import { LogSink } from "../LogSink.js";
import { FakeJwksFetcher } from "./FakeJwksFetcher.js";
import { FakeUserStanding } from "./FakeUserStanding.js";
import { CLIENT_ID, POOL_ID, TokenMinter, USER_SUB } from "./TokenMinter.js";

const ENV = { JUNKSNAP_STAGE: "dev", COGNITO_USER_POOL_ID: POOL_ID, COGNITO_CLIENT_ID: CLIENT_ID, USERS_TABLE: "junksnap-dev-users" };
const settings = AuthSettings.fromEnv(ENV);
const minter = new TokenMinter();
const standing = new FakeUserStanding();
const guard = new RouteGuard(new CognitoAuthenticator(settings, new FakeJwksFetcher(minter.jwks()).cache()), standing);
const offlineGuard = new RouteGuard(new CognitoAuthenticator(settings, new FakeJwksFetcher().cache()), standing);
const blockedGuard = new RouteGuard(new CognitoAuthenticator(settings, new FakeJwksFetcher(minter.jwks()).cache()), new FakeUserStanding([USER_SUB]));

// The way a route module uses the guard: required for writes, optional for browsing.
const guardedRoutes: FastifyPluginAsync = async (app) => {
  app.post("/reports", async (request) => ({ user_id: (await guard.requireUser(request)).userId }));
  app.get("/sites", async (request) => ({ user_id: (await guard.optionalUser(request))?.userId ?? null }));
  app.get("/offline", async (request) => ({ user_id: (await offlineGuard.optionalUser(request))?.userId ?? null }));
  app.post("/blocked", async (request) => ({ user_id: (await blockedGuard.requireUser(request)).userId }));
  app.get("/blocked", async (request) => ({ user_id: (await blockedGuard.optionalUser(request))?.userId ?? null }));
};

let app: FastifyInstance;

beforeAll(async () => {
  const logger = new JsonLoggerFactory(new LogSink()).create({ service: "api", stage: "dev" });
  app = await createApp(CoreSettings.fromEnv(ENV), [guardedRoutes], logger);
});

afterAll(async () => {
  await app.close();
});

const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

describe("RouteGuard.requireUser", () => {
  it("lets a valid ID token through as the token's sub", async () => {
    const response = await app.inject({ method: "POST", url: "/reports", headers: bearer(minter.idToken()) });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ user_id: USER_SUB });
  });

  it("returns 401 unauthorized when the header is missing", async () => {
    const response = await app.inject({ method: "POST", url: "/reports" });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "unauthorized", message: "Sign in to do this." });
  });

  it.each([
    ["not a Bearer header", { authorization: "Basic dXNlcjpwYXNz" }],
    ["an empty Bearer header", { authorization: "Bearer " }],
    ["an expired token", bearer(minter.idToken({ exp: Math.floor(Date.now() / 1000) - 60 }))],
    ["a wrong audience", bearer(minter.idToken({ aud: "some-other-client" }))],
    ["a wrong issuer", bearer(minter.idToken({ iss: "https://cognito-idp.ap-south-1.amazonaws.com/ap-south-1_X" }))],
  ])("returns 401 unauthorized for %s", async (_case, headers) => {
    const response = await app.inject({ method: "POST", url: "/reports", headers });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: "unauthorized" });
  });

  it("accepts a lowercase bearer scheme", async () => {
    const headers = { authorization: `bearer ${minter.idToken()}` };
    const response = await app.inject({ method: "POST", url: "/reports", headers });
    expect(response.statusCode).toBe(200);
  });

  it("returns 403 forbidden for a valid token whose user is blocked in the users table", async () => {
    const response = await app.inject({ method: "POST", url: "/blocked", headers: bearer(minter.idToken()) });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "forbidden", message: "This account is blocked." });
  });

  it("checks the token's own user, and lets one without a users row through", async () => {
    const before = standing.reads.length;
    const response = await app.inject({ method: "POST", url: "/reports", headers: bearer(minter.idToken()) });
    expect(response.statusCode).toBe(200);
    expect(standing.reads.slice(before)).toEqual([USER_SUB]);
  });

  it("never reads the users table without a valid token", async () => {
    const before = standing.reads.length;
    await app.inject({ method: "POST", url: "/reports", headers: bearer("not-a-jwt") });
    expect(standing.reads.length).toBe(before);
  });
});

describe("RouteGuard for a blocked user on GET /reports/{id}", () => {
  it("answers 403, never treating the blocked user as a guest", async () => {
    const response = await app.inject({ url: "/blocked", headers: bearer(minter.idToken()) });
    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: "forbidden" });
  });
});

describe("RouteGuard.optionalUser", () => {
  it("treats a request without the header as a guest", async () => {
    const response = await app.inject({ url: "/sites" });
    expect(response.json()).toEqual({ user_id: null });
  });

  it("returns the user for a valid token", async () => {
    const response = await app.inject({ url: "/sites", headers: bearer(minter.idToken()) });
    expect(response.json()).toEqual({ user_id: USER_SUB });
  });

  it.each([
    ["a malformed token", bearer("not-a-jwt")],
    ["an expired token", bearer(minter.idToken({ exp: Math.floor(Date.now() / 1000) - 60 }))],
    ["a wrong audience", bearer(minter.idToken({ aud: "some-other-client" }))],
    ["not a Bearer header", { authorization: "Basic dXNlcjpwYXNz" }],
  ])("treats %s as a guest, so browsing never 401s", async (_case, headers) => {
    const response = await app.inject({ url: "/sites", headers });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ user_id: null });
  });

  it("still fails with 500 when the JWKS cannot be fetched", async () => {
    const response = await app.inject({ url: "/offline", headers: bearer(minter.idToken()) });
    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({ error: "server_error" });
  });
});

describe("RouteGuard.fromEnv", () => {
  it("builds from the Cognito variables without any network call", () => {
    expect(RouteGuard.fromEnv(ENV)).toBeInstanceOf(RouteGuard);
  });

  it("fails with ConfigError when the Cognito variables are missing", () => {
    expect(() => RouteGuard.fromEnv({ JUNKSNAP_STAGE: "dev" })).toThrow(ConfigError);
  });
});
