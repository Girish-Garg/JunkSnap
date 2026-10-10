---
status: accepted          # proposed | accepted | superseded
superseded_by:            # filename of the replacement, if any
area: contracts           # frontend | data | agent | infra | contracts | process
by: hem                   # person code
date: 2026-10-11T02:54+05:30
---
# Activity restores from GET /me/reports, behind a 60 s list token

Context: Activity read only this phone's IndexedDB queue, so on another phone, in the app versus the browser, or after cleared data, it was empty. The human asked that a signed-in user always sees their own reports after re-login.

Decision:
- `GET /me/reports?limit=&cursor=` (contracts v1.14, `report_list`): the user's own Snap reports (no scan frames), newest first, from the existing `reports` `by-user` GSI. Each item is the `GET /reports/{id}` body. The cursor must name the asking user, else 400. A malformed row or another user's row is skipped with a warning. No infra change.
- Tokens: the list token `activity.token` holds an account key (SHA-256 of the Cognito `sub` read from the ID token, the api's user_id; never the email), `synced_at` and the newest `updated_at`. Each row keeps `synced_at`. A sync runs when the token is missing, more than 60 s old, or another account's. Checking reports still poll every 15 s.
- Shared phone: sent rows show only after a sync confirms the list for the signed-in account. A missing or foreign token counts as an owner change: the sync removes sent photos and videos saved before this sign-in, even from an incomplete listing; unsent rows and rows saved in this sign-in stay. Sign-out removes sent rows and the token; reports come back on the next sign-in.
- Merge: a changed `updated_at` updates the row. A withdrawn report never becomes a new row. With the same account, a complete listing drops a sent row that was listed before. Deleted ids (`activity.dismissed`) never come back, but only the newest 500 are kept: an older one can return unless it is withdrawn.
- The token logic sits in `ActivityFreshness`, to move onto the shared expiring cache (fe-126).

Consequences for other lanes: the server adds a route; there is no infra change. Scans are not listed: the `scans` table has no `user_id` GSI, and adding one needs the human. Until then a video removed at sign-out does not come back. With many scan frames, filtered GSI pages run short, so the app reads at most 10 pages of 50 and drops rows only after a complete listing.

Rejected alternatives: keeping rows across sign-out, because a shared phone would show them to the next account; scanning `reports` by user, which is too costly.
