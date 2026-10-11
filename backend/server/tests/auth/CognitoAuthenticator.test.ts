import { FetchError, JwtExpiredError } from "aws-jwt-verify/error";
import { describe, expect, it } from "vitest";
import { CognitoAuthenticator } from "../../src/adapters/CognitoAuthenticator.js";
import {
  ConfigError,
  ExternalServiceError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "../../src/domain/errors.js";
import { HttpErrorMapper } from "../../src/handlers/HttpErrorMapper.js";
import { AuthSettings } from "../../src/settings/AuthSettings.js";
import { FakeJwksFetcher } from "./FakeJwksFetcher.js";
import { CLIENT_ID, ISSUER, POOL_ID, TokenMinter, USER_SUB } from "./TokenMinter.js";

const ENV = { COGNITO_USER_POOL_ID: POOL_ID, COGNITO_CLIENT_ID: CLIENT_ID, USERS_TABLE: "junksnap-dev-users" };
const pool = { userPoolId: POOL_ID, clientId: CLIENT_ID };
const minter = new TokenMinter();
const authenticator = new CognitoAuthenticator(pool, new FakeJwksFetcher(minter.jwks()).cache());
const now = () => Math.floor(Date.now() / 1000);

describe("CognitoAuthenticator", () => {
  it("returns only the user id (sub) for a valid ID token", async () => {
    await expect(authenticator.verify(minter.idToken())).resolves.toEqual({ userId: USER_SUB });
  });

  it("downloads the pool JWKS once and reuses it", async () => {
    const fetcher = new FakeJwksFetcher(minter.jwks());
    const cached = new CognitoAuthenticator(pool, fetcher.cache());
    await cached.verify(minter.idToken());
    await cached.verify(minter.idToken());
    expect(fetcher.uris).toEqual([`${ISSUER}/.well-known/jwks.json`]);
  });

  it("turns a JWKS download failure into 500 ExternalServiceError and keeps the FetchError", async () => {
    const offline = new CognitoAuthenticator(pool, new FakeJwksFetcher().cache());
    const error = await offline.verify(minter.idToken()).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(ExternalServiceError);
    expect(error).toMatchObject({ status: 500, code: "server_error" });
    expect((error as Error).cause).toBeInstanceOf(FetchError);
  });

  it("rejects an expired token with 401 and says it expired", async () => {
    const rejected = authenticator.verify(minter.idToken({ exp: now() - 60 }));
    await expect(rejected).rejects.toThrow(UnauthorizedError);
    const error = await rejected.catch((thrown: unknown) => thrown);
    expect(error).toMatchObject({ status: 401, code: "unauthorized", message: expect.stringContaining("expired") });
    expect((error as Error).cause).toBeInstanceOf(JwtExpiredError);
  });

  it.each([
    ["wrong audience", { aud: "some-other-client" }],
    ["wrong issuer", { iss: "https://cognito-idp.ap-south-1.amazonaws.com/ap-south-1_OtherPool" }],
    ["an access token", { token_use: "access" }],
    ["a token from the future", { nbf: now() + 600 }],
    ["no sub", { sub: undefined }],
  ])("rejects %s with 401 unauthorized", async (_case, claims) => {
    const rejected = authenticator.verify(minter.idToken(claims));
    await expect(rejected).rejects.toThrow(UnauthorizedError);
    await expect(rejected).rejects.toMatchObject({ status: 401 });
  });

  it("rejects a token signed by another key with the same kid", async () => {
    const forged = new TokenMinter().idToken();
    await expect(authenticator.verify(forged)).rejects.toThrow(UnauthorizedError);
  });

  it.each(["not-a-jwt", "a.b.c", ""])("rejects the malformed token %j", async (token) => {
    await expect(authenticator.verify(token)).rejects.toThrow(UnauthorizedError);
  });
});

describe("AuthSettings", () => {
  it("reads the pool and client id", () => {
    expect(AuthSettings.fromEnv(ENV)).toMatchObject(pool);
  });

  it.each([
    [{}, /COGNITO_USER_POOL_ID/],
    [{ COGNITO_USER_POOL_ID: POOL_ID }, /COGNITO_CLIENT_ID/],
    [{ ...ENV, COGNITO_USER_POOL_ID: "TestPool1" }, /ap-south-1_AbCdEf123/],
  ])("fails with ConfigError for %j", (env, message) => {
    expect(() => AuthSettings.fromEnv(env)).toThrow(ConfigError);
    expect(() => AuthSettings.fromEnv(env)).toThrow(message);
  });
});

describe("auth errors", () => {
  it.each([
    ["a missing or bad token", new UnauthorizedError("Sign in to do this."), 401, "unauthorized"],
    ["a user blocked in the users table", new ForbiddenError("This account is blocked."), 403, "forbidden"],
    ["a signed-in user who does not own the item", new NotFoundError("No report with that id."), 404, "not_found"],
  ])("%s gets %i %s, with its message", (_case, error, status, code) => {
    expect(new HttpErrorMapper().map(error)).toEqual({ status, body: { error: code, message: error.message } });
  });
});
