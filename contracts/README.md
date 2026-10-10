# Contracts

This folder is the source of truth for every shape, route, table, S3 key, queue and environment variable that crosses a workload or package boundary. Code mirrors these definitions and never redefines them. To change one, use a `contract-<issue>-<slug>` branch whose PR touches only `contracts/`, add a decision file in `docs/decisions/`, and tell the team. Ask before you change a table key or the S3 layout. Shapes for satellite history come in a later contract PR.

Contracts v1.1 (decisions 20261010-0159 to -0203 and -0227) adds `insights` to `verification_result`, `site` and `ward_scores`, a `scan` link and `user_id` on `report_upload`, a Lok Sabha seat `status`, a nullable assembly seat, accounts, and the new `scan_session` and `ward_record` (the ward crawler's shape, issue 9). The new fields on existing schemas are not in `required`, so v1 producers stay valid, but new code always sends them. After any schema change, run `cd backend/server; npm ci; npm run gen:contracts` and commit the regenerated `src/contracts/*.gen.ts` in the same PR.

Contracts v1.2 (decision 20261010-0344, issue 53) changes no schema shape. It lists the worker's fields on the `reports` and `sites` rows, states that every GSI projects all attributes, adds `ASSETS_DIR`, marks `OPENROUTER_SECRET_ID` as planned, and rewords the description of `letter_draft` `source_sha256` (decision 20261010-0330).

## Files and CI

- `schemas/<name>.schema.json`: JSON Schema draft 2020-12. Every object sets `additionalProperties: false`.
- `fixtures/<name>.<sample>.json`: valid examples. Frontend mock mode and every package's contract tests read them.
- CI runs `uv run scripts/validate_contracts.py`. It checks that every schema is valid, every fixture matches its schema and every schema has a fixture. It does not assert `format` (date-time, uri), so contract tests must check formats themselves.

Workloads: `api`, `worker` and `scores` run the TypeScript project `backend/server` (image `junksnap-server`; entry files `web.ts`, `worker.ts` and `scores.ts`); `ml` is the Python service in `backend/ml` (image `junksnap-ml`). Decision 20261010-0159.

| Schema | Produced by | Read by |
|---|---|---|
| `report_upload` | frontend (`snap`); worker for each scan frame (`scan`) | api (body of `POST /reports`), worker |
| `scan_session` | frontend | api (body of `POST /scans`), worker |
| `moderation_result` | worker, for report (`rpt_`) and cleanup (`cln_`) photos | api (`GET /reports/{id}`) |
| `verification_result` | ml (`POST /internal/verify`), `purpose` report or cleanup, with `insights` | worker, api |
| `brand_label` | worker (brand step, no route) | worker, which fills `site.brands` |
| `location_lookup` | worker | worker, which copies it into `site.location` |
| `site` | worker (merge, cleanup, `insights`), api (votes) | frontend map and site panel, api letters |
| `ward_scores` | `scores` CronJob, with area `insights`; worker creates the first zero-count row | api, frontend area page |
| `letter_draft` | api | frontend letter preview |
| `ward_record` | ward crawler (offline Python, `data/ward_crawler`): the `records` array of `data/wards/<city>.json` | worker (location), scores (area, population, disposal points) |

`data/wards/<city>.json` also holds `map_layers`: city-wide OpenStreetMap layers (`disposal`, `school`, `hospital`, `water`, `drain`), each `{kind, count, source_url, fetched_at, page_sha256, features: [{ref, coords}]}`, where `ref` is `osm:<type>/<id>` and `coords` are `[lat, lon]` pairs (one for a place, the vertices for a line or area). The worker finds `site.insights.near` in these layers, so it works where a site has no ward. The city file and its layers have no schema yet (W1, issue 9).

`ward_record` follows the rules below. Its `id` is the ward area id `<local-body-id>-w<n>` (`jaipur-mc-w23`), `extracted_by.provider` uses the shared enum (`bedrock`, or `junksnap` for the crawler's hand-checked row pattern), times end in `Z`, and `$id` is the full URL. Jodhpur records keep the pre-merger bodies `jodhpur-uttar-mc` and `jodhpur-dakshin-mc` (January 2020 ward formation), so they never join a `jodhpur-mc` ward.

## Conventions

- JSON over HTTPS, `snake_case` fields, no version prefix in paths. Times are ISO 8601 UTC ending in `Z`; `as_of` is a plain date.
- Ids are opaque strings: a type prefix plus a lowercase ULID (`upl_`, `rpt_`, `cln_`, `scn_`, `site_`, `ltr_`). A report or cleanup reuses its upload's suffix (`upl_x` becomes `rpt_x` or `cln_x`), so retries are idempotent. A scan frame's upload id is `upl_` plus the first 26 hex characters of SHA-256 of `<scan_id>:<t_ms>`, so a retried scan makes the same ids.
- Area ids use `[a-z0-9-]`. Assembly seat: `<eci-state>-ac-<n>` (`s20-ac-127`). Lok Sabha seat: `<eci-state>-pc-<n>` (`s20-pc-16`). District: `<state>-<district>` (`rajasthan-jodhpur`). Ward: `<local-body-id>-w<n>` (`jodhpur-mc-w37`). Local bodies: `jodhpur-mc` and `jaipur-mc` (each city merged into one corporation in November 2025).
- Coverage: assembly boundaries and MLA rows exist only for Rajasthan, so `assembly_seat` is null elsewhere and there is no `mla` row. Wards are null where no open ward map exists (all fixtures), and then there is no `councillor` row. A Lok Sabha seat whose loaded boundary predates re-delimitation (Assam, Jammu and Kashmir, Ladakh) has `status: outdated`.
- Report types and their contexts: `waste_dump` (`vacant_plot`, `roadside`, `drain`, `other`); `no_bin` (`no_bin`, `no_pickup`); `contaminated_water` (`stagnant`, `sewage`, `foam`, `choked_drain`); `open_construction` (`uncovered_debris`, `dusty_site`). The schemas enforce the pairs.
- Every model decision records `provider` (`bedrock`, `openai`, `openrouter`, `rekognition`, `comprehend`, `junksnap`), `model` and `version`. `junksnap` means our own model or template. Originals go only to Rekognition; only blurred images go to any other model.
- Note moderation (toxicity and personal data in `report_upload.note`) runs on Bedrock, Claude Haiku 4.5 India profile. Amazon Comprehend is not enabled on this account, so no workload calls it; `comprehend` stays in the provider enum only for later.
- Insights (decision 20261010-0202) carry only measured numbers. Each per-report estimate names its model (`insight_source`); merged site values carry their models and report counts; area values carry their counts, and area composition its models; nearby places carry their OpenStreetMap layer source. Size is a class, never tonnage.
- Representatives are offices and seats only (decision 0137): no names, no party.
- Accounts (decision 20261010-0227): see Auth below. The app's `device_token` (a random UUID v4 kept in IndexedDB) stays for per-device rate limits and reputation.
- Errors return an HTTP status and `{"error": "<code>", "message": "<plain text>"}`. Codes: `bad_request` (400), `bbox_too_large` (400), `scan_too_large` (400), `unauthorized` (401), `forbidden` (403), `own_site` (403), `too_far` (403), `not_found` (404), `area_not_found` (404), `cleanup_pending` (409), `already_cleaned` (409), `not_verified` (409), `no_local_body` (422), `rate_limited` (429), `server_error` (500).
- CORS: `api` allows the origins listed in `CORS_ORIGINS` and the `Authorization` and `X-Device-Token` headers. `ml` is cluster-internal and has no CORS.

## Auth

- One Amazon Cognito user pool per stage (`junksnap-<stage>-users`): email and password, an emailed verification code, forgot-password by code. The email lives only in Cognito; no shape, table or log holds a user's name or email. (Ward records may hold official office contacts; those are offices, not users.)
- Open, no token: `GET /sites?bbox`, `GET /sites/{id}`, `GET /areas/{kind}/{id}/scores`, `GET /healthz`.
- Signed in, `Authorization: Bearer <Cognito ID token>`: `POST /uploads/presign`, `POST /reports`, `POST /scans/presign`, `POST /scans`, `POST /sites/{id}/votes`, `POST /sites/{id}/cleanup`, `POST /sites/{id}/letters`, `GET /reports/{id}` (or `X-Device-Token` alone, only for a guest report made before accounts), `GET /scans/{id}`. The api verifies the token's signature against the pool's JWKS, its issuer, its `token_use: id`, its audience (`COGNITO_CLIENT_ID`) and its expiry.
- 401 `unauthorized`: the token is missing, invalid or expired. 403 `forbidden`: the token is valid but the user is blocked in the `users` table.
- `user_id` is the token's `sub`, opaque. The api writes it on reports, scans, votes and cleanups, and ignores any `user_id` in a request body. These routes still send `device_token`.
- `GET /reports/{id}` and `GET /scans/{id}` return 404 unless the token's user owns the item. A guest report made before accounts (no `user_id`) opens with its `X-Device-Token`.
- Reputation and rate limits count per user and per device; the stricter one applies, and `verification_result.features.reputation` is the lower of the two.

## Limits

| Rule | Value | Enforced by |
|---|---|---|
| Fresh timestamp | `captured_at` at most 72 h before `received_at` (room for the offline queue), at most 5 min after it | worker |
| Duplicate | pHash Hamming distance 8 or less to an earlier photo within 100 m | worker |
| Rate limit | Each counted per user and per device; the stricter one applies. Snap: 20 photos per hour, counted on `reports` through `by-user` and `by-device` over the last hour of `received_at` (scan frames excluded). Scan: 1 frame per second of video, which the frame sampler enforces; frames never count toward the Snap limit. Letters: 5 per hour, counted with a windowed counter (`letter_window_start`, `letter_count`) on the `users` row and on the `devices` row, reset once an hour has passed since `letter_window_start` and updated with a conditional write | api (presign) and worker for photos; worker for frames; api for letters |
| Scan video | `video/webm` or `video/mp4`, at most 60 s, 1280 by 720 and 40 MB; else 400 `scan_too_large` at presign, or scan `failed` with `invalid_video` | api (presign), worker |
| Scan frames | 1 per second; a phone-hinted frame replaces the plain one in its second. Drop a frame when the nearest GPS fix is more than 3 s away or its `accuracy_m` is over 50 | worker |
| Votes | voter GPS within 1 km of the site, else 403 `too_far` | api |
| Cleanup photo | GPS within 50 m of the site (`near_site` check) | worker |
| Brand label | readable text and confidence 0.8 or more | worker |
| Nearby places | within 100 m of the site | worker |
| Area score and area shares | at least 10 verified reports (`min_verified_reports`) | scores |

## Routes

There is one base URL: CloudFront, then the ALB, then EKS. The ALB sends every public path to `api`; nothing public reaches `ml`. The CloudFront origin response timeout is 60 s so letters can finish. Which routes need a signed-in user is in Auth above.

| Method and path | Served by | Request | Response | Notes |
|---|---|---|---|---|
| `POST /uploads/presign` | api | presign request | 200 presign response | URL valid for `PRESIGN_TTL_SECONDS` |
| `POST /reports` | api | `report_upload` | 202 `{"report_id", "status": "queued"}` | `capture_mode: snap` from the phone; stores `received_at` and `user_id`, sends an SQS message |
| `GET /reports/{id}` | api | `Authorization`, or `X-Device-Token` for a guest report | 200 report status | 404 unless the user owns it (or the device made a guest report) |
| `POST /scans/presign` | api | scan presign request | 200 scan presign response | 400 `scan_too_large` over the scan video limit |
| `POST /scans` | api | `scan_session` | 202 `{"scan_id", "status": "queued"}` | stores `received_at` and `user_id`, sends `kind: scan` to SQS |
| `GET /scans/{id}` | api | `Authorization` | 200 scan status | 404 unless the user owns the scan |
| `GET /sites?bbox=minLon,minLat,maxLon,maxLat` | api | none | 200 FeatureCollection of `site` | bbox up to 1 by 1 degree; at most 500 sites, newest first; `rejected` sites left out |
| `GET /sites/{id}` | api | none | 200 `site` | |
| `POST /sites/{id}/votes` | api | vote | 200 vote result | api records the vote and settles the community check; see below |
| `POST /sites/{id}/cleanup` | api | cleanup | 202 cleanup accepted | poll `site.cleanup_status`; 409 `cleanup_pending` or `already_cleaned` |
| `GET /areas/{kind}/{id}/scores` | api | none | 200 `ward_scores` | kind is `ward`, `assembly`, `loksabha` or `district`; an area with sites but no score yet returns 200 with zero counts and every score withheld (`too_few_reports`); an area with no sites returns 404 `area_not_found` |
| `POST /sites/{id}/letters` | api | letter request | 200 `letter_draft` | up to 60 s; 409 `not_verified` unless `verification` is `verified`; 422 `no_local_body`; 429 `rate_limited`; never filed automatically |
| `GET /healthz` | api, ml | none | 200 `{"ok": true}` | probes and smoke test |

Cluster-internal route on `ml`, its only route besides `/healthz`. The ALB never routes it; the worker calls it at `ML_URL`. Brand labels have no route: they run inside the worker.

| Method and path | Request | Response |
|---|---|---|
| `POST /internal/verify` | verify request | `verification_result` with `insights` |

**Community check.** The api owns it. Each vote has a weight of `0.5 + reputation`, so a new device (reputation 0.5) counts 1.0. While `site.verification` is `community_check`, the api sums the weights of confirm votes and subtracts the weights of reject votes. At +3 or more the site becomes `verified`; at -3 or less it becomes `rejected`. A report's status follows its site's verification once merged. Votes on a settled site still count as corroborations but never change it. The reporter (same user or same device) gets 403 `own_site`. Each device has one vote per site, and its latest vote counts; when settling, the api also keeps only the latest vote per `user_id`, so one user on two phones counts once. The weight uses the lower of the user's and the device's reputation.

**Cleanup.** The worker moderates and blurs the after-photo (`cln_` id, `near_site` check), then calls `/internal/verify` with `purpose: cleanup`. For a cleanup, `is_clean == (decision == "auto_verified")`, and the schema enforces it. The worker accepts the cleanup only when moderation passed and `is_clean` is true. On acceptance the site's `status` becomes `cleaned` and `cleaned_at` and `cleanup_photo_url` are set. `cleanup_status` goes `checking` to `accepted` or `rejected`, and resets to `none` when the site reopens.

**Scans** (decision 20261010-0203). The phone records the video and the GPS track in sync, PUTs the video with the presigned URL, then posts the `scan_session`. For a `kind: scan` message the worker checks the video against the scan video limit, cuts one frame per second, and maps each frame's `t_ms` onto `gps_track` by linear interpolation between the fixes before and after it; the frame's `accuracy_m` is the larger of the two. It drops frames under the scan frame rule. For each kept frame it writes the JPEG to `reports/{upload_id}.jpg` in the originals bucket, a `report_upload` with `capture_mode: scan`, the `scan` link and the session's type, context, `device_token` and `user_id`, and the report row (`queued`), then sends a `kind: report` message. From there the frame runs the normal pipeline, moderation and blur included. Consecutive frames of one spot usually fail the duplicate check, so one ride past adds one report per spot. The video is never public and never goes to a model.

**Letters.** Every citation has `verified: true`, and `verifier.verified` equals `verifier.total` and the number of citations. A draft that fails the quote verifier falls back to the template letter with the same verified citations; an unverified quote never ships. Cc follows `site.location`: the councillor only when there is a ward, the MLA only when there is an assembly seat (outside Rajasthan the MP only), and never the MP of a Lok Sabha seat with `status: outdated`.

## Inline bodies

Presign request. `purpose` is `report` or `cleanup`; `sha256` is the lowercase hex digest of the original.

```json
{ "purpose": "report", "content_type": "image/jpeg", "sha256": "361477fa40d0646366e6b4a37679e846f82bfb66b3f791e64428ff5c21aca03c", "device_token": "3f6c2a1e-8b4d-4c7a-9e21-5d0b7f3a6c14" }
```

Presign response. The phone PUTs the bytes with exactly these headers, and S3 rejects bytes that do not match the hash. The api presigns against the regional S3 endpoint (`s3.ap-south-1.amazonaws.com`), never the global one, so the signature matches the bucket's region.

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

Scan presign request and response. The phone PUTs the video with exactly these headers to `scans/{scan_id}.webm` (or `.mp4`).

```json
{ "content_type": "video/webm", "sha256": "58a6b635872943aba34889e6e3c9fc117067b42f79f064042afe57d7e2046f18", "size_bytes": 9400000, "duration_ms": 8000, "device_token": "a71e5c90-2d3b-4f86-b1c4-9e0d27f58a63" }
```

```json
{
  "scan_id": "scn_jpr_1",
  "upload_url": "https://junksnap-dev-originals-<account_id>.s3.ap-south-1.amazonaws.com/scans/scn_jpr_1.webm?X-Amz-...",
  "headers": { "Content-Type": "video/webm", "x-amz-checksum-sha256": "<base64 of the same digest>" },
  "expires_at": "2026-10-10T04:07:16Z"
}
```

`GET /scans/{id}` response. `status` is `queued`, `processing`, `done` or `failed`; `reason` is null, `invalid_video` or `retries_exhausted`. `report_ids` lists the frame reports made so far; poll each one with `GET /reports/{id}`.

```json
{
  "scan_id": "scn_jpr_1",
  "status": "done",
  "reason": null,
  "frames": { "sampled": 8, "kept": 8, "dropped_no_fix": 0 },
  "report_ids": ["rpt_jpr_1", "<7 more>"],
  "received_at": "2026-10-10T04:02:20Z",
  "updated_at": "2026-10-10T04:02:52Z"
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

Verify request (worker to ml). `purpose` is `report` or `cleanup`; `ml` only ever reads the blurred copy.

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
| `reports` | `report_id` | none | `by-site` (`site_id`, `captured_at`); `by-device` (`device_token`, `received_at`); `by-user` (`user_id`, `received_at`) | `report_upload` fields (with `user_id`) top-level, `received_at`, `updated_at`, `status`, `completed_steps` (worker steps already done, from `moderate`, `verify`, `brands`, `locate`, `merge`, so a retried message resumes), `moderation_result`, `verification_result`, `brand_labels`, `location` (the full `location_lookup` the worker wrote), `site_id` |
| `cleanups` | `cleanup_id` | none | none | `site_id`, `upload_id`, `device_token`, `user_id`, `gps`, `sha256`, `captured_at`, `received_at`, `status`, `moderation_result`, `verification_result` |
| `scans` | `scan_id` | none | none | `scan_session` fields (with `user_id`), `received_at`, `status`, `reason`, `frames`, `report_ids` |
| `sites` | `site_id` | none | `by-geohash` (`geohash4`, `last_reported_at`) | `site` properties (full `location`, `cleanup_status`, `insights`) top-level, `lat`, `lon`, `geohash4`, and the internals: `version` (each write sets it one higher, conditional on the stored value), `report_ids`, `merged_reports` (`[{report_id, verified, insights}]`), `reporter_devices`, `reporter_users`, `me_too_count`, `embedding_key`, `pending_cleanup_id`; the api builds the Feature |
| `votes` | `site_id` | `device_token` | none | `vote`, `weight`, `user_id`, `voted_at` |
| `devices` | `device_token` | none | none | `reputation`, report counts, `letter_window_start`, `letter_count`, `first_seen`, `blocked` |
| `users` | `user_id` | none | none | `reputation`, report counts, `letter_window_start`, `letter_count`, `first_seen`, `blocked`; never the user's name or email |
| `scores` | `area_kind` | `area_id` | none | the latest `ward_scores` per area, with `insights`; the CronJob overwrites it |

Every GSI (`by-site`, `by-device`, `by-user`, `by-geohash`) projects ALL attributes, so a query returns whole items and needs no second read.

For a bbox query, compute the geohash4 cells that cover the bbox, query `by-geohash` once per cell and filter by `lat` and `lon`. To merge, query the report's cell and its neighbours and keep sites within 40 m. The worker writes the full location and the merged insights into the site when merging, and the api reads the location from the sites table for letters. When a site first lands in an area with no `scores` row (its ward, assembly seat, Lok Sabha seat or district), the worker creates a zero-count row for that area with every score withheld, using the area name from `site.location`. The write is conditional and never overwrites, so `GET /areas/{kind}/{id}/scores` always has a source.

## S3 key layout

| Bucket | Key | Holds |
|---|---|---|
| `junksnap-<stage>-originals-<account_id>` (private, SSE-KMS) | `reports/{upload_id}.jpg` | report originals, PUT by presigned URL; scan frames written by the worker |
| same | `cleanups/{upload_id}.jpg` | cleanup after-photo originals |
| same | `scans/{scan_id}.webm` or `.mp4` | scan videos, PUT by presigned URL; never public, never sent to a model |
| same | `embeddings/{report_id or cleanup_id}.json` | image embeddings; `ml` may write only this prefix and reads only this prefix and `models/` in this bucket |
| same | `datasets/{dataset}/...` | openly licensed public training images, their records and the OWLv2 teacher boxes (`teacher_boxes.jsonl`); models are trained and evaluated on public data only (decision 20261010-1245-hem-ml-public-data-only); offline training only, no pod has access |
| same | `models/{name}/{sha256[:12]}-{file}` | trained model files (YOLO ONNX, SigLIP ONNX, embedding heads, meta-learner, phone model), written by `backend/ml/training` `learn publish`; `ml` reads them at start and checks the SHA-256 pinned in `backend/ml/src/ml/settings/models.json` |
| same | `datasets/manifest.jsonl` | the dataset manifest (one line per image, with its split), written by `backend/ml/training` when it is over 5 MB; offline training only, no pod has access |
| `junksnap-<stage>-public-<account_id>` (read through CloudFront) | `media/reports/{report_id}.jpg` | blurred report copies |
| same | `media/cleanups/{cleanup_id}.jpg` | blurred cleanup after-photos |

A public URL is `PUBLIC_BASE_URL + "/" + key`. CloudFront serves `/media/*` from the public bucket, so `PUBLIC_BASE_URL` is the same base URL as the API. Photos are JPEG only, and the worker rejects files over 8 MB (`invalid_image`); scan videos follow the scan video limit. Originals never become public; they go only to Rekognition, and only blurred images go to any other model.

## SQS

- Queue `junksnap-<stage>-reports`, max receive count 3, then the dead-letter queue `junksnap-<stage>-reports-dlq`. Visibility timeout is 5 minutes.
- Report message: `{"kind": "report", "report_id": "rpt_jdh_1"}`.
- Cleanup message: `{"kind": "cleanup", "cleanup_id": "cln_jdh_3c", "site_id": "site_jdh_3", "upload_id": "upl_jdh_3c", "device_token": "<uuid>", "user_id": "<sub>", "sha256": "<64 hex>", "gps": {...}, "captured_at": "...", "received_at": "..."}`.
- Scan message: `{"kind": "scan", "scan_id": "scn_jpr_1"}`. The worker reads the session from the `scans` table and sends one report message per kept frame.
- When `ApproximateReceiveCount` reaches 3, the worker marks the report `needs_review` (the cleanup `rejected`, the scan `failed` with `retries_exhausted`) before the message moves to the dead-letter queue (decision 0131).

## Environment variables

| Variable | Used by | Value |
|---|---|---|
| `JUNKSNAP_STAGE` | api, worker, scores, ml | `dev` or `demo` |
| `AWS_REGION` | api, worker, scores, ml | `ap-south-1` |
| `REPORTS_TABLE`, `CLEANUPS_TABLE`, `SCANS_TABLE`, `SITES_TABLE`, `VOTES_TABLE`, `DEVICES_TABLE`, `USERS_TABLE`, `SCORES_TABLE` | api: all; worker: all; scores: reports, sites, scores; ml: none | `junksnap-<stage>-<table>` |
| `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID` | api | the stage's user pool id and its app client id (no client secret); the api builds the issuer and JWKS URL from them and `AWS_REGION` |
| `ORIGINALS_BUCKET` | api, worker, ml (`embeddings/` and reads `models/`) | `junksnap-<stage>-originals-<account_id>` |
| `PUBLIC_BUCKET` | worker, ml (reads `media/` only) | `junksnap-<stage>-public-<account_id>` |
| `PUBLIC_BASE_URL` | api, worker | CloudFront base URL, no trailing slash |
| `REPORTS_QUEUE_URL` | api, worker | URL of `junksnap-<stage>-reports` |
| `CORS_ORIGINS` | api | comma-separated: the Amplify URL and `http://localhost:5173` |
| `PRESIGN_TTL_SECONDS` | api | `300`, for photos and scan videos |
| `ML_URL` | worker | `http://ml` (the Service in the same namespace); replaces `AGENT_URL` |
| `OPENAI_SECRET_ID` | api (letters), ml (judge) | `junksnap/<stage>/openai-api-key` (Secrets Manager, decision 0133) |
| `OPENROUTER_SECRET_ID` | planned (decision 0133); no provider yet | `junksnap/<stage>/openrouter-api-key` (Secrets Manager); neither `api` nor `ml` has an OpenRouter provider |
| `ASSETS_DIR` | api, worker, scores | directory holding the repo's `data/` files (`rules/`, `brands/`, `boundaries/`, `wards/`, `representatives/`); `/app/data` in the image |
| `LLM_TASKS` | api, worker, ml | optional JSON `{"<task>": {"provider", "model", "fallback": []}}`; each service reads only its own tasks (api: letters; worker: note moderation, Bedrock only; ml: judge); defaults live in code |
| `VITE_API_URL` | frontend | the CloudFront base URL, no trailing slash |
| `VITE_API_MODE` | frontend | `mock` (reads `contracts/fixtures/`) or `live` |
| `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID` | frontend | the same pool and app client as the api |
| `JUNKSNAP_DATA_CACHE` | training tooling in `backend/ml/training` (local, not a workload) | local folder for downloaded training images, outside the repo and never committed |
| `ML_MODEL_DIR` | ml | optional local folder for downloaded model files; default `/tmp/junksnap-models` |
| `JUNKSNAP_REPO` | training tooling (local, not a workload) | path to the repo checkout, for `data/datasets/` manifests and `contracts/` |

Reverse geocoding uses Amazon Location Places v2 (`geo-places:ReverseGeocode`), which needs no place index, so there is no `PLACE_INDEX` variable; the worker's Pod Identity role gets that one action.

## Stages and names

- Stages: `dev` for building, `demo` for the recording. Region `ap-south-1` for everything.
- One EKS Auto Mode cluster, `junksnap`, with namespaces `junksnap-dev` and `junksnap-demo`. Deployments `api`, `worker` and `ml`, plus the CronJob `scores` (every 15 minutes). Containers listen on 8000; the `api` and `ml` Services listen on 80.
- Images, in ECR repositories of the same names: `junksnap-server` runs `api`, `worker` and `scores` (one image, a different command each); `junksnap-ml` runs `ml`.
- AWS resources are named `junksnap-<stage>-<thing>`; bucket names add `-<account_id>` because S3 names are global; secrets use `junksnap/<stage>/<name>`. Tags: `project=junksnap`, `stage=<stage>`.

## Seed samples

| Sample | City | Site | What it shows |
|---|---|---|---|
| `jdh-1` | Jodhpur | `site_jdh_1`: waste_dump, vacant_plot, open, verified, cleanup checking | the full chain: report by a signed-in user, moderation, auto-verified with fixed weights, insights, brand label, location in seat `s20-ac-128` with no ward map, area scores and insights for that seat, letter Cc MLA and MP; a ward record from the crawler |
| `jdh-2` | Jodhpur | `site_jdh_2`: no_bin, no_pickup, open, verified | a no-bin marker in seat `s20-ac-127` |
| `jdh-3` | Jodhpur | `site_jdh_3`: contaminated_water, choked_drain, reopened | an accepted cleanup (`cln_jdh_3c` moderation and verification, insights null), then reopened; a hazard and nearby places |
| `jpr-1` | Jaipur | `site_jpr_1`: open_construction, uncovered_debris, community check | a scan session (`scn_jpr_1`) and its frame at 4 s, meta-learner with disagreement and a stored embedding, no ward map, scores and area shares withheld |

All fixture data is sample data, except `ward_record.jdh-1`, which is a real, unreviewed crawler record (its body `jodhpur-uttar-mc` predates the November 2025 merger; its id follows the ward rule). Coordinates are plausible; seat codes match the loaded boundaries; the brand and OpenStreetMap ids are invented; rule quotes are placeholders; user ids are random. Sample ids are short; real ids follow the rules above. No fixture names a person.

## Shared wording

- Say "verified" only for auto-verified or community-confirmed reports. Otherwise say "waiting for a neighbour check".
- Say "waste site", "reported" and "cleared". Never say "illegal" or "culprit", and never name a person.
- Every Cc line says "for attention". Letters address offices, never people.
- Below the guardrail, say "Not enough verified reports yet (N of 10)". Always show counts, and label Jodhpur data "Pilot city".
- For brands, say "packaging seen at this site", and only when the label is readable with confidence 0.8 or more.
- For insights, show each number with what it rests on, for example "Plastic about 52% (6 reports)", and the model on tap. Say "small", "medium" or "large pile"; never a weight.
- Say "near a school" (or a hospital, water body or open drain) only from `site.insights.near`, with the distance and "OpenStreetMap".
- Address people as "you" in the app. Never show another user's id, email or name.
- For letters, say "Draft for you to file". JunkSnap never files anything.
