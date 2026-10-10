# Contracts

This folder is the source of truth for every shape, route, table, S3 key, queue and environment variable that crosses a workload or package boundary. Code mirrors these definitions and never redefines them. To change one, use a `contract-<issue>-<slug>` branch whose PR touches only `contracts/`, add a decision file in `docs/decisions/`, and tell the team. Ask before you change a table key or the S3 layout. Shapes for satellite history come in a later contract PR.

Contracts v1.1 (decisions 20261010-0159 to -0203 and -0227) adds `insights` to `verification_result`, `site` and `ward_scores`, a `scan` link and `user_id` on `report_upload`, a Lok Sabha seat `status`, a nullable assembly seat, accounts, and the new `scan_session` and `ward_record` (the ward crawler's shape, issue 9). The new fields on existing schemas are not in `required`, so v1 producers stay valid, but new code always sends them. After any schema change, run `cd backend/server; npm ci; npm run gen:contracts` and commit the regenerated `src/contracts/*.gen.ts` in the same PR.

Contracts v1.2 (decision 20261010-0344, issue 53) changes no schema shape. It lists the worker's fields on the `reports` and `sites` rows, states that every GSI projects all attributes, adds `ASSETS_DIR`, marks `OPENROUTER_SECRET_ID` as planned, and rewords the description of `letter_draft` `source_sha256` (decision 20261010-0330).

Contracts v1.3 (decision 20261010-1422, issue 76) adds `GET /areas/{kind}?within=&limit=` and its wrapper schema `area_list`, and a table-only `within` attribute on `scores` rows. No existing schema changes.

Contracts v1.4 (decision 20261010-1430, issue 79) measures bin access: `site.reporters`, `site.insights.nearest_bin` and `no_bin_within_3km`, `ward_scores` `counts.sites_without_bin_within_3km` and `metrics.no_bin_within_3km_pct` (formula scores-v2), and `letter_draft.evidence`.

Contracts v1.5 (decision 20261010-1445-hem-ward-crawler-service, issue 78) adds the `crawls` table, the `crawl/` prefix in the originals bucket, the public route `GET /areas/district/{id}/crawl` with the new `area_crawl` shape, the `crawler` CronJob and image, and the `CRAWL_*` and `CRAWLS_TABLE` variables. No existing shape changes.

Contracts v1.6 (decision 20261010-1600-hem-area-letters, issue 89) adds `POST /areas/{kind}/{id}/letters` and its response schema `area_letter_draft`: one cited letter about one issue in one area. No existing shape changes.

Contracts v1.7 (decision 20261010-1645-hem-overflowing-bin, issue 100) adds the report type `overflowing_bin` ("Overflowing or broken bin") with contexts `overflowing` and `damaged` to every `report_type` enum (`report_upload`, `scan_session`, `site`, `verification_result` judge, `area_letter_draft` issue and worst sites). It also adds the optional metric `ward_scores.metrics.bin_service_pct` (formula `scores-v3`). Additive only; new fixtures `site.jdh-4` and `report_upload.jdh-4`.

Contracts v1.8 (decision 20261010-1630-hem-community-notes, issue 101) adds `POST /sites/{id}/notes` and its response schema `site_note`, the `notes` table and `NOTES_TABLE`, the optional `site.community` (residents' notes read by the `note_analysis` task), and the optional `residents` in `letter_draft.evidence` and `area_letter_draft.evidence`. No existing field changes.

Contracts v1.9 (decision 20261010-1700-hem-site-removal) adds `DELETE /sites/{id}/reports/mine` (a reporter withdraws their reports from a site that is not verified) and its inline response, the site `status` value `removed` with the optional `removed_reason` and `removed_at`, the optional `cleaned_by`, the vote value `cleaned` and the optional `site.votes.cleaned`, the report status `withdrawn`, the error `site_verified`, and table-only fields (`reports.withdrawn_at`, `sites.withdrawn_report_ids`, `withdraw_window_start` and `withdraw_count` on `users` and `devices`). `GET /sites?bbox` now also leaves out `removed` and `cleaned` sites. Additive only; new fixture `site.jdh-5`.

Contracts v1.10 (decision 20261010-1745-hem-area-scout, issue 107) adds the area scout. `scan_session` `report_type` and `context` take the new value `auto`: `auto`/`auto` is an area scout (the models name each frame's type and context), and a picked type with `context: auto` lets the models name only the place; `no_bin` never takes `auto`. The verify request takes `auto` the same way. The `reports` row gets the table-only `auto_claim` and `scan_spot`, and `GET /scans/{id}` the optional `found`. `report_upload`, `site` and `verification_result` are unchanged: a frame report always carries a concrete type. Additive only; new fixture `scan_session.jdh-6`.

Contracts v1.11 (decision 20261011-0400-hem-long-range-target, issue 115) adds long-range marking: the optional `report_upload.target` `{lat, lon}`, where the waste is when the reporter saw it from up to 500 m away, the error `target_too_far` (422), and the table-only `reports.target_distance_m`. `gps` stays the reporter's fix and the evidence for authenticity; the site point, merge distance, nearby places, nearest bin and ward and seat lookup use `target` when present. Additive only; new fixture `report_upload.jdh-far`.

Contracts v1.12 (decision 20261010-1855-hem-cleaned-quorum-expiry) adds the `cleanup_status` value `pending_confirmation`, the optional `site.clearance` (`count`, `needed`, `still_there`), the site `status` value `expired` with the optional `site.expires_at`, and the table-only `sites.cleanup_people`. One accepted after-photo no longer cleans a site: it is one person's word, and 3 different people must say cleared. A site with no activity for 90 days becomes `expired`; the `scores` CronJob now writes that status on the sites table. Additive only; stored rows stay valid, and an already-cleaned site stays cleaned. `site.jpr-1` gains `expires_at`.

Contracts v1.13 (decision 20261011-0900-hem-blur-fallback, issue 110) adds the optional `moderation_result.blur.regions` (every region blurred, by kind, including the dark-photo `band`) and `blur.low_light`. Blurred public copies carry the S3 object metadata `blur-policy` (no key change). Additive only; `moderation_result.jdh-1` shows the new fields.

## Files and CI

- `schemas/<name>.schema.json`: JSON Schema draft 2020-12. Every object sets `additionalProperties: false`.
- `fixtures/<name>.<sample>.json`: valid examples. Frontend mock mode and every package's contract tests read them.
- CI runs `uv run scripts/validate_contracts.py`. It checks that every schema is valid, every fixture matches its schema and every schema has a fixture. It does not assert `format` (date-time, uri), so contract tests must check formats themselves.

Workloads: `api`, `worker` and `scores` run the TypeScript project `backend/server` (image `junksnap-server`; entry files `web.ts`, `worker.ts` and `scores.ts`); `ml` is the Python service in `backend/ml` (image `junksnap-ml`). Decision 20261010-0159.

| Schema | Produced by | Read by |
|---|---|---|
| `report_upload` | frontend (`snap`, and `no_bin` without a photo: fixture `report_upload.jdh-2`); worker for each scan frame (`scan`) | api (body of `POST /reports`), worker |
| `scan_session` | frontend | api (body of `POST /scans`), worker |
| `moderation_result` | worker, for report (`rpt_`) and cleanup (`cln_`) photos | api (`GET /reports/{id}`) |
| `verification_result` | ml (`POST /internal/verify`), `purpose` report or cleanup, with `insights` | worker, api |
| `brand_label` | worker (brand step, no route) | worker, which fills `site.brands` |
| `location_lookup` | worker | worker, which copies it into `site.location` |
| `site` | worker (merge, cleanup, `insights`), api (votes), `scores` CronJob (`status: expired` only) | frontend map and site panel, api letters |
| `ward_scores` | `scores` CronJob, with area `insights`; worker creates the first zero-count row | api, frontend area page |
| `area_list` | api (`GET /areas/{kind}`): ranked `ward_scores` rows within a district or local body | frontend city ranking |
| `letter_draft` | api | frontend letter preview |
| `area_letter_draft` | api | frontend area page letter preview |
| `site_note` | api (`POST /sites/{id}/notes`) | frontend site sheet |
| `ward_record` | ward crawler (`data/ward_crawler`): the `records` array of `data/wards/<city>.json` (in the image) and of `crawl/wards/<city>.json` (the `crawler` CronJob, originals bucket) | worker (location; read at worker start), scores (area, population, disposal points; read every run); per city each keeps the file with more `reviewed` records, then one with `map_layers` over one without, then the newer `generated_at` |
| `area_crawl` | api, from the `crawls` row (`not_started` without one) | frontend area pages and Areas list (the crawl banner) |

`data/wards/<city>.json` also holds `map_layers`: city-wide OpenStreetMap layers (`disposal`, `school`, `hospital`, `water`, `drain`), each `{kind, count, source_url, fetched_at, page_sha256, features: [{ref, coords}]}`, where `ref` is `osm:<type>/<id>` and `coords` are `[lat, lon]` pairs (one for a place, the vertices for a line or area). The worker finds `site.insights.near` in these layers, so it works where a site has no ward. The city file and its layers have no schema yet (W1, issue 9).

`ward_record` follows the rules below. Its `id` is the ward area id `<local-body-id>-w<n>` (`jaipur-mc-w23`), `extracted_by.provider` uses the shared enum (`bedrock`, or `junksnap` for the crawler's hand-checked row pattern), times end in `Z`, and `$id` is the full URL. Jodhpur records keep the pre-merger bodies `jodhpur-uttar-mc` and `jodhpur-dakshin-mc` (January 2020 ward formation), so they never join a `jodhpur-mc` ward.

## Conventions

- JSON over HTTPS, `snake_case` fields, no version prefix in paths. Times are ISO 8601 UTC ending in `Z`; `as_of` is a plain date.
- Ids are opaque strings: a type prefix plus a lowercase ULID (`upl_`, `rpt_`, `cln_`, `scn_`, `site_`, `ltr_`). A report or cleanup reuses its upload's suffix (`upl_x` becomes `rpt_x` or `cln_x`), so retries are idempotent. A scan frame's upload id is `upl_` plus the first 26 hex characters of SHA-256 of `<scan_id>:<t_ms>`, so a retried scan makes the same ids.
- Area ids use `[a-z0-9-]`. Assembly seat: `<eci-state>-ac-<n>` (`s20-ac-127`). Lok Sabha seat: `<eci-state>-pc-<n>` (`s20-pc-16`). District: `<state>-<district>` (`rajasthan-jodhpur`). Ward: `<local-body-id>-w<n>` (`jodhpur-mc-w37`). Local bodies: `jodhpur-mc` and `jaipur-mc` (each city merged into one corporation in November 2025).
- Coverage: assembly boundaries and MLA rows exist only for Rajasthan, so `assembly_seat` is null elsewhere and there is no `mla` row. Wards are null where no open ward map exists (all fixtures), and then there is no `councillor` row. A Lok Sabha seat whose loaded boundary predates re-delimitation (Assam, Jammu and Kashmir, Ladakh) has `status: outdated`.
- Report types and their contexts: `waste_dump` (`vacant_plot`, `roadside`, `drain`, `other`); `no_bin` (`no_bin`, `no_pickup`); `contaminated_water` (`stagnant`, `sewage`, `foam`, `choked_drain`); `open_construction` (`uncovered_debris`, `dusty_site`); `overflowing_bin` (`overflowing`, `damaged`): a public bin or container that is overflowing, broken, burnt or missing its lid, with waste spilling around it. The schemas enforce the pairs.
- Every model decision records `provider` (`bedrock`, `openai`, `openrouter`, `rekognition`, `comprehend`, `junksnap`), `model` and `version`. `junksnap` means our own model or template. Originals go only to Rekognition; only blurred images go to any other model.
- `verification_result.combiner.version` ends with `+<reason> by <provider>/<model>@<version>[,...]` when a veto rejected the photo (reasons `judge_veto:unclear`, `judge_veto:not_waste`, `judge_veto:low_support`, `detectors_veto:no_waste`, `judge_veto:combined_no`; decision 20261011-0230-hem-judge-strong-no, which replaces 20261010-1900). The app reads `judge_veto:unclear` as "retake the photo"; the schema is unchanged.
- Note moderation (toxicity and personal data in `report_upload.note`) runs on Bedrock, Claude Haiku 4.5 India profile. Amazon Comprehend is not enabled on this account, so no workload calls it; `comprehend` stays in the provider enum only for later.
- Insights (decision 20261010-0202) carry only measured numbers. Each per-report estimate names its model (`insight_source`); merged site values carry their models and report counts; area values carry their counts, and area composition its models; nearby places carry their OpenStreetMap layer source. Size is a class, never tonnage.
- Representatives are offices and seats only (decision 0137): no names, no party.
- Accounts (decision 20261010-0227): see Auth below. The app's `device_token` (a random UUID v4 kept in IndexedDB) stays for per-device rate limits and reputation.
- Errors return an HTTP status and `{"error": "<code>", "message": "<plain text>"}`. Codes: `bad_request` (400), `bbox_too_large` (400), `scan_too_large` (400), `unauthorized` (401), `forbidden` (403), `own_site` (403), `too_far` (403), `not_found` (404), `area_not_found` (404), `cleanup_pending` (409), `already_cleaned` (409), `not_verified` (409), `site_rejected` (409), `site_verified` (409), `no_local_body` (422), `target_too_far` (422), `rate_limited` (429), `server_error` (500).
- CORS: `api` allows the origins listed in `CORS_ORIGINS`, the methods `GET`, `HEAD`, `POST` and `DELETE`, and the `Authorization` and `X-Device-Token` headers. `ml` is cluster-internal and has no CORS.

## Auth

- One Amazon Cognito user pool per stage (`junksnap-<stage>-users`): email and password, an emailed verification code, forgot-password by code. The email lives only in Cognito; no shape, table or log holds a user's name or email. (Ward records may hold official office contacts; those are offices, not users.)
- Open, no token: `GET /sites?bbox`, `GET /sites/{id}`, `GET /areas/{kind}/{id}/scores`, `GET /areas/{kind}?within`, `GET /areas/district/{id}/crawl`, `GET /share/sites/{id}`, `GET /share/areas/{kind}/{id}`, `GET /healthz`.
- Signed in, `Authorization: Bearer <Cognito ID token>`: `POST /uploads/presign`, `POST /reports`, `POST /scans/presign`, `POST /scans`, `POST /sites/{id}/votes`, `POST /sites/{id}/cleanup`, `DELETE /sites/{id}/reports/mine`, `POST /sites/{id}/letters`, `POST /sites/{id}/notes`, `POST /areas/{kind}/{id}/letters`, `GET /reports/{id}` (or `X-Device-Token` alone, only for a guest report made before accounts), `GET /scans/{id}`. The api verifies the token's signature against the pool's JWKS, its issuer, its `token_use: id`, its audience (`COGNITO_CLIENT_ID`) and its expiry.
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
| Scan frames | 1 per second; a phone-hinted frame replaces the plain one in its second. Drop a frame when the nearest GPS fix is more than 3 s away or its `accuracy_m` is over 50. Keep one frame per view: drop a frame whose 64-bit difference hash is within 5 bits of the last kept frame, or within 20 bits of a kept frame less than 10 m away (the better hinted of the two stays) | worker |
| Votes | voter GPS within 1 km of the site, else 403 `too_far` | api |
| Withdrawals | 10 per hour, per user and per device, windowed like letters on `withdraw_window_start` and `withdraw_count` (users and devices rows); 429 `rate_limited` | api |
| Cleanup photo | GPS within 50 m of the site (`near_site` check) | worker |
| Long-range target | `report_upload.target` at most 500 m from `gps` (haversine), else 422 `target_too_far`; not allowed on `no_bin` or scan frames (the schema forbids it) | api (`POST /reports`) |
| Brand label | readable text and confidence 0.8 or more | worker |
| Nearby places | within 100 m of the site | worker |
| Area score and area shares | at least 10 verified reports (`min_verified_reports`) | scores |

## Routes

There is one base URL: CloudFront, then the ALB, then EKS. The ALB sends every public path to `api`; nothing public reaches `ml`. The CloudFront origin response timeout is 60 s so letters can finish. Which routes need a signed-in user is in Auth above.

| Method and path | Served by | Request | Response | Notes |
|---|---|---|---|---|
| `POST /uploads/presign` | api | presign request | 200 presign response | URL valid for `PRESIGN_TTL_SECONDS` |
| `POST /reports` | api | `report_upload` | 202 `{"report_id", "status": "queued"}` | `capture_mode: snap` from the phone; stores `received_at`, `user_id` and, with a `target`, `target_distance_m`; sends an SQS message; 422 `target_too_far` for a target over 500 m from `gps` (see Long-range marking) |
| `GET /reports/{id}` | api | `Authorization`, or `X-Device-Token` for a guest report | 200 report status | 404 unless the user owns it (or the device made a guest report) |
| `POST /scans/presign` | api | scan presign request | 200 scan presign response | 400 `scan_too_large` over the scan video limit |
| `POST /scans` | api | `scan_session` | 202 `{"scan_id", "status": "queued"}` | stores `received_at` and `user_id`, sends `kind: scan` to SQS |
| `GET /scans/{id}` | api | `Authorization` | 200 scan status | 404 unless the user owns the scan |
| `GET /sites?bbox=minLon,minLat,maxLon,maxLat` | api | none | 200 FeatureCollection of `site` | bbox up to 1 by 1 degree; at most 500 sites, newest first; `rejected`, `removed`, `cleaned` and `expired` sites left out (the active map; decisions 20261010-1700 and 20261010-1855); a site past `expires_at` is left out before the CronJob marks it |
| `GET /sites/{id}` | api | none | 200 `site` | every status, so a link to a removed, cleared or expired site still opens (a site past `expires_at` reads as `expired`); a removed site shows `photo_urls: []` and `cleanup_photo_url: null` (the sites row keeps the URLs for the audit trail) |
| `POST /sites/{id}/votes` | api | vote | 200 vote result | api records the vote and recounts the backers; see below; 404 `not_found` for a removed or expired site |
| `POST /sites/{id}/cleanup` | api | cleanup | 202 cleanup accepted | poll `site.cleanup_status`; 409 `cleanup_pending` (another after-photo is still being checked) or `already_cleaned`; 404 `not_found` for a removed or expired site |
| `DELETE /sites/{id}/reports/mine` | api | `Authorization` and `X-Device-Token` headers, no body | 200 withdrawal result | signed in; 400 `bad_request` without a valid `X-Device-Token`; 404 `not_found` for an unknown site or when the user (the token's `sub`, matched to `reports.user_id`) has no report merged into it; 409 `site_verified` once the site is verified; 429 `rate_limited`; see Withdrawal below |
| `GET /areas/{kind}/{id}/scores` | api | none | 200 `ward_scores` | kind is `ward`, `assembly`, `loksabha` or `district`; an area with sites but no score yet returns 200 with zero counts and every score withheld (`too_few_reports`); an area with no sites returns 404 `area_not_found` |
| `GET /areas/{kind}?within=<id>&limit=<n>` | api | none | 200 `area_list` | kind as above; `within` (required) is a district id (`rajasthan-jodhpur`) or local body id (`jodhpur-mc`); `limit` 1 to 200, default 50, larger values capped at 200. One Query on the `scores` partition `area_kind`, filtered on `within`. Order: areas with a shown score first, lowest mean of the shown scores first, then the rest; ties by more verified reports, then area id. Rows are returned as stored, so withheld scores stay withheld and counts always show; `total` counts matches before the limit. No match returns 200 with an empty list, never 404 |
| `POST /areas/{kind}/{id}/letters` | api | area letter request | 200 `area_letter_draft` | signed in; up to 60 s; 400 `bad_request` for an unknown kind, a bad id or body; 404 `area_not_found` when the area has no reported sites; 409 `not_verified` unless the area's verified sites of that issue hold at least 10 verified reports (the message gives the count, for example "Not enough verified reports yet (3 of 10) for this issue in this area."); for `no_bin`, and the no-bin zones inside `all`, a zone counts only once verified by 10 people (decision 20261010-1630), and the 409 message lists the zones left out, for example "No-bin sites left out: Fewer than 10 people have confirmed no dustbin within 1 km (2 sites)."; 422 `no_local_body` for a ward or assembly letter with no local body to address; 429 `rate_limited`, sharing the 5 letters an hour with site letters and checked before any site is read; never filed automatically |
| `POST /sites/{id}/notes` | api | note request | 201 `site_note` | signed in; 400 `bad_request` for empty text, over 280 characters, another language or no device token; 404 `not_found` for an unknown site; 429 `rate_limited` after `NOTES_PER_HOUR` (10) notes an hour, counted per user and per device on `note_window_start` and `note_count`, checked before moderation. The note goes through the same Bedrock-only note moderation as report notes: a toxic or personal note, or one that could not be checked, is stored hidden without its text. A shown note starts the `note_analysis` of the site, at most once per 10 minutes per site, which writes `site.community`; the answer never waits for it |
| `GET /areas/district/{id}/crawl` | api | none | 200 `area_crawl` | any district id matching `[a-z0-9-]{1,64}` answers 200 (`not_started` when the `crawls` table has no row); else 400 `bad_request` |
| `POST /sites/{id}/letters` | api | letter request | 200 `letter_draft` | up to 60 s; 409 `not_verified` unless `verification` is `verified`; for a `no_bin` zone that means 10 people confirmed it, and a mapped bin nearby is shown as evidence, never a block (decision 20261010-1630); 422 `no_local_body`; 429 `rate_limited`; never filed automatically |
| `GET /share/sites/{id}` | api | none | 200 HTML link preview | for crawlers (WhatsApp, Telegram, X); see Link previews below; 404 with the generic card for an unknown or malformed id |
| `GET /share/areas/{kind}/{id}` | api | none | 200 HTML link preview | as above, from the area's `ward_scores` row; 404 with the generic card for an unknown kind or area |
| `GET /healthz` | api, ml | none | 200 `{"ok": true}` | probes and smoke test |

**Link previews** (issue 127). Crawlers do not run the app's script, so share links point at the api: `PUBLIC_BASE_URL/share/sites/{id}` and `PUBLIC_BASE_URL/share/areas/{kind}/{id}`. Each answers minimal `text/html` with Open Graph and Twitter card tags, and one inline script (allowed by its hash in the `Content-Security-Policy`) that sends a person on to the web app page (`WEB_URL/sites/{id}` or `WEB_URL/areas/{kind}/{id}`), with a plain link for no script. A site card shows the report type and place (ward or assembly seat, then town or district), "n of 10 people confirmed" or "Verified by 10 people" (or "Reported cleared"), and the first report's date, with the first photo that is a blurred report copy (`PUBLIC_BASE_URL/media/reports/rpt_*.jpg`); never an original or any other URL. A removed, expired or rejected site gets a generic card with no photo and no place. Area cards show the area name and kind, the verified report and site counts (or "Not enough verified reports yet (n of 10)") and the pilot flag. Cards without a photo use the logo at `WEB_URL/brand/icon-512.png`. Text is English, names no person, and is HTML-escaped; `Cache-Control: public, max-age=300`. No schema changes.

Cluster-internal route on `ml`, its only route besides `/healthz`. The ALB never routes it; the worker calls it at `ML_URL`. Brand labels have no route: they run inside the worker.

| Method and path | Request | Response |
|---|---|---|
| `POST /internal/verify` | verify request | `verification_result` with `insights` |

**No-bin zones** (decision 20261010-1630). A `no_bin` report says "There is no dustbin within 1 km of here" from where a signed-in user stands: GPS `accuracy_m` at most 50, photo optional. Without a photo the report has no `sha256` and the app makes its `upload_id` (`upl_` plus a lowercase ULID); with one, the photo is moderated and blurred like any other but never judged as waste. The worker skips moderation without a photo and skips the waste check and brands for every `no_bin` report. A report joins the nearest open `no_bin` site whose centre is within 500 m, else founds one; the centre is the mean of its reports' points, and the site carries `zone_radius_m` 1000. It is verified like any site, by 10 backers (reports or yes votes). `insights.nearest_bin` is evidence only ("A mapped bin is X m away (OpenStreetMap)"); it never blocks verification or letters. Scores-v3 bin access is the complement of the share of verified sites that are verified no-bin zones, averaged with the measured distance to known bins.

**Long-range marking** (decision 20261011-0400-hem-long-range-target, issue 115). A resident who sees waste from a distance (across a vacant plot, a drain or a road, or from a rooftop) photographs it and drags a target pin, or taps the map, to where the waste is. The app sends it as `target`, next to `gps`; without it the waste is where the reporter stands. The api rejects a target more than 500 m from `gps` with 422 `target_too_far` and stores `target_distance_m`. The worker places the site, measures the merge radius, finds nearby places and the nearest bin, counts nearby verified reports for `ml`, and looks up the ward and seats from `target`; the `location_lookup` `lat` and `lon` are the target's. Authenticity stays on the phone's fix: the duplicate radius, `gps_accuracy_m` for `ml`, and the fresh-timestamp check; the duplicate lookup searches sites up to 540 m beyond its radius, so it finds earlier photos taken from the same fix whose sites sit at a long-range spot. A long-range report merges into a site only when both it and the site have an embedding and they match (cosine 0.88 or more, Me too included); otherwise it founds its own site, so a pin dropped on someone else's site cannot back it. One backer per person and `own_site` apply as for any report. A site's public point is always its spot, so `GET /sites` and `GET /sites/{id}` never carry a reporter's position. `GET /reports/{id}` returns both points only to the reporter who owns it.

**Ten people verify a site** (decision 20261010-1530). The models only gate each photo: a photo whose moderation passed and whose `verification_result.decision` is not `rejected` merges into a site, and a new site appears on the map as `unverified` ("1 of 10"). A model decision never verifies a site by itself. A person is a user id, else a device token, and counts once. A person backs a site with a model-passed photo of it or with a confirm vote (their latest vote). `site.backers` holds `count` (people who backed it either way), `needed` (10), `photo_people` and `vote_people`. At 10 backers the site becomes `verified`. Safety valve: when the distinct people whose latest vote is reject (and who sent no photo of it) exceed `backers.count` by 3 or more, the site becomes `rejected` and leaves the map. Verified and rejected are final; later votes still count but never change them. A report's status follows its site's verification once merged (`unverified`, `verified` or `rejected`), and scores count only reports in verified sites. The reporter (same user or same device) gets 403 `own_site`. Each device has one vote per site, and when counting the api keeps only the latest vote per person. Votes carry no weight. A rejected site refuses votes with 409 `site_rejected`. Once verified, `backers.count` never drops below its value at verification (stored as `verified_backers`), so a later yes-to-no flip never shows "9 of 10" next to verified.

**Withdrawal and clearing** (decision 20261010-1700). A signed-in reporter may withdraw their reports from a site that is not `verified`. The api moves the user's merged reports to the site's `withdrawn_report_ids` and sets each report's `status` to `withdrawn` (with `withdrawn_at`); nothing is deleted. If no report from anyone else is left, the site's `status` becomes `removed` (`removed_reason: withdrawn`, `removed_at`), final: it leaves `GET /sites?bbox`, takes no new photo, vote or cleanup, and never counts in scores or letters; its other fields stay as they were for the audit trail. Otherwise the site drops the user's reports, their backing and their blurred photos from `photo_urls`, recomputes `report_count`, `reporters`, `brands` and the first and last report times, then recounts the backers, so the no-vote valve can now reject it. Only a `no_bin` zone moves its centre (the mean of the remaining report points); a photo site keeps its pin. A withdrawn report's note no longer feeds `site.community` or a letter's residents line. Known edges: `me_too_count` is not per report, so `corroborations` can stay one too high, and cleared votes compare server vote times with the phone's `captured_at`. Yes votes alone never keep a site whose every report was withdrawn. Blurred public copies stay in the public bucket under the S3 layout below and originals follow their lifecycle rules; the api deletes no object. Clearing: a vote may also be `cleaned` ("it's cleared now"), and an accepted after-photo is its uploader's cleared word too (decision 20261010-1855). Each person (user id, else device token) counts once, by their latest word: a cleanup photo's word is timed at its `received_at`, a vote at its `voted_at`. When the people whose latest word is cleared, given after the site's `last_reported_at`, number at least `CLEANED_QUORUM` (3) and at least 3 more than the people whose latest vote is `confirm` cast after the first of those cleared words, the site becomes `cleaned` with `cleaned_at` the deciding word's time and `cleaned_by: after_photo` when an after-photo is among them, else `votes`. Until then `site.clearance` shows the progress: `count` cleared people, `still_there`, and `needed` (the larger of 3 and `still_there` plus 3); it is absent before the first cleared word. A cleaned site (by photo or votes) leaves the active map but stays in scores as cleared; a new photo reopens it as before, and then only cleared votes after that photo count. A `cleaned` vote on a cleaned site gets 409 `already_cleaned`.

**Cleanup.** The worker moderates and blurs the after-photo (`cln_` id, `near_site` check), then calls `/internal/verify` with `purpose: cleanup`. For a cleanup, `is_clean == (decision == "auto_verified")`, and the schema enforces it. The worker accepts the cleanup only when moderation passed and `is_clean` is true. On acceptance (decision 20261010-1855) the photo's uploader is added to `sites.cleanup_people` (once per person), `cleanup_photo_url` is set, and the site is recounted by the clearing rule above: `cleanup_status` goes `checking` to `pending_confirmation` while fewer than 3 people say cleared (the site stays on the map, `status` unchanged), or to `accepted` when this photo completes the count and the site becomes `cleaned`. A rejected photo sets `rejected`. A later photo may be sent while one is pending. When a report merges in, the worker recounts the cleared words against the new `last_reported_at`, so words given before the newest report stop counting and `pending_confirmation` returns to `none` once nobody's word counts; a cleaned site reopens as before. Rows cleaned by one photo before the decision stay `cleaned`.

**Expiry** (decision 20261010-1855). Every site written since carries `expires_at`, `SITE_TTL_DAYS` (90) after its last activity: a merged report (its `captured_at`), any vote, or an accepted cleanup photo (its `received_at`; a rejected photo does not count); activity only moves it later. `GET /sites/{id}` and `GET /sites?bbox` fill a missing `expires_at` from `last_reported_at`. A vote whose site the CronJob marks expired before the vote is counted gets 404 `not_found`. A row without `expires_at` expires 90 days after `last_reported_at`. An `open` or `reopened` site that is not rejected and is past `expires_at` is expired: `GET /sites?bbox` leaves it out and `GET /sites/{id}` shows `status: expired` at once, votes, cleanups and letters get 404 `not_found`, and area letters leave it out. Every `scores` CronJob run marks such sites `status: expired` (a conditional update that loses to a newer activity and bumps `version`) and leaves them out of every count and score; nothing is deleted, and `GET /sites/{id}` still opens them. Expired is final: a new report there founds a fresh site. Cleaned, removed and rejected sites never expire.

**Scans** (decision 20261010-0203). The phone records the video and the GPS track in sync, PUTs the video with the presigned URL, then posts the `scan_session`. For a `kind: scan` message the worker checks the video against the scan video limit, cuts one frame per second, and maps each frame's `t_ms` onto `gps_track` by linear interpolation between the fixes before and after it; the frame's `accuracy_m` is the larger of the two. It drops frames under the scan frame rule. For each kept frame it writes the JPEG to `reports/{upload_id}.jpg` in the originals bucket, a `report_upload` with `capture_mode: scan`, the `scan` link and the session's type, context, `device_token` and `user_id`, and the report row (`queued`), then sends a `kind: report` message. From there the frame runs the normal pipeline, moderation, blur and the same verification as a photo included. The video is never public and never goes to a model.

Spots (contracts v1.10): the worker groups the kept frames of a scan into spots, each frame joining the first spot whose first frame is within 20 m, and writes the spot's first `t_ms` as `scan_spot` on the report row. Frames of one spot and type merge into one site unless an existing neighbour site takes the frame, whatever their embeddings, so one person's ride past a dump is one site with one backer. That site's id is `site_` plus the first 26 hex characters of SHA-256 of `<scan_id>:<scan_spot>:<report_type>`; the merger reads it by id before the geohash query, and a frame that loses the race to found it merges into it. The worker merges up to 10 reports at once, so a site merge retries up to 11 times on a version conflict.

Area scout (contracts v1.10): with `report_type: auto` each frame row carries the placeholder claim `waste_dump`/`other` and `auto_claim: type`; the worker sends `report_type: auto, context: auto` to `/internal/verify`, and ml always runs the judge. Unless the decision is `rejected`, the report takes the judge's `report_type` and `context` (a context of another type becomes the type's fallback: `other`, `overflowing`, `stagnant` or `uncovered_debris`); a judge answer of `not_waste` or `no_bin` rejects the frame, and no answer at all fails the message so SQS retries. With a picked type and `context: auto` the row carries the type's fallback context and `auto_claim: context`; the worker sends `context: auto`, and the report takes the judge's context when the judge saw the same type. `no_bin` is never found from video.

**Letters.** Every citation has `verified: true`, and `verifier.verified` equals `verifier.total` and the number of citations. A draft that fails the quote verifier falls back to the template letter with the same verified citations; an unverified quote never ships. Cc follows `site.location`: the councillor only when there is a ward, the MLA only when there is an assembly seat (outside Rajasthan the MP only), and never the MP of a Lok Sabha seat with `status: outdated`.

**Area letters.** Same rule book, quote verifier, wording check, template fallback and counters as site letters. `to` follows the area kind: ward and assembly, the head of each local body with sites there; Lok Sabha and district, the District Collector of each district first, then the local body heads. `cc` is only the area's own seat, for attention: the ward councillor, the MLA, or the MP (never for an outdated Lok Sabha seat); a district letter has none. Rules are picked from the situation tags of every verified site of the issue (for Lok Sabha and district, Collector rules first), at most 4. `evidence` holds the issue's counts in the area, up to 5 worst verified sites with blurred photos, dates and measured insights, the measured `ward_scores` (withheld scores left out) and, for `waste_dump`, `no_bin` and `all`, bin access.

**Community notes.** Notes on a site and moderated report notes are read together by the `note_analysis` task on the Bedrock-only note router (never OpenAI): the notes go to the model as untrusted JSON data and the prompt says never to follow them. The answer must pass its schema, and each summary must state how many people it rests on and hold no blame word, named person, quote or long number; otherwise the summaries are written from the signals by code (`provider: junksnap`, `model: community-template`). `people` counts distinct authors (user id, else device, hashed), so one person's notes count once. Letters never quote a note: the "Residents report" line is written by code from `residents.signals`, and a model draft that retells it still passes the wording check.

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

`GET /reports/{id}` response. `status` is one of `queued`, `processing`, `unverified`, `verified`, `rejected`, `needs_review` or `withdrawn` (the reporter withdrew it; decision 20261010-1700) (rows written before decision 20261010-1530 may still say `community_check`, which means `unverified`). `site_id`, `blurred_url`, `moderation` and `verification` are null until each one exists. Mock mode builds this from the `jdh-1` and `jpr-1` fixtures.

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

`GET /scans/{id}` response. `status` is `queued`, `processing`, `done` or `failed`; `reason` is null, `invalid_video` or `retries_exhausted`. `report_ids` lists the frame reports queued so far, passed or not; poll each one with `GET /reports/{id}`. `found` (contracts v1.10) is null until `status` is `done`; then it is read from the frame reports on every call: `sites` counts the distinct sites that frames the models passed landed in, `by_type` the same per report type, `checking` the frames still in the pipeline, and `frames` each frame in time order with its `result` (`checking`; `added` to a verified site; `waiting` for neighbours in an unverified site; `not_waste`; `skipped` when moderation stopped it, a repeat view for example; `hidden` when neighbours hid its site; `failed` for `needs_review`; `withdrawn` when you withdrew it) and its public blurred copy (null when there is none). Only `sites` counts findings: a frame report is never a finding by itself.

```json
{
  "scan_id": "scn_jpr_1",
  "status": "done",
  "reason": null,
  "frames": { "sampled": 8, "kept": 8, "dropped_no_fix": 0 },
  "report_ids": ["rpt_jpr_1", "<7 more>"],
  "found": {
    "sites": 1,
    "by_type": { "open_construction": 1 },
    "checking": 0,
    "frames": [
      { "report_id": "rpt_jpr_1", "t_ms": 4000, "result": "waiting", "report_type": "open_construction", "site_id": "site_jpr_1", "blurred_url": "https://d111111abcdef8.cloudfront.net/media/reports/rpt_jpr_1.jpg" },
      "<7 more>"
    ]
  },
  "received_at": "2026-10-10T04:02:20Z",
  "updated_at": "2026-10-10T04:02:52Z"
}
```

`GET /sites?bbox` response: `{"type": "FeatureCollection", "features": [<site>, ...]}`.

Vote request (`vote` is `confirm`, `reject` or `cleaned`) and vote result (`votes.cleaned` counts people whose latest vote is `cleaned`):

```json
{ "device_token": "<uuid>", "vote": "confirm", "gps": { "lat": 26.8531, "lon": 75.8150, "accuracy_m": 10 } }
```

```json
{ "site_id": "site_jpr_1", "votes": { "confirm": 2, "reject": 0, "cleaned": 0 }, "backers": { "count": 3, "needed": 10, "photo_people": 1, "vote_people": 2 }, "verification": "unverified" }
```

Withdrawal result (`DELETE /sites/{id}/reports/mine`): the reports withdrawn, whether the site was removed, and the site's status, verification and backers afterwards. A retried call answers the same way.

```json
{ "site_id": "site_jdh_5", "withdrawn_report_ids": ["rpt_jdh_5"], "site_removed": true, "status": "removed", "verification": "unverified", "backers": { "count": 1, "needed": 10, "photo_people": 1, "vote_people": 0 } }
```

Cleanup request (the photo is presigned first, with `purpose: cleanup`) and its 202 response:

```json
{ "upload_id": "upl_jdh_3c", "device_token": "<uuid>", "sha256": "<64 hex>", "gps": { "lat": 26.2701, "lon": 73.0458, "accuracy_m": 8 }, "captured_at": "2026-10-09T06:20:00Z" }
```

```json
{ "cleanup_id": "cln_jdh_3c", "site_id": "site_jdh_3", "status": "checking" }
```

Letter request: `{"device_token": "<uuid>", "channel": "local_body", "language": "en"}`. `channel` takes the values of `letter_draft.channel`; `language` is `en` or `hi`.

Area letter request: `{"issue": "waste_dump", "language": "en", "device_token": "<uuid>"}`. `issue` is a report type or `all`; `language` is `en` or `hi`.

Note request: `{"text": "<1 to 280 characters>", "language": "en", "device_token": "<uuid>"}`. `language` is `en` or `hi`.

Verify request (worker to ml). `purpose` is `report` or `cleanup`; `ml` only ever reads the blurred copy. For a scan frame with an `auto_claim` (contracts v1.10), `report_type` and `context` are both `auto` (an area scout), or `context` alone is `auto`. ml then always runs the judge; a scout claim is supported by any type but `no_bin` and denied by `not_waste` and `no_bin`; a cleanup never takes `auto`.

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
| `reports` | `report_id` | none | `by-site` (`site_id`, `captured_at`); `by-device` (`device_token`, `received_at`); `by-user` (`user_id`, `received_at`) | `report_upload` fields (with `user_id`) top-level, `received_at`, `updated_at`, `status`, `completed_steps` (worker steps already done, from `moderate`, `verify`, `brands`, `locate`, `merge`, so a retried message resumes), `moderation_result`, `verification_result`, `brand_labels`, `location` (the full `location_lookup` the worker wrote), `site_id`, `withdrawn_at` (only on a withdrawn report), and for scan frames the table-only `scan_spot` (t_ms of the frame's spot) and `auto_claim` (`type` or `context`, contracts v1.10), and `target_distance_m` (only with a `target`: metres from `gps` to `target`, rounded to 1 m; with both points it is the long-range evidence, contracts v1.11) |
| `cleanups` | `cleanup_id` | none | none | `site_id`, `upload_id`, `device_token`, `user_id`, `gps`, `sha256`, `captured_at`, `received_at`, `status`, `moderation_result`, `verification_result` |
| `scans` | `scan_id` | none | none | `scan_session` fields (with `user_id`), `received_at`, `status`, `reason`, `frames`, `report_ids` |
| `sites` | `site_id` | none | `by-geohash` (`geohash4`, `last_reported_at`) | `site` properties (full `location`, `cleanup_status`, `insights`) top-level, `lat`, `lon`, `geohash4`, and the internals: `version` (each write sets it one higher, conditional on the stored value), `report_ids`, `merged_reports` (`[{report_id, verified, insights, point}]`, where `point` is `{lat, lon}` of the report's spot: its long-range `target` when set, else where the reporter stood, null on older rows; no-bin zones centre on the mean of these points), `reporter_devices`, `reporter_users`, `reporter_ids` (the photo people, one per user id else device token), `yes_voters` and `no_voters` (people whose latest vote is yes or no), `verified_backers` (`backers.count` frozen at verification, null before), `me_too_count`, `embedding_key`, `pending_cleanup_id`, `cleanup_people` (`[{person, at}]`: one entry per person whose after-photo was accepted, the user id else device token and the photo's `received_at`; decision 20261010-1855), `withdrawn_report_ids` (reports their reporter withdrew; kept, never counted; decision 20261010-1700); a row without `backers` predates decision 20261010-1530 and waits for the backers migration; the api builds the Feature |
| `votes` | `site_id` | `device_token` | none | `vote`, `user_id`, `voted_at` (older rows also hold an unused `weight`) |
| `devices` | `device_token` | none | none | `reputation`, report counts, `letter_window_start`, `letter_count`, `note_window_start`, `note_count`, `withdraw_window_start`, `withdraw_count`, `first_seen`, `blocked` |
| `users` | `user_id` | none | none | `reputation`, report counts, `letter_window_start`, `letter_count`, `note_window_start`, `note_count`, `withdraw_window_start`, `withdraw_count`, `first_seen`, `blocked`; never the user's name or email |
| `scores` | `area_kind` | `area_id` | none | the latest `ward_scores` per area, with `insights`, top-level, plus `within`: the sorted district and local body ids of the area's sites (from `site.location.district.id` and `site.location.local_body.id`); the CronJob overwrites both, the api strips `within` and the keys before validating the body |
| `crawls` | `district_id` | none | none | one row per district: `district_name`, `status` (`queued`, `running`, `done`, `failed`, `no_sources`), `queued_at`, `started_at`, `last_crawled_at`, `next_due_at`, `expected_by`, `city` (the source file), `wards_found`, `wards_key`, `results` (per source: `url`, `status`, `wards_found`, `page_sha256`, `fetched_at`, `detail`), `error`, `attempts`, and `verified_report_ids` (a string set, only until the district is queued) |
| `notes` | `site_id` | `note_id` (`note_<ulid>`) | none | one row per note: `author_hash` (SHA-256 of the user id; never the id, never shown), `status` (`shown` or `hidden`), `text` (shown notes only), `language`, `moderation` (the note_moderation verdict), `created_at` |

Every GSI (`by-site`, `by-device`, `by-user`, `by-geohash`) projects ALL attributes, so a query returns whole items and needs no second read.

For a bbox query, compute the geohash4 cells that cover the bbox, query `by-geohash` once per cell and filter by `lat` and `lon`. To merge, query the cells that cover the merge radius around the report and keep sites within it: 40 m for a photo site, 500 m from the centre for a `no_bin` zone (the nearest open zone wins; decision 20261010-1630). The worker writes the full location and the merged insights into the site when merging, and the api reads the location from the sites table for letters. When a site first lands in an area with no `scores` row (its ward, assembly seat, Lok Sabha seat or district), the worker creates a zero-count row for that area with every score withheld, using the area name from `site.location`. The write is conditional and never overwrites, so `GET /areas/{kind}/{id}/scores` always has a source. The seeded row's `within` holds the founding site's district id and local body id; the next CronJob run rewrites it from every site in the area. A row without `within` (seeded before contracts v1.3) is left out of `GET /areas/{kind}` until the CronJob rewrites it.

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
| same | `crawl/pages/{sha256}.json` and `crawl/pages/{sha256}.bin` | every page the crawler fetched: `{url, sha256, fetched_at, content_type, etag, last_modified, text}` and the raw bytes (`sha256` is of the bytes); `crawler` only |
| same | `crawl/urls/{sha256(url)[:24]}.json` | the newest page for a URL: `{url, sha256, fetched_at, checked_at, etag, last_modified}`, for conditional refetches; `crawler` only |
| same | `crawl/extractions/{key}.json` | one model extraction per page chunk: `{key, prompt_version, models, source_url, page_sha256, chunk_sha256, model: {provider, model, version}, wards, created_at}`; `key` is SHA-256 of the prompt version, the model chain, the request and the chunk, so a changed prompt or page misses; `crawler` only |
| same | `crawl/layers/{kind}-{sha256(bbox)[:16]}.json` | the last OpenStreetMap layer fetched for a city box (same shape as a `map_layers` entry), reused for `CRAWL_INTERVAL_DAYS` and when Overpass is busy; `crawler` only |
| same | `crawl/wards/{city}.json` | the crawl output, same shape as `data/wards/<city>.json`, always `unreviewed`; `crawler` writes, and never over a stored file with more records or a map layer kind the new crawl lacks, nor when no official page was fetched (the crawl is then `failed` and retried after `CRAWL_RETRY_HOURS`); `worker` (at start) and `scores` (every run) read it, keeping per city the file with more reviewed records, then one with map layers, then the newer one |
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
| `ORIGINALS_BUCKET` | api, worker, ml (`embeddings/` and reads `models/`), scores and worker (read `crawl/wards/`), crawler (`crawl/`) | `junksnap-<stage>-originals-<account_id>` |
| `CRAWLS_TABLE` | api (read), worker (queue a district), crawler | `junksnap-<stage>-crawls` |
| `NOTES_TABLE` | api | `junksnap-<stage>-notes` |
| `NOTES_PER_HOUR` | api | `10`: notes per hour per user and per device |
| `CRAWL_ACTIVATE_AFTER` | worker | model-passed photos merged into sites in a district before it is queued for a crawl; default `1` |
| `CRAWL_INTERVAL_DAYS`, `CRAWL_RETRY_HOURS` | crawler | days between crawls of a district (default `30`) and hours before a failed crawl is retried (default `6`) |
| `CRAWL_SOURCES_DIR`, `CRAWL_SCHEMA` | crawler | optional: the `sources/` folder and the `ward_record` schema file; the image sets both |
| `CRAWL_MODELS` | crawler | optional JSON list of Bedrock extraction models in order, `[{"model_id", "version", "usd_per_million_in", "usd_per_million_out"}]`; the CronJob uses Nova Pro, then Nova Lite |
| `PUBLIC_BUCKET` | worker, ml (reads `media/` only) | `junksnap-<stage>-public-<account_id>` |
| `PUBLIC_BASE_URL` | api, worker | CloudFront base URL, no trailing slash |
| `REPORTS_QUEUE_URL` | api, worker | URL of `junksnap-<stage>-reports` |
| `CORS_ORIGINS` | api | comma-separated: the Amplify URL and `http://localhost:5173` |
| `PRESIGN_TTL_SECONDS` | api | `300`, for photos and scan videos |
| `ML_URL` | worker | `http://ml` (the Service in the same namespace); replaces `AGENT_URL` |
| `OPENAI_SECRET_ID` | api (letters), ml (judge) | `junksnap/<stage>/openai-api-key` (Secrets Manager, decision 0133) |
| `OPENROUTER_SECRET_ID` | planned (decision 0133); no provider yet | `junksnap/<stage>/openrouter-api-key` (Secrets Manager); neither `api` nor `ml` has an OpenRouter provider |
| `BIN_RADIUS_M` | worker, api | `3000`: no known bin within this many metres sets `site.insights.no_bin_within_3km` |
| `NO_BIN_MIN_REPORTERS` | api | unused since decision 20261010-1630 (a no-bin letter needs a verified zone) |
| `ASSETS_DIR` | api, worker, scores | directory holding the repo's `data/` files (`rules/`, `brands/`, `boundaries/`, `wards/`, `representatives/`); `/app/data` in the image |
| `LLM_TASKS` | api, worker, ml | optional JSON `{"<task>": {"provider", "model", "fallback": []}}`; each service reads only its own tasks (api: letters; worker: note moderation, Bedrock only; ml: judge); defaults live in code |
| `WEB_URL` | api | optional: the stage's public web app, no trailing slash, where link previews send people; unset, the api uses the first `https` origin in `CORS_ORIGINS` that is not a localhost, else `http://localhost:5173` |
| `VITE_API_URL` | frontend | the CloudFront base URL, no trailing slash |
| `VITE_API_MODE` | frontend | `mock` (reads `contracts/fixtures/`) or `live` |
| `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID` | frontend | the same pool and app client as the api |
| `VITE_WEB_URL` | frontend | the stage's public web app, `https://<stage>.<Amplify default domain>`, no trailing slash; the app's links point here (the Android app's own origin, `https://tauri.localhost`, is not public); in live mode share buttons use the api's `/share/*` link-preview routes instead. Set by `deploy_web.py` and `build_android.py`; unset, links use the page's origin |
| `JUNKSNAP_DATA_CACHE` | training tooling in `backend/ml/training` (local, not a workload) | local folder for downloaded training images, outside the repo and never committed |
| `ML_MODEL_DIR` | ml | optional local folder for downloaded model files; default `/tmp/junksnap-models` |
| `JUNKSNAP_REPO` | training tooling (local, not a workload) | path to the repo checkout, for `data/datasets/` manifests and `contracts/` |

Reverse geocoding uses Amazon Location Places v2 (`geo-places:ReverseGeocode`), which needs no place index, so there is no `PLACE_INDEX` variable; the worker's Pod Identity role gets that one action.

## Stages and names

- Stages: `dev` for building, `demo` for the recording. Region `ap-south-1` for everything.
- One EKS Auto Mode cluster, `junksnap`, with namespaces `junksnap-dev` and `junksnap-demo`. Deployments `api`, `worker` and `ml`, plus the CronJobs `scores` (every 15 minutes) and `crawler` (hourly: queued and due districts from the `crawls` table). Containers listen on 8000; the `api` and `ml` Services listen on 80.
- Images, in ECR repositories of the same names: `junksnap-server` runs `api`, `worker` and `scores` (one image, a different command each); `junksnap-ml` runs `ml`; `junksnap-crawler` (`data/ward_crawler`) runs `crawler`.
- AWS resources are named `junksnap-<stage>-<thing>`; bucket names add `-<account_id>` because S3 names are global; secrets use `junksnap/<stage>/<name>`. Tags: `project=junksnap`, `stage=<stage>`.

## Seed samples

| Sample | City | Site | What it shows |
|---|---|---|---|
| `jdh-1` | Jodhpur | `site_jdh_1`: waste_dump, vacant_plot, open, verified by 10 backers (5 by photo, 5 by vote), cleanup checking | the full chain: report by a signed-in user, moderation, a photo the models passed with fixed weights, insights, brand label, location in seat `s20-ac-128` with no ward map, area scores and insights for that seat, letter Cc MLA and MP; a ward record from the crawler |
| `jdh-2` | Jodhpur | `site_jdh_2`: no_bin, no_pickup, open, verified | a no-bin zone (`zone_radius_m` 1000) in seat `s20-ac-127` that 10 people confirmed; nearest mapped bin 4.2 km |
| `jdh-3` | Jodhpur | `site_jdh_3`: contaminated_water, choked_drain, reopened | an accepted cleanup (`cln_jdh_3c` moderation and verification, insights null), then reopened; a hazard and nearby places |
| `jdh-5` | Jodhpur | `site_jdh_5`: waste_dump, roadside, removed, unverified | its only reporter withdrew the report (decision 20261010-1700): `removed_reason: withdrawn`, left out of the map and the scores |
| `jdh-6` | Jodhpur | none | an area scout scan session (`scn_jdh_6`, `report_type` and `context` `auto`): 6 s at walking pace |
| `jdh-far` | Jodhpur | none (report only) | a long-range report: `target` about 123 m from where the reporter stood, across a vacant plot |
| `jpr-1` | Jaipur | `site_jpr_1`: open_construction, uncovered_debris, unverified, 2 of 10 backers | a scan session (`scn_jpr_1`) and its frame at 4 s, meta-learner with disagreement and a stored embedding, no ward map, scores and area shares withheld |

All fixture data is sample data, except `ward_record.jdh-1`, which is a real, unreviewed crawler record (its body `jodhpur-uttar-mc` predates the November 2025 merger; its id follows the ward rule). Coordinates are plausible; seat codes match the loaded boundaries; the brand and OpenStreetMap ids are invented; rule quotes are placeholders; user ids are random. Sample ids are short; real ids follow the rules above. No fixture names a person.

## Shared wording

- Say "verified" only for a site 10 people backed. Otherwise say "n of 10 people confirmed".
- Say "waste site", "reported" and "cleared". Never say "illegal" or "culprit", and never name a person.
- Every Cc line says "for attention". Letters address offices, never people.
- Below the guardrail, say "Not enough verified reports yet (N of 10)". Always show counts, and label Jodhpur data "Pilot city".
- For brands, say "packaging seen at this site", and only when the label is readable with confidence 0.8 or more.
- For insights, show each number with what it rests on, for example "Plastic about 52% (6 reports)", and the model on tap. Say "small", "medium" or "large pile"; never a weight.
- Say "near a school" (or a hospital, water body or open drain) only from `site.insights.near`, with the distance and "OpenStreetMap".
- Address people as "you" in the app. Never show another user's id, email or name.
- For letters, say "Draft for you to file". JunkSnap never files anything.
