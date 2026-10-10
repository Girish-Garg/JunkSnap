---
status: accepted
superseded_by:
area: contracts
by: hem
date: 2026-10-10T16:00+05:30
---
# Area letters: one cited letter about one issue in a ward, seat or district

Context: one letter per site does not show a pattern. Residents need one letter to the office responsible for a whole area. Approved by the lead on 10 Oct (issue 89).

Decision:
- `POST /areas/{kind}/{id}/letters`, signed in, with body `{issue, language, device_token}`. `issue` is a report type or `all`. The response is the new schema `area_letter_draft`.
- Addressees by office only. Ward and assembly go to each local body head with sites there. Lok Sabha and district go to the District Collector of each district, then those heads. Cc is the area's own seat for attention, never an outdated MP seat.
- 409 `not_verified` until the issue's verified sites in the area hold 10 verified reports (the area guardrail); the message gives the count.
- Same rule book, quote verifier, wording check, template fallback and 5-per-hour counters as site letters.
- Evidence: issue counts, distinct reporters, up to 5 worst sites with photos and insights, measured scores only, and bin access.

Consequences for other lanes: the frontend adds the area letter preview. The api now needs `SCORES_TABLE` for letters too. Sites are found with a filtered scan of the `sites` table, fine at pilot scale.

Rejected alternatives: reusing `letter_draft` (its `site_id` and single `to` do not fit an area), and a letter per site sent in a batch.
