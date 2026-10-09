---
status: proposed
superseded_by:
area: contracts
by: hem
date: 2026-10-10T02:53+05:30
---
# site.verified_count counts the merged reports the models auto-verified

Context: `verified_count` feeds the area guardrail (at least 10 verified reports) and the score counts, but the contract does not say which reports count. A report's status follows its site, so "reports whose status is verified" would equal `report_count` on every verified site, which contradicts the jdh-1 fixture (7 reports, 6 verified).

Decision:
- `verified_count` is the number of merged reports whose own `verification_result.decision` was `auto_verified`. A community-check report that merges into a verified site raises `report_count` only.
- Votes never change it: a site confirmed by neighbours shows `verification: verified` and its `corroborations`, and `verified_count` grows only as auto-verified reports merge in.
- All four site fixtures fit: jdh-1 6 of 7, jdh-2 3 of 3, jdh-3 5 of 5, jpr-1 0 of 1.
- Related merge value: when both the site and the report have an `embedding_key`, they merge only at cosine 0.75 or more (planned, not yet measured on real photos).

Consequences for other lanes: scores sums `verified_count` over verified sites for `counts.verified_reports`, so a site confirmed only by votes adds 0 until a model-verified report merges in. The site panel can show it next to `corroborations`.

Rejected alternatives: reports whose status is verified (always equals `report_count` on a verified site); adding community-confirmed reports (one settled vote would add a whole site's reports at once).
