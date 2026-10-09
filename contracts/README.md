# Contracts

This folder is the source of truth for every shape, route, table, S3 key, queue and environment variable that crosses a workload or package boundary. Code mirrors these definitions and never redefines them. To change one, use a `contract-<issue>-<slug>` branch whose PR touches only `contracts/`, add a decision file in `docs/decisions/`, and tell the team. Ask before you change a table key or the S3 layout. Shapes for satellite history, the per-area packaging split and the crawled ward record (decision 0137) come in a later contract PR.

## Files and CI

- `schemas/<name>.schema.json`: JSON Schema draft 2020-12. Every object sets `additionalProperties: false`.
- `fixtures/<name>.<sample>.json`: valid examples. Frontend mock mode and every package's contract tests read them.
- CI runs `uv run scripts/validate_contracts.py`. It checks that every schema is valid, every fixture matches its schema and every schema has a fixture. It does not assert `format` (date-time, uri), so contract tests must check formats themselves.

| Schema | Produced by | Read by |
|---|---|---|
| `report_upload` | frontend | api (body of `POST /reports`), worker |
| `moderation_result` | worker, for report (`rpt_`) and cleanup (`cln_`) photos | api (`GET /reports/{id}`) |
| `verification_result` | agent (`POST /internal/verify`), `purpose` report or cleanup | worker, api |
| `brand_label` | agent (`POST /internal/brands`) | worker, which fills `site.brands` |
| `location_lookup` | worker | worker, which copies it into `site.location` |
| `site` | worker (merge, cleanup), api (votes) | frontend map and site panel, agent letters |
| `ward_scores` | `scores` CronJob; worker creates the first zero-count row | api, frontend area page |
| `letter_draft` | agent | frontend letter preview |

## Conventions

- JSON over HTTPS, `snake_case` fields, no version prefix in paths. Times are ISO 8601 UTC ending in `Z`; `as_of` is a plain date.
- Ids are opaque strings: a type prefix plus a lowercase ULID (`upl_`, `rpt_`, `cln_`, `site_`, `ltr_`). A report or cleanup reuses its upload's suffix (`upl_x` becomes `rpt_x` or `cln_x`), so retries are idempotent.
- Area ids use `[a-z0-9-]`. Assembly seat: `<eci-state>-ac-<n>` (`s20-ac-127`). Lok Sabha seat: `<eci-state>-pc-<n>` (`s20-pc-16`). District: `<state>-<district>` (`rajasthan-jodhpur`). Ward: `<local-body-id>-w<n>` (`jodhpur-south-mc-w37`).
- Report types and their contexts: `waste_dump` (`vacant_plot`, `roadside`, `drain`, `other`); `no_bin` (`no_bin`, `no_pickup`); `contaminated_water` (`stagnant`, `sewage`, `foam`, `choked_drain`); `open_construction` (`uncovered_debris`, `dusty_site`). The schemas enforce the pairs.
- Every model decision records `provider` (`bedrock`, `openai`, `openrouter`, `rekognition`, `comprehend`, `junksnap`), `model` and `version`. `junksnap` means our own model or template. Originals go only to Rekognition; only blurred images go to any other model.
- Representatives are offices and seats only (decision 0137): no names, no party.
- There is no login. The app's `device_token` (a random UUID v4 kept in IndexedDB) keys reputation, rate limits, votes and letters.
- Errors return an HTTP status and `{"error": "<code>", "message": "<plain text>"}`. Codes: `bad_request` (400), `bbox_too_large` (400), `own_site` (403), `too_far` (403), `not_found` (404), `area_not_found` (404), `cleanup_pending` (409), `already_cleaned` (409), `not_verified` (409), `no_local_body` (422), `rate_limited` (429), `server_error` (500).
- CORS: `api` and `agent` allow the origins listed in `CORS_ORIGINS`.

## Limits

| Rule | Value | Enforced by |
|---|---|---|
| Fresh timestamp | `captured_at` at most 72 h before `received_at` (room for the offline queue), at most 5 min after it | worker |
| Duplicate | pHash Hamming distance 8 or less to an earlier photo within 100 m | worker |
| Rate limit | Snap: 20 photos per hour per device. Scan: 1 frame per second per device. Letters: 5 per hour per device | api (presign) and worker for photos; agent for letters |
| Votes | voter GPS within 1 km of the site, else 403 `too_far` | api |
| Cleanup photo | GPS within 50 m of the site (`near_site` check) | worker |
| Brand label | readable text and confidence 0.8 or more | agent |
| Area score | at least 10 verified reports (`min_verified_reports`) | scores |

## Routes

There is one base URL: CloudFront, then the ALB, then EKS. The ALB sends `POST /sites/*/letters` to `agent` and every other path to `api`. The CloudFront origin response timeout is 60 s so letters can finish.

