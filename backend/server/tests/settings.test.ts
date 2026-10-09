import { describe, expect, it } from "vitest";
import { ConfigError } from "../src/domain/errors.js";
import { CoreSettings } from "../src/settings/CoreSettings.js";

describe("CoreSettings", () => {
  it("reads the stage and defaults the region", () => {
    const settings = CoreSettings.fromEnv({ JUNKSNAP_STAGE: "dev" });
    expect(settings.stage).toBe("dev");
    expect(settings.awsRegion).toBe("ap-south-1");
  });

  it("requires JUNKSNAP_STAGE to be dev or demo", () => {
    expect(() => CoreSettings.fromEnv({})).toThrow(ConfigError);
    expect(() => CoreSettings.fromEnv({ JUNKSNAP_STAGE: "prod" })).toThrow(/JUNKSNAP_STAGE/);
  });

  it("loads in demo without CORS_ORIGINS, as worker and scores need", () => {
    const settings = CoreSettings.fromEnv({ JUNKSNAP_STAGE: "demo" });
    expect(settings.stage).toBe("demo");
    expect(settings.corsOrigins).toEqual([]);
  });

  it("keeps the raw comma-separated origins, trimmed", () => {
    const env = { JUNKSNAP_STAGE: "demo", CORS_ORIGINS: " https://a.example.org , http://localhost:5173 ," };
    expect(CoreSettings.fromEnv(env).corsOrigins).toEqual(["https://a.example.org", "http://localhost:5173"]);
  });
});

describe("CoreSettings.allowedOrigins", () => {
  it.each([undefined, "", "*", "*,http://localhost:5173"])("allows any origin in dev when CORS_ORIGINS=%s", (cors) => {
    expect(CoreSettings.fromEnv({ JUNKSNAP_STAGE: "dev", CORS_ORIGINS: cors }).allowedOrigins()).toBe("*");
  });

  it.each(["dev", "demo"])("returns the listed origins in %s", (stage) => {
    const settings = CoreSettings.fromEnv({ JUNKSNAP_STAGE: stage, CORS_ORIGINS: "https://a.example.org" });
    expect(settings.allowedOrigins()).toEqual(["https://a.example.org"]);
  });

  it.each([undefined, "", "*", "https://a.example.org,*"])("rejects CORS_ORIGINS=%s in demo", (cors) => {
    const settings = CoreSettings.fromEnv({ JUNKSNAP_STAGE: "demo", CORS_ORIGINS: cors });
    expect(() => settings.allowedOrigins()).toThrow(ConfigError);
  });
});
