import { z } from "zod";
import { parseTunables, type Env } from "./utils.js";

const YEAR_SECONDS = 31_536_000;
const seconds = (min: number, max: number, fallback: number) => z.coerce.number().int().min(min).max(max).default(fallback);

const CacheEnv = z.object({
  SHARE_CACHE_MAX_AGE_SECONDS: seconds(0, YEAR_SECONDS, 300),
  ASSETLINKS_CACHE_MAX_AGE_SECONDS: seconds(0, YEAR_SECONDS, 3_600),
  MEDIA_CACHE_MAX_AGE_SECONDS: seconds(0, YEAR_SECONDS, 86_400),
  // Browsers cap a preflight cache at 2 h (Chromium) to 24 h (Firefox).
  CORS_MAX_AGE_SECONDS: seconds(0, 86_400, 600),
  USER_STANDING_CACHE_SECONDS: seconds(1, 3_600, 60),
});

// How long browsers, CloudFront and the api itself may keep an answer.
export class CacheSettings {
  // Cache-Control max-age of the link-preview pages, of /.well-known/assetlinks.json and of blurred public copies.
  readonly shareMaxAgeSeconds: number;
  readonly assetLinksMaxAgeSeconds: number;
  readonly mediaMaxAgeSeconds: number;
  // Access-Control-Max-Age: how long browsers keep a CORS preflight.
  readonly corsMaxAgeSeconds: number;
  // How long the api trusts its last read of whether a user is blocked.
  readonly userStandingMs: number;

  private constructor(values: z.output<typeof CacheEnv>) {
    this.shareMaxAgeSeconds = values.SHARE_CACHE_MAX_AGE_SECONDS;
    this.assetLinksMaxAgeSeconds = values.ASSETLINKS_CACHE_MAX_AGE_SECONDS;
    this.mediaMaxAgeSeconds = values.MEDIA_CACHE_MAX_AGE_SECONDS;
    this.corsMaxAgeSeconds = values.CORS_MAX_AGE_SECONDS;
    this.userStandingMs = values.USER_STANDING_CACHE_SECONDS * 1_000;
    Object.freeze(this);
  }

  static fromEnv(env: Env): CacheSettings {
    return new CacheSettings(parseTunables(CacheEnv, env));
  }

  // A public Cache-Control value.
  static publicFor(maxAgeSeconds: number): string {
    return `public, max-age=${maxAgeSeconds}`;
  }
}
