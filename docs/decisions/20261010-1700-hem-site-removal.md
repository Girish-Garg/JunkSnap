---
status: accepted
superseded_by:
area: contracts
by: hem
date: 2026-10-10T17:00+05:30
---
# Reporters withdraw unverified reports; withdrawn, rejected and cleared sites leave the map

Context: the lead asked that a reporter can delete their site while it is not verified, and that sites with heavy no votes or cleared votes go automatically. Keeping evidence and "never invent history" rule out hard deletes.

Decision:
- `DELETE /sites/{id}/reports/mine` (signed in, `X-Device-Token`, 10 an hour per user and per device) withdraws the user's merged reports (matched on `user_id`) while the site is not `verified`; else 409 `site_verified`. No report: 404.
- Soft removal: reports get `status: withdrawn`; the site keeps them in `withdrawn_report_ids`. If no one else's report is left, the site becomes `status: removed`, `removed_reason: withdrawn`, final, never counted. Yes votes alone do not keep a site with no reports.
- Otherwise the site drops the user's backing, photos, brands and report notes, recomputes counts and dates (a no-bin zone also its centre), then recounts backers (the no-vote valve may then reject it). A removed site shows no photo.
- The no-vote valve of 20261010-1530 is unchanged; a rejected site leaves `GET /sites?bbox` on the vote that tips it.
- Vote `cleaned`: people saying cleared after the newest photo, 3 more than yes votes after the first cleared vote, set `status: cleaned`, `cleaned_by: votes`. A new photo reopens it.
- `GET /sites?bbox` leaves out `rejected`, `removed` and `cleaned`; cleaned sites still count as cleared in scores. No S3 object is deleted.

Consequences for other lanes: the app shows "Withdraw my report" to this phone's reporter and a "cleared now" vote; every Activity row gets Delete (withdraw from an unverified site, hide a verified one with a plain note, else remove from the phone); ml is unchanged.

Rejected alternatives: hard delete; deleting the blurred copy; keeping cleaned sites on the active map.
