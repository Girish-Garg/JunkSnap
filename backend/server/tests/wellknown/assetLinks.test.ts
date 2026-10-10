import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { JsonLoggerFactory } from "../../src/adapters/JsonLoggerFactory.js";
import { ConfigError } from "../../src/domain/errors.js";
import { buildWellKnownRoutes } from "../../src/handlers/wellKnownRoutes.js";
import { createApp } from "../../src/handlers/web.js";
import { AndroidAppSettings } from "../../src/settings/AndroidAppSettings.js";
import { CoreSettings } from "../../src/settings/CoreSettings.js";
import type { Env } from "../../src/settings/utils.js";
import { LogSink } from "../LogSink.js";

const RELEASE = "B8:60:4A:F2:0A:0A:F9:1D:E4:A9:1B:BF:18:1E:27:01:FE:AB:E1:6C:44:01:87:EF:24:35:A5:FB:03:2D:A2:D8";
const OTHER = "00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF";

let app: FastifyInstance | undefined;

async function get(env: Env) {
  const core = CoreSettings.fromEnv({ JUNKSNAP_STAGE: "dev" });
  const logger = new JsonLoggerFactory(new LogSink()).create({ service: "api", stage: "dev" });
  app = await createApp(core, [buildWellKnownRoutes({ core, env })], logger);
  return app.inject({ url: "/.well-known/assetlinks.json" });
}

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("GET /.well-known/assetlinks.json", () => {
  it.each([{}, { ANDROID_CERT_SHA256: "" }, { ANDROID_CERT_SHA256: " , " }])("answers 404 when no fingerprint is set (%o)", async (env) => {
    const response = await get(env);
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: "not_found" });
  });

  it("vouches for the release key's app", async () => {
    const response = await get({ ANDROID_CERT_SHA256: RELEASE });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(response.headers["cache-control"]).toBe("public, max-age=3600");
    expect(response.json()).toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: { namespace: "android_app", package_name: "com.junksnap.app", sha256_cert_fingerprints: [RELEASE] },
      },
    ]);
  });
});

describe("AndroidAppSettings", () => {
  it("reads several fingerprints in either case, with or without colons", () => {
    const bare = OTHER.replace(/:/g, "").toLowerCase();
    expect(AndroidAppSettings.fromEnv({ ANDROID_CERT_SHA256: `${RELEASE.toLowerCase()}, ${bare}` }).certFingerprints).toEqual([RELEASE, OTHER]);
  });

  it.each(["B8:60:4A", `${RELEASE}:00`, `${RELEASE.replace(/:/g, "")}0`, RELEASE.replace("B8", "G8")])("refuses %s", (value) => {
    expect(() => AndroidAppSettings.fromEnv({ ANDROID_CERT_SHA256: value })).toThrow(ConfigError);
  });

  it("names the app's package", () => {
    expect(AndroidAppSettings.fromEnv({}).packageName).toBe("com.junksnap.app");
  });
});
