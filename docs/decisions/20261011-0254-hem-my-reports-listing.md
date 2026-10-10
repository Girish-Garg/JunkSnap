---
status: proposed          # proposed | accepted | superseded
superseded_by:            # filename of the replacement, if any
area: contracts           # frontend | data | agent | infra | contracts | process
by: hem                   # person code
date: 2026-10-11T02:54+05:30
---
# Activity restores from GET /me/reports, behind a 60 s list token

Context: Activity read only this phone's IndexedDB queue, so after signing in again on another phone, the Android app versus the browser, or after cleared site data, the list was empty. The human asked that a signed-in user always sees their own reports, and that an old local copy be revalidated with the server.

Decision:
- New signed-in route `GET /me/reports?limit=&cursor=` with schema `report_list` (contracts v1.14): the token's user's own Snap reports (photos and no-bin, no scan frames), newest first, read from the existing `reports` `by-user` GSI. Each item is the `GET /reports/{id}` body. The cursor is the GSI key, which must name the asking user, else 400. No table, key or infra change.
- The app keeps a list token in the meta store (`activity.token`: an opaque account key (SHA-256 of the email), `synced_at`, the newest `updated_at`), and gives each row `synced_at` beside its status `updated_at`. On open it shows the local rows, then revalidates when the token is missing, older than 60 s, or belongs to another account. Reports still being checked are polled every 15 s as before.
- Merge (`ActivityMerge`): a listed report updates its row when `updated_at` changed, or becomes a new row (id = photo sha256, else report id). A complete listing drops a sent row it lacks when that row was listed before or another account's rows are on the phone. Unsent rows always stay. Report ids deleted from Activity are remembered (`activity.dismissed`) so a listing never brings them back.
- Sign-out does not clear the phone's rows. Activity needs sign-in, and the next sync drops another account's sent rows.
- The token logic sits in `ActivityFreshness` so it can move onto the shared expiring-cache primitive (fe-126-cache-tokens).

Consequences for other lanes: server adds a route and adapter (no infra). Scans cannot be listed yet, because the `scans` table has no `user_id` GSI. Adding one is an infra change that needs the human. Mock mode lists nothing, so local rows stay.

Rejected alternatives: clearing the phone's rows on sign-out (it loses unsent photos, and the server restores the rest anyway); a scan of `reports` by `user_id` (cost, and it pages badly).
