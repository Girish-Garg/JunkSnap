---
status: accepted
superseded_by:
area: contracts
by: hem
date: 2026-10-11T17:50+05:30
---
# Residents draft a site letter for any open site, verified or not; the letter says how far it is

Context: a site waits for 10 people before it is verified, and residents wanted to write to the local body before then. Approved by the lead in chat on 11 Oct ("we should let people draft letter for any site, verified or unverified").

Decision:
- `POST /sites/{id}/letters` drafts for any site that is not removed, rejected or expired, `unverified` or `verified`. Removed or expired: 404 `not_found`; rejected: 409 `site_rejected`. The site route no longer answers 409 `not_verified`.
- The letter is honest about its standing: the template and the model prompt state the reporters and backers so far ("Reported by 2 residents; community verification in progress (3 of 10 people confirmed so far)"), and say verified only at 10. A model draft that calls an unverified site verified falls back to the template.
- `letter_draft.evidence` gains optional `verification` and `backers` (`count`, `needed`); contracts v1.17. Quote verifier, rule picking and the 5 letters an hour are unchanged.
- Area letters keep the `MIN_VERIFIED_REPORTS` (10) rule and their 409 `not_verified`.

Amends: 20261010-1530-hem-ten-people-verify ("site letters needing a verified site stay") and, for site letters only, the "Site and area no-bin letters need a verified zone" part of 20261010-1630-hem-no-bin-zones.

Consequences for other lanes: the app offers Draft letter on every open site and notes when the spot is not verified yet; scores, verification and area letters are unchanged.

Rejected alternatives: a lower bar (for example 3 backers) before a letter; keeping no-bin zones at 10 people (the request named any site).