| Method and path | Served by | Request | Response | Notes |
|---|---|---|---|---|
| `POST /uploads/presign` | api | presign request | 200 presign response | URL valid for `PRESIGN_TTL_SECONDS` |
| `POST /reports` | api | `report_upload` | 202 `{"report_id", "status": "queued"}` | stores `received_at`, sends an SQS message |
| `GET /reports/{id}` | api | header `X-Device-Token` | 200 report status | 404 unless the token is the reporter's |
| `GET /sites?bbox=minLon,minLat,maxLon,maxLat` | api | none | 200 FeatureCollection of `site` | bbox up to 1 by 1 degree; at most 500 sites, newest first; `rejected` sites left out |
| `GET /sites/{id}` | api | none | 200 `site` | |
| `POST /sites/{id}/votes` | api | vote | 200 vote result | api records the vote and settles the community check; see below |
| `POST /sites/{id}/cleanup` | api | cleanup | 202 cleanup accepted | poll `site.cleanup_status`; 409 `cleanup_pending` or `already_cleaned` |
| `GET /areas/{kind}/{id}/scores` | api | none | 200 `ward_scores` | kind is `ward`, `assembly`, `loksabha` or `district`; an area with sites but no score yet returns 200 with zero counts and every score withheld (`too_few_reports`); an area with no sites returns 404 `area_not_found` |
| `POST /sites/{id}/letters` | agent | letter request | 200 `letter_draft` | up to 60 s; 409 `not_verified` unless `verification` is `verified`; 422 `no_local_body`; 429 `rate_limited`; never filed automatically |
| `GET /healthz` | api, agent | none | 200 `{"ok": true}` | probes and smoke test |

Cluster-internal routes on `agent`. The ALB never routes these; the worker calls them at `AGENT_URL`.

| Method and path | Request | Response |
|---|---|---|
| `POST /internal/verify` | verify request | `verification_result` |
| `POST /internal/brands` | `{"report_id": "rpt_jdh_1", "blurred_key": "media/reports/rpt_jdh_1.jpg"}` | `brand_label[]`, empty when nothing is readable at 0.8 or more |

**Community check.** The api owns it. Each vote has a weight of `0.5 + reputation`, so a new device (reputation 0.5) counts 1.0. While `site.verification` is `community_check`, the api sums the weights of confirm votes and subtracts the weights of reject votes. At +3 or more the site becomes `verified`; at -3 or less it becomes `rejected`. A report's status follows its site's verification once merged. Votes on a settled site still count as corroborations but never change it. The reporter's device gets 403 `own_site`. Each device has one vote per site, and its latest vote counts.

**Cleanup.** The worker moderates and blurs the after-photo (`cln_` id, `near_site` check), then calls `/internal/verify` with `purpose: cleanup`. For a cleanup, `is_clean == (decision == "auto_verified")`, and the schema enforces it. The worker accepts the cleanup only when moderation passed and `is_clean` is true. On acceptance the site's `status` becomes `cleaned` and `cleaned_at` and `cleanup_photo_url` are set. `cleanup_status` goes `checking` to `accepted` or `rejected`, and resets to `none` when the site reopens.

**Letters.** Every citation has `verified: true`, and `verifier.verified` equals `verifier.total` and the number of citations. A draft that fails the quote verifier falls back to the template letter with the same verified citations; an unverified quote never ships.

## Inline bodies

Presign request. `purpose` is `report` or `cleanup`; `sha256` is the lowercase hex digest of the original.

```json
{ "purpose": "report", "content_type": "image/jpeg", "sha256": "361477fa40d0646366e6b4a37679e846f82bfb66b3f791e64428ff5c21aca03c", "device_token": "3f6c2a1e-8b4d-4c7a-9e21-5d0b7f3a6c14" }
```

Presign response. The phone PUTs the bytes with exactly these headers, and S3 rejects bytes that do not match the hash.

```json
{
  "upload_id": "upl_jdh_1",
  "upload_url": "https://junksnap-dev-originals-<account_id>.s3.ap-south-1.amazonaws.com/reports/upl_jdh_1.jpg?X-Amz-...",
  "headers": { "Content-Type": "image/jpeg", "x-amz-checksum-sha256": "<base64 of the same digest>" },
  "expires_at": "2026-10-10T02:19:05Z"
}
```

`GET /reports/{id}` response. `status` is one of `queued`, `processing`, `verified`, `community_check`, `rejected` or `needs_review`. `site_id`, `blurred_url`, `moderation` and `verification` are null until each one exists. Mock mode builds this from the `jdh-1` and `jpr-1` fixtures.

```json
{
  "report_id": "rpt_jdh_1",
  "status": "verified",
  "site_id": "site_jdh_1",
  "blurred_url": "https://d111111abcdef8.cloudfront.net/media/reports/rpt_jdh_1.jpg",
  "report": "<report_upload>",
  "moderation": "<moderation_result or null>",
  "verification": "<verification_result or null>",
  "received_at": "2026-10-10T02:14:52Z",
  "updated_at": "2026-10-10T02:15:10Z"
}
```

