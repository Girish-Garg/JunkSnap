---
status: accepted
superseded_by:
area: contracts
by: hem
date: 2026-10-10T18:55+05:30
---
# Three people clear a site, and a site expires after 90 days without activity

Context: one accepted after-photo took a real dump off the map, and the lead asked that "cleaned" need more people. The lead also set a default 3-month lifetime on every site. Updates the cleared-votes rule of 20261010-1700; the rest of it stands.

Decision:
- An accepted after-photo is its uploader's cleared word, not a cleanup. Words are after-photos (`received_at`) and `cleaned` votes; each person (user id, else device) counts once by their latest word.
- `cleaned` needs `CLEANED_QUORUM` = 3 people with cleared words after `last_reported_at`, and 3 more than the `confirm` voters after the first word (the 1700 surplus). Until then `cleanup_status: pending_confirmation`, `site.clearance` {count, needed, still_there}, still on the map. Each merged report recounts it, so words before the newest report drop; stored cleaned rows stay cleaned.
- `cleaned_by: after_photo` when an after-photo is among the clearers, else `votes`. Scores and `everCleared` are unchanged for cleaned sites.
- `SITE_TTL_DAYS` = 90: `site.expires_at` is 90 days after the latest report, vote or accepted cleanup photo (a rejected photo never keeps a site alive). An open or reopened site past it is `status: expired` (soft, final, never deleted): off `GET /sites?bbox`, letters, area letters and scores; votes and cleanups get 404.
- Lazy on read in the api; the `scores` CronJob marks rows with a conditional update (new `dynamodb:UpdateItem` on sites for the scores role). A new report at an expired spot founds a fresh site.

Consequences for other lanes: frontend shows "n of 3 people say it's cleared" with "It's cleared now" / "Still there" on a pending site, and "Expires in N days unless someone confirms it". Contracts are additive (v1.12). Infra needs a stack deploy for the scores role. ml unchanged.

Rejected alternatives: DynamoDB TTL hard delete (erases history scores count); reopening an expired site (would revive old verification); counting one person's photo and vote twice.
