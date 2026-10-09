# Contracts

This folder is the source of truth for every shape, route, table, S3 key, queue and environment variable that crosses a workload or package boundary. Code mirrors these definitions and never redefines them. To change one, use a `contract-<issue>-<slug>` branch whose PR touches only `contracts/`, add a decision file in `docs/decisions/`, and tell the team. Ask before you change a table key or the S3 layout.

## Files and CI

- `schemas/<name>.schema.json`: JSON Schema draft 2020-12. Every object sets `additionalProperties: false`.
- `fixtures/<name>.<sample>.json`: valid examples. Frontend mock mode and every package's contract tests read them.
- CI runs `uv run scripts/validate_contracts.py`. It checks that every schema is valid, every fixture matches its schema and every schema has a fixture. It does not assert `format` (date-time, uri), so contract tests must check formats themselves.

| Schema | Produced by | Read by |
|---|---|---|
| `report_upload` | frontend | api (body of `POST /reports`), worker |
| `moderation_result` | worker | api (`GET /reports/{id}`) |
| `verification_result` | agent (`POST /internal/verify`) | worker, api |
| `brand_label` | agent (`POST /internal/brands`) | worker, which fills `site.brands` |
| `location_lookup` | worker | worker (fills `site.location`), agent letters |
| `site` | worker (merge), api | frontend map and site panel, agent letters |
| `ward_scores` | `scores` CronJob | api, frontend area page |
| `letter_draft` | agent | frontend letter preview |

## Conventions

- JSON over HTTPS, `snake_case` fields, no version prefix in paths. Times are ISO 8601 UTC ending in `Z`; `as_of` is a plain date.
- Ids are opaque strings: a type prefix plus a lowercase ULID (`upl_`, `rpt_`, `site_`, `ltr_`). A report reuses its upload's suffix (`upl_x` becomes `rpt_x`), so a retried `POST /reports` returns the same report.
- Area ids use `[a-z0-9-]`. Assembly seat: `<eci-state>-ac-<n>` (`s20-ac-127`). Lok Sabha seat: `<eci-state>-pc-<n>` (`s20-pc-16`). District: `<state>-<district>` (`rajasthan-jodhpur`). Ward: `<local-body-id>-w<n>` (`jodhpur-south-mc-w37`).
- Report types and their contexts: `waste_dump` (`vacant_plot`, `roadside`, `drain`, `other`); `no_bin` (`no_bin`, `no_pickup`); `contaminated_water` (`stagnant`, `sewage`, `foam`, `choked_drain`); `open_construction` (`uncovered_debris`, `dusty_site`). The schemas enforce the pairs.
- Every model decision records `provider` (`bedrock`, `openai`, `openrouter`, `rekognition`, `comprehend`, `junksnap`), `model` and `version`. `junksnap` means our own model or template.
- There is no login. The app's `device_token` (a random UUID v4 kept in IndexedDB) keys reputation, rate limits and votes.
- Errors return an HTTP status and `{"error": "<code>", "message": "<plain text>"}`. Codes: `bad_request` (400), `bbox_too_large` (400), `own_site` (403), `not_found` (404), `rate_limited` (429), `server_error` (500).
- CORS: `api` and `agent` allow the origins listed in `CORS_ORIGINS`.

## Routes

There is one base URL: CloudFront, then the ALB, then EKS. The ALB sends `POST /sites/*/letters` to `agent` and every other path to `api`.

| Method and path | Served by | Request | Response | Notes |
|---|---|---|---|---|
| `POST /uploads/presign` | api | presign request | 200 presign response | URL valid for `PRESIGN_TTL_SECONDS` |
| `POST /reports` | api | `report_upload` | 202 `{"report_id", "status": "queued"}` | sends an SQS message |
| `GET /reports/{id}` | api | header `X-Device-Token` | 200 report status | 404 unless the token is the reporter's |
| `GET /sites?bbox=minLon,minLat,maxLon,maxLat` | api | none | 200 FeatureCollection of `site` | bbox up to 1 by 1 degree; at most 500 sites, newest first |
| `GET /sites/{id}` | api | none | 200 `site` | |
| `POST /sites/{id}/votes` | api | vote | 200 vote result | one vote per device per site, the latest counts; reporters get 403 `own_site` |
| `POST /sites/{id}/cleanup` | api | cleanup | 202 cleanup accepted | the worker checks the after-photo, then sets `status: cleaned` |
| `GET /areas/{kind}/{id}/scores` | api | none | 200 `ward_scores` | kind is `ward`, `assembly`, `loksabha` or `district` |
| `POST /sites/{id}/letters` | agent | letter request | 200 `letter_draft` | synchronous, up to about 30 s; never filed automatically |
| `GET /healthz` | api, agent | none | 200 `{"ok": true}` | probes and smoke test |

