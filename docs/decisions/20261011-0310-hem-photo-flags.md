---
status: accepted
superseded_by:
area: contracts
by: hem
date: 2026-10-11T03:10+05:30
---
# Residents report site photos; only many reports warn or hide a photo

Context: the lead asked for a warning when people report a photo as unrelated, with an optional description, and that action is taken only when a lot of people report it. No new paid resource.

Decision:
- `POST /sites/{id}/photos/{photo}/flags` (signed in): `reason` `unrelated`, `person_or_property`, `duplicate` or `offensive`, optional `text` up to 200 characters moderated like notes (Bedrock only, hidden if flagged). Photo id is the report id. One row per user per photo (latest wins); the photo's own reporter (user or device) gets 403 `own_photo`; 10 an hour per user and per device.
- Storage: the existing `notes` table, sort key `flag#<photo>#<author_hash>`, author and device as one-way hashes only. No new table or index.
- Count per photo by distinct people: each user once and each device once.
- `PHOTO_FLAG_WARN` = 3: `warned`, the app blurs it more behind "Several people reported this photo".
- `PHOTO_FLAG_HIDE` = 8, or `PHOTO_FLAG_HIDE_EARLY` = 5 with `PHOTO_FLAG_SURPLUS` = 5 more flags than the site's backers other than the photo's reporter: `hidden`, final, out of `photo_urls`; blurred copy, report row and flags kept (soft, as 20261010-1700).
- An unverified site whose every remaining report is a hidden photo becomes `removed`, `removed_reason: photos_reported`, whatever its backers (the 8-report rule already ignores them).
- Shown descriptions feed `note_analysis` as neutral signals marked as photo reports; never shown, quoted or put in a letter.

Consequences for other lanes: contracts v1.15 (additive); frontend adds "Report this photo" in the strip and viewer, a reason sheet, a toast and the tap-to-view cover; infra unchanged (the api role already has PutItem and Query on notes); ml unchanged.

Rejected alternatives: a new flags table (paid resource, needs approval); the votes table (its sort key is the device and every vote count would have to skip flag rows); acting on one report; deleting the photo.
