import { describe, expect, it } from "vitest";
import { escapeHtml } from "../../src/handlers/share/ShareHtml.js";
import { CoreSettings } from "../../src/settings/CoreSettings.js";
import { ShareSettings } from "../../src/settings/ShareSettings.js";

const PUBLIC = "https://d111111abcdef8.cloudfront.net/";

function settings(env: Record<string, string>): ShareSettings {
  const all = { JUNKSNAP_STAGE: "dev", PUBLIC_BASE_URL: PUBLIC, ...env };
  return ShareSettings.fromEnv(all, CoreSettings.fromEnv(all));
}

describe("ShareSettings", () => {
  it("uses WEB_URL when set", () => {
    const share = settings({ WEB_URL: "https://web.example/", CORS_ORIGINS: "https://other.example" });
    expect(share.webUrl).toBe("https://web.example");
    expect(share.publicBaseUrl).toBe("https://d111111abcdef8.cloudfront.net");
  });

  it("falls back to the first public https origin in CORS_ORIGINS", () => {
    const origins = "http://localhost:5173,https://tauri.localhost,https://dev.abc.amplifyapp.com";
    expect(settings({ CORS_ORIGINS: origins }).webUrl).toBe("https://dev.abc.amplifyapp.com");
  });

  it("falls back to the local web app without a public origin", () => {
    expect(settings({}).webUrl).toBe("http://localhost:5173");
  });
});

describe("escapeHtml", () => {
  it("escapes the five HTML special characters", () => {
    expect(escapeHtml(`<a href="x">Tom & Jerry's</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;");
  });
});
