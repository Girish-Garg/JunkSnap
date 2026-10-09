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

  it("allows any origin in dev when CORS_ORIGINS is unset or *", () => {
    for (const cors of [undefined, "", "*"]) {
      const settings = CoreSettings.fromEnv({ JUNKSNAP_STAGE: "dev", CORS_ORIGINS: cors });
      expect(settings.corsOrigins).toEqual(["*"]);
      expect(settings.allowsAnyOrigin).toBe(true);
    }
  });

  it("splits comma-separated origins and trims them", () => {
    const env = { JUNKSNAP_STAGE: "demo", CORS_ORIGINS: " https://a.example.org , http://localhost:5173 ," };
    const settings = CoreSettings.fromEnv(env);
    expect(settings.corsOrigins).toEqual(["https://a.example.org", "http://localhost:5173"]);
    expect(settings.allowsAnyOrigin).toBe(false);
  });

  it.each([undefined, "", "*", "https://a.example.org,*"])("rejects CORS_ORIGINS=%s in demo", (cors) => {
    expect(() => CoreSettings.fromEnv({ JUNKSNAP_STAGE: "demo", CORS_ORIGINS: cors })).toThrow(ConfigError);
  });
});