`GET /sites?bbox` response: `{"type": "FeatureCollection", "features": [<site>, ...]}`.

Vote request (`vote` is `confirm` or `reject`) and vote result:

```json
{ "device_token": "<uuid>", "vote": "confirm", "gps": { "lat": 26.8531, "lon": 75.8150, "accuracy_m": 10 } }
```

```json
{ "site_id": "site_jpr_1", "votes": { "confirm": 2, "reject": 0 }, "verification": "community_check" }
```

Cleanup request (the photo is presigned first, with `purpose: cleanup`) and its 202 response:

```json
{ "upload_id": "upl_jdh_3c", "device_token": "<uuid>", "sha256": "<64 hex>", "gps": { "lat": 26.2701, "lon": 73.0458, "accuracy_m": 8 }, "captured_at": "2026-10-09T06:20:00Z" }
```

```json
{ "cleanup_id": "cln_jdh_3c", "site_id": "site_jdh_3", "status": "checking" }
```

Letter request: `{"device_token": "<uuid>", "channel": "local_body", "language": "en"}`. `channel` takes the values of `letter_draft.channel`; `language` is `en` or `hi`.

Verify request (worker to agent). `purpose` is `report` or `cleanup`; the agent only ever reads the blurred copy.

```json
{
  "report_id": "rpt_jdh_1",
  "purpose": "report",
  "blurred_key": "media/reports/rpt_jdh_1.jpg",
  "report_type": "waste_dump",
  "context": "vacant_plot",
  "features": { "gps_accuracy_m": 6, "reputation": 0.74, "nearby_verified_reports": 5 }
}
```

Stored embedding at `verification_result.embedding_key`: `{"model": "amazon.titan-embed-image-v1", "dim": 1024, "vector": [0.0123, ...]}`.

## DynamoDB tables

All tables are on-demand and named `junksnap-<stage>-<table>`.

| Table | Partition key | Sort key | GSIs | Holds |
|---|---|---|---|---|
| `reports` | `report_id` | none | `by-site` (`site_id`, `captured_at`); `by-device` (`device_token`, `received_at`) | `report_upload` fields, `received_at`, `status`, `moderation_result`, `verification_result`, brand labels, `site_id` |
| `cleanups` | `cleanup_id` | none | none | `site_id`, `upload_id`, `device_token`, `gps`, `sha256`, `captured_at`, `received_at`, `status`, `moderation_result`, `verification_result` |
| `sites` | `site_id` | none | `by-geohash` (`geohash4`, `last_reported_at`) | `site` properties (full `location`, `cleanup_status`), `lat`, `lon`, `geohash4`, merged report ids; the api builds the Feature |
| `votes` | `site_id` | `device_token` | none | `vote`, `weight`, `voted_at` |
| `devices` | `device_token` | none | none | `reputation`, report counts, `first_seen`, `blocked` |
| `scores` | `area_kind` | `area_id` | none | the latest `ward_scores` per area; the CronJob overwrites it |

For a bbox query, compute the geohash4 cells that cover the bbox, query `by-geohash` once per cell and filter by `lat` and `lon`. To merge, query the report's cell and its neighbours and keep sites within 40 m. The worker writes the full location into the site when merging, and the agent reads it from the sites table. When a site first lands in an area with no `scores` row (its ward, assembly seat, Lok Sabha seat or district), the worker creates a zero-count row for that area with every score withheld, using the area name from `site.location`. The write is conditional and never overwrites, so `GET /areas/{kind}/{id}/scores` always has a source.

## S3 key layout

| Bucket | Key | Holds |
|---|---|---|
| `junksnap-<stage>-originals-<account_id>` (private, SSE-KMS) | `reports/{upload_id}.jpg` | report originals, PUT by presigned URL |
| same | `cleanups/{upload_id}.jpg` | cleanup after-photo originals |
| same | `embeddings/{report_id or cleanup_id}.json` | image embeddings; the agent may write only this prefix |
| `junksnap-<stage>-public-<account_id>` (read through CloudFront) | `media/reports/{report_id}.jpg` | blurred report copies |
| same | `media/cleanups/{cleanup_id}.jpg` | blurred cleanup after-photos |

A public URL is `PUBLIC_BASE_URL + "/" + key`. CloudFront serves `/media/*` from the public bucket, so `PUBLIC_BASE_URL` is the same base URL as the API. Images are JPEG only, and the worker rejects files over 8 MB (`invalid_image`). Originals never become public; they go only to Rekognition, and only blurred images go to any other model.

## SQS

