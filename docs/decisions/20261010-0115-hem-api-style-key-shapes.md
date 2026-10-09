---
status: proposed
superseded_by:
area: contracts
by: hem
date: 2026-10-10T01:15+05:30
---
# API style and key shapes for contracts v1

Context: every task builds and mocks against the same shapes, so the API style and the shapes that cross workloads have to be fixed before wave 1.

Decision:
- Plain JSON REST over one CloudFront base URL, snake_case, no version prefix in paths, ISO 8601 UTC times. Errors are `{"error": code, "message": text}`. The ALB sends `POST /sites/*/letters` to `agent` and every other path to `api`; `/internal/verify` and `/internal/brands` are cluster-only.
- No login. The phone's `device_token` (UUID v4) keys reputation, rate limits and votes, and `GET /reports/{id}` needs it in `X-Device-Token`.
- Ids are a prefix plus a lowercase ULID (`upl_`, `rpt_`, `site_`, `ltr_`); `rpt_x` reuses the suffix of `upl_x`, which makes `POST /reports` idempotent. Area ids are `s20-ac-127`, `s20-pc-16`, `rajasthan-jodhpur` and `<local-body>-w<n>`.
- `site` is a GeoJSON Feature with `site_id` inside `properties` (for MapLibre `promoteId`). It carries `verification` (`verified` or `community_check`), because votes target sites.
- Every model decision records flat `provider`, `model` and `version` fields. Scores are 0 to 100, higher is better, each `{value, reason}`, null below 10 verified reports.
- Presign returns the headers to send, including `x-amz-checksum-sha256`, so S3 enforces the client hash. Blurred copies live under `media/` in the public bucket and are served by CloudFront `/media/*`.
- DynamoDB: one table per entity, and a `by-geohash` (geohash4) GSI on sites for bbox queries and merging.
- Cleanups reuse `moderation_result` and `verification_result` (`cln_` ids, `purpose: cleanup`, `is_clean`), live in a `cleanups` table, and are polled through `site.cleanup_status`. The api owns the community check: vote weight 0.5 + reputation, settling at +3 (verified) or -3 (rejected). `site.location` carries the full location, so letters need no extra lookup.

Consequences for other lanes: I1 builds the tables, buckets, queue and ALB rules exactly as `contracts/README.md` lists them. F1 mocks from `contracts/fixtures/`. A1, D1, D2, D3 and A4 emit these shapes and round-trip the fixtures in contract tests.

Rejected alternatives: GraphQL; a Cognito login (too slow to build before the deadline); a single-table DynamoDB design; trusting scores from the phone.
