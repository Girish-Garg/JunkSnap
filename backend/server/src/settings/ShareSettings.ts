import { z } from "zod";
import type { ShareBases } from "../domain/share/ShareUrls.js";
import type { CoreSettings } from "./CoreSettings.js";
import { parseEnv, type Env } from "./utils.js";

const ShareEnv = z.object({
  PUBLIC_BASE_URL: z.url(),
  WEB_URL: z.url().optional(),
});

// The local web app (npm run dev) when no public origin is configured.
const LOCAL_WEB = "http://localhost:5173";
const LOCAL_HOST = /(^|\.)localhost$|^127\.0\.0\.1$|^\[::1\]$/;

// Link previews (contracts/README.md): WEB_URL, else the first public https origin in CORS_ORIGINS (the stage's web app).
export class ShareSettings implements ShareBases {
  readonly publicBaseUrl: string;
  readonly webUrl: string;

  private constructor(publicBaseUrl: string, webUrl: string) {
    this.publicBaseUrl = publicBaseUrl.replace(/\/+$/, "");
    this.webUrl = webUrl.replace(/\/+$/, "");
  }

  static fromEnv(env: Env, core: CoreSettings): ShareSettings {
    const values = parseEnv(ShareEnv, env);
    return new ShareSettings(values.PUBLIC_BASE_URL, values.WEB_URL ?? ShareSettings.#webOrigin(core.corsOrigins));
  }

  static #webOrigin(origins: readonly string[]): string {
    const isPublic = (origin: string) => URL.canParse(origin) && new URL(origin).protocol === "https:" && !LOCAL_HOST.test(new URL(origin).hostname);
    return origins.find(isPublic) ?? LOCAL_WEB;
  }
}