- Queue `junksnap-<stage>-reports`, max receive count 3, then the dead-letter queue `junksnap-<stage>-reports-dlq`. Visibility timeout is 5 minutes.
- Report message: `{"kind": "report", "report_id": "rpt_jdh_1"}`.
- Cleanup message: `{"kind": "cleanup", "cleanup_id": "cln_jdh_3c", "site_id": "site_jdh_3", "upload_id": "upl_jdh_3c", "device_token": "<uuid>", "sha256": "<64 hex>", "gps": {...}, "captured_at": "...", "received_at": "..."}`.
- When `ApproximateReceiveCount` reaches 3, the worker marks the report `needs_review` (or the cleanup `rejected`) before the message moves to the dead-letter queue (decision 0131).

## Environment variables

| Variable | Used by | Value |
|---|---|---|
| `JUNKSNAP_STAGE` | api, agent, worker, scores | `dev` or `demo` |
| `AWS_REGION` | api, agent, worker, scores | `ap-south-1` |
| `REPORTS_TABLE`, `CLEANUPS_TABLE`, `SITES_TABLE`, `VOTES_TABLE`, `DEVICES_TABLE`, `SCORES_TABLE` | api: all; worker: all; scores: reports, sites, scores; agent: sites, devices (letter rate limit) | `junksnap-<stage>-<table>` |
| `ORIGINALS_BUCKET` | api, worker, agent (`embeddings/` only) | `junksnap-<stage>-originals-<account_id>` |
| `PUBLIC_BUCKET` | worker, agent | `junksnap-<stage>-public-<account_id>` |
| `PUBLIC_BASE_URL` | api, worker, agent | CloudFront base URL, no trailing slash |
| `REPORTS_QUEUE_URL` | api, worker | URL of `junksnap-<stage>-reports` |
| `CORS_ORIGINS` | api, agent | comma-separated: the Amplify URL and `http://localhost:5173` |
| `PRESIGN_TTL_SECONDS` | api | `300` |
| `AGENT_URL` | worker | `http://agent` (the Service in the same namespace) |
| `PLACE_INDEX` | worker | `junksnap-<stage>-places` (Amazon Location) |
| `OPENAI_SECRET_ID`, `OPENROUTER_SECRET_ID` | agent | `junksnap/<stage>/openai-api-key`, `junksnap/<stage>/openrouter-api-key` (Secrets Manager, decision 0133) |
| `LLM_TASKS` | agent | optional JSON `{"<task>": {"provider", "model", "fallback": []}}`; defaults live in code |
| `VITE_API_URL` | frontend | the CloudFront base URL, no trailing slash |
| `VITE_API_MODE` | frontend | `mock` (reads `contracts/fixtures/`) or `live` |

## Stages and names

- Stages: `dev` for building, `demo` for the recording. Region `ap-south-1` for everything.
- One EKS Auto Mode cluster, `junksnap`, with namespaces `junksnap-dev` and `junksnap-demo`. Deployments `api`, `agent` and `worker`, plus the CronJob `scores` (every 15 minutes). Containers listen on 8000; Services listen on 80.
- AWS resources are named `junksnap-<stage>-<thing>`; bucket names add `-<account_id>` because S3 names are global; secrets use `junksnap/<stage>/<name>`. Tags: `project=junksnap`, `stage=<stage>`.

## Seed samples

| Sample | City | Site | What it shows |
|---|---|---|---|
| `jdh-1` | Jodhpur | `site_jdh_1`: waste_dump, vacant_plot, open, verified, cleanup checking | the full chain: report, moderation, auto-verified with fixed weights, brand label, location with ward, ward scores, letter |
| `jdh-2` | Jodhpur | `site_jdh_2`: no_bin, no_pickup, open, verified | a no-bin marker |
| `jdh-3` | Jodhpur | `site_jdh_3`: contaminated_water, choked_drain, reopened | an accepted cleanup (`cln_jdh_3c` moderation and verification), then reopened |
| `jpr-1` | Jaipur | `site_jpr_1`: open_construction, uncovered_debris, community check | a Scan frame, meta-learner with disagreement and a stored embedding, no ward map, scores withheld |

All fixture data is sample data. Coordinates are plausible; seat names and codes are illustrative until the location task replaces them; the brand is invented; rule quotes are placeholders. No fixture names a person.

## Shared wording

- Say "verified" only for auto-verified or community-confirmed reports. Otherwise say "waiting for a neighbour check".
- Say "waste site", "reported" and "cleared". Never say "illegal" or "culprit", and never name a person.
- Every Cc line says "for attention". Letters address offices, never people.
- Below the guardrail, say "Not enough verified reports yet (N of 10)". Always show counts, and label Jodhpur data "Pilot city".
- For brands, say "packaging seen at this site", and only when the label is readable with confidence 0.8 or more.
- For letters, say "Draft for you to file". JunkSnap never files anything.
