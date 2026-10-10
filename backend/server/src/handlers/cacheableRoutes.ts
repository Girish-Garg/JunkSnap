import type { CacheScope } from "./ConditionalGets.js";

// GET routes that answer with an ETag and 304 to a matching If-None-Match (contracts/README.md, Conditional reads).
// A new cacheable route is one more line here.
export const CACHEABLE_ROUTES: Readonly<Record<string, CacheScope>> = {
  "/sites": "public",
  "/sites/:id": "public",
  "/areas/:kind": "public",
  "/areas/:kind/:id/scores": "public",
  "/reports/:id": "private",
  "/scans/:id": "private",
};