Cluster-internal routes on `agent`. The ALB never routes these; the worker calls them at `AGENT_URL`.

| Method and path | Request | Response |
|---|---|---|
| `POST /internal/verify` | verify request | `verification_result` |
| `POST /internal/brands` | `{"report_id": "rpt_jdh_1", "blurred_key": "media/reports/rpt_jdh_1.jpg"}` | `brand_label[]`, empty when nothing is readable above the threshold |

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
  "updated_at": "2026-10-10T02:15:10Z"
}
```

`GET /sites?bbox` response: `{"type": "FeatureCollection", "features": [<site>, ...]}`.

Vote request `{"device_token": "<uuid>", "vote": "confirm"}`, where `vote` is `confirm` or `reject`. Vote result:

```json
{ "site_id": "site_jpr_1", "votes": { "confirm": 2, "reject": 0 }, "verification": "community_check" }
```

Cleanup request (the photo is presigned first, with `purpose: cleanup`) and its 202 response:

```json
{ "upload_id": "upl_jdh_3c", "device_token": "<uuid>", "sha256": "<64 hex>", "gps": { "lat": 26.2701, "lon": 73.0458, "accuracy_m": 8 }, "captured_at": "2026-10-09T06:20:00Z" }
```

```json
{ "site_id": "site_jdh_3", "upload_id": "upl_jdh_3c", "status": "checking" }
```

Letter request `{"channel": "local_body", "language": "en"}`. `channel` takes the values of `letter_draft.channel`; `language` is `en` or `hi`.

Verify request (worker to agent). The agent only ever reads the blurred copy.

```json
{
  "report_id": "rpt_jdh_1",
  "blurred_key": "media/reports/rpt_jdh_1.jpg",
  "report_type": "waste_dump",
  "context": "vacant_plot",
  "features": { "gps_accuracy_m": 6, "reputation": 0.74, "nearby_verified_reports": 5 }
}
```

## DynamoDB tables

All tables are on-demand and named `junksnap-<stage>-<table>`.

| Table | Partition key | Sort key | GSIs | Holds |
|---|---|---|---|---|
| `reports` | `report_id` | none | `by-site` (`site_id`, `captured_at`); `by-device` (`device_token`, `captured_at`) | `report_upload` fields, `status`, `moderation_result`, `verification_result`, brand labels, `site_id` |
| `sites` | `site_id` | none | `by-geohash` (`geohash4`, `last_reported_at`) | `site` properties plus `lat`, `lon` and `geohash4`; the api builds the Feature |
| `votes` | `site_id` | `device_token` | none | `vote`, `weight` (reputation), `voted_at` |
| `devices` | `device_token` | none | none | `reputation`, report counts, `first_seen`, `blocked` |
| `scores` | `area_kind` | `area_id` | none | the latest `ward_scores` per area |

For a bbox query, compute the geohash4 cells that cover the bbox, query `by-geohash` once per cell and filter by `lat` and `lon`. To merge, query the report's cell and its neighbours and keep sites within 40 m.

## S3 key layout

| Bucket | Key | Holds |
|---|---|---|
| `junksnap-<stage>-originals-<account_id>` (private, SSE-KMS) | `reports/{upload_id}.jpg` | report originals, PUT by presigned URL |
| same | `cleanups/{upload_id}.jpg` | cleanup after-photo originals |
| `junksnap-<stage>-public-<account_id>` (read through CloudFront) | `media/reports/{report_id}.jpg` | blurred report copies (`moderation_result.blurred_key`) |
| same | `media/cleanups/{upload_id}.jpg` | blurred cleanup after-photos |

A public URL is `PUBLIC_BASE_URL + "/" + key`. CloudFront serves `/media/*` from the public bucket, so `PUBLIC_BASE_URL` is the same base URL as the API. Images are JPEG only, and the worker rejects files over 8 MB. Originals never become public and never go to OpenRouter.

## SQS

- Queue `junksnap-<stage>-reports`; after 3 receives a message moves to `junksnap-<stage>-reports-dlq`. Visibility timeout is 5 minutes.
- Messages: `{"kind": "report", "report_id": "rpt_jdh_1"}` or `{"kind": "cleanup", "site_id": "site_jdh_3", "upload_id": "upl_jdh_3c"}`.
- A report whose message lands in the dead-letter queue gets status `needs_review`.

## Environment variables

| Variable | Used by | Value |
|---|---|---|
| `JUNKSNAP_STAGE` | api, agent, worker, scores | `dev` or `demo` |
| `AWS_REGION` | api, agent, worker, scores | `ap-south-1` |
| `REPORTS_TABLE`, `SITES_TABLE`, `VOTES_TABLE`, `DEVICES_TABLE`, `SCORES_TABLE` | api: all; worker: all but scores; scores: reports, sites, scores; agent: sites | `junksnap-<stage>-<table>` |
| `ORIGINALS_BUCKET` | api, worker | `junksnap-<stage>-originals-<account_id>` |
| `PUBLIC_BUCKET` | worker, agent | `junksnap-<stage>-public-<account_id>` |
| `PUBLIC_BASE_URL` | api, worker, agent | CloudFront base URL, no trailing slash |
| `REPORTS_QUEUE_URL` | api, worker | URL of `junksnap-<stage>-reports` |
| `CORS_ORIGINS` | api, agent | comma-separated: the Amplify URL and `http://localhost:5173` |
| `PRESIGN_TTL_SECONDS` | api | `300` |
| `AGENT_URL` | worker | `http://agent` (the Service in the same namespace) |
| `PLACE_INDEX` | worker | `junksnap-<stage>-places` (Amazon Location) |
| `LLM_SECRET_ID` | agent | `junksnap-<stage>-llm-keys` (Secrets Manager; OpenAI and OpenRouter keys) |
| `LLM_TASKS` | agent | optional JSON `{"<task>": {"provider", "model", "fallback": []}}`; defaults live in code |
| `VITE_API_URL` | frontend | the CloudFront base URL, no trailing slash |
| `VITE_API_MODE` | frontend | `mock` (reads `contracts/fixtures/`) or `live` |

## Stages and names

- Stages: `dev` for building, `demo` for the recording. Region `ap-south-1` for everything.
- One EKS Auto Mode cluster, `junksnap`, with namespaces `junksnap-dev` and `junksnap-demo`. Deployments `api`, `agent` and `worker`, plus the CronJob `scores` (every 15 minutes). Containers listen on 8000; Services listen on 80.
- AWS resources are named `junksnap-<stage>-<thing>`; bucket names add `-<account_id>` because S3 names are global. Tags: `project=junksnap`, `stage=<stage>`.

## Seed samples

| Sample | City | Site | What it shows |
|---|---|---|---|
| `jdh-1` | Jodhpur | `site_jdh_1`: waste_dump, vacant_plot, open, verified | the full chain: report, moderation, auto-verified with fixed weights, brand label, location with ward, ward scores, letter |
| `jdh-2` | Jodhpur | `site_jdh_2`: no_bin, no_pickup, open, verified | a no-bin marker |
| `jdh-3` | Jodhpur | `site_jdh_3`: contaminated_water, choked_drain, reopened | cleaned then reopened, with a cleanup photo |
| `jpr-1` | Jaipur | `site_jpr_1`: open_construction, uncovered_debris, community check | a Scan frame, meta-learner with disagreement, no ward map, scores withheld |

All fixture data is sample data. Coordinates are plausible; seat names and codes are illustrative until the location task replaces them; the brand is invented; rule quotes are placeholders. No fixture names a person.

## Shared wording

- Say "verified" only for auto-verified or community-confirmed reports. Otherwise say "waiting for a neighbour check".
- Say "waste site", "reported" and "cleared". Never say "illegal" or "culprit", and never name a person.
- Every Cc line says "for attention". Letters address offices, never people.
- Below the guardrail, say "Not enough verified reports yet (N of 10)". Always show counts, and label Jodhpur data "Pilot city".
- For brands, say "packaging seen at this site", and only when the label is readable and above the confidence threshold.
- For letters, say "Draft for you to file". JunkSnap never files anything.
