# backend/server: TypeScript api, worker and scores

One TypeScript project (TypeScript 6.0.3, Node 24), built into one image, `junksnap-server`, that runs three workloads (decision 20261010-0159). How to add routes, settings and errors: `backend/server/README.md`. Layout: docs/working.md section 1.

## Workloads

- `api` (entry `src/handlers/web.ts`): Fastify, every public route in `contracts/README.md`, scans and `POST /sites/{id}/letters` included. Verifies Cognito ID tokens (Auth in `contracts/README.md`).
- `worker` (entry `src/handlers/worker.ts`): long-polls SQS for report, cleanup and scan messages. `ReportPipeline`: moderation and blur, authenticity, `POST /internal/verify` on `ml` at `ML_URL`, brand labels, location and nearby places, site merge with insights. `ScanFrameSampler` turns a scan video into frame reports.
- `scores` (entry `src/handlers/scores.ts`): the CronJob, every 15 minutes: area scores and area insights.

## Commands

```
cd backend/server
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

After any change to `contracts/schemas`, run `npm run gen:contracts` and commit `src/contracts/*.gen.ts` in the same PR; CI fails on stale files. Never edit `.gen.ts` files by hand.

## Rules

- Services never import `@aws-sdk/*` or any other SDK; adapters do. One class per file.
- Shapes come from `contracts/`. Never import `backend/ml`; call it over HTTP only, and send it only the blurred copy's key.
- Auth (decision 20261010-0227): check the token against the pool's JWKS, issuer, `token_use: id`, audience and expiry. `user_id` comes from `sub`, never from a body. Missing or bad token: 401 `unauthorized`; blocked user: 403 `forbidden`. Rate limits and reputation count per user and per device.
- LLM layer: `TaskConfig {provider, model, fallback[]}` as in `ml`. Letters try Bedrock Claude Sonnet 4.6, Claude Haiku 4.5 (India profile), Nova Pro, then OpenAI, then OpenRouter (decision 20261010-0133). Note moderation uses Bedrock Claude Haiku 4.5 (India profile) only; Comprehend is not enabled on this account.
- Location: Amazon Location Places v2 (`geo-places:ReverseGeocode`, no place index). Assembly seat null outside Rajasthan; ward null without an open ward map.
- Letters: code picks the rules and addressees, the model writes only the prose, `QuoteVerifier` checks every quote word for word, `TemplateLetter` is the fallback. Cc only seats that exist, never the MP of an `outdated` Lok Sabha seat. Never filed automatically.
- Presign against the regional S3 endpoint (`s3.ap-south-1.amazonaws.com`).
- Brands: Rekognition DetectText plus the brand-to-parent-company map with a source per row; a label only when readable at confidence 0.8 or more.
- Scans (decision 20261010-0203): one frame per second, GPS by interpolation, drop frames more than 3 s from a fix or worse than 50 m, frame ids derived from the scan id and frame time. Every frame runs the normal pipeline.
- Insights (decision 20261010-0202): merge per `site.insights`; nearby places within 100 m from the crawler's `map_layers`; area shares withheld below 10 verified reports. Only measured numbers.
- Crawl trigger (issue 78): when the merge settles a verified report, `ActivatingReportMerger` adds its id to the district's `crawls` row and queues the district at `CRAWL_ACTIVATE_AFTER` (default 1); a failure only warns. Without `CRAWLS_TABLE` nothing is queued and `GET /areas/district/{id}/crawl` (open) answers `not_started`.
- Ward files: the worker (nearby-place layers, at startup) and scores read, per city, whichever of `<ASSETS_DIR>/wards/<city>.json` and `crawl/wards/<city>.json` in `ORIGINALS_BUCKET` has the newer `generated_at` (`NewestWardFiles`); an S3 failure falls back to the image's files.
- Every model decision records provider, model and version. Steps are idempotent per report id.
- Unit tests stub every AWS and model call. Adapter integration tests run only with `RUN_AWS_TESTS=1`.

## Never

- Send an original or a scan video to any model, or log images, tokens, emails or personal data.
- Let a model choose a rule, an addressee or a quote.
- Invent a number in an insight, a score or a letter.
