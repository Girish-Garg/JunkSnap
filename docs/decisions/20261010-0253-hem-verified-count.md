---
status: superseded
superseded_by: 20261010-1530-hem-ten-people-verify.md
area: contracts
by: hem
date: 2026-10-10T02:53+05:30
---
# site.verified_count counts reports verified by the models or by neighbours' votes

Context: `verified_count` feeds the area guardrail (at least 10 verified reports) and the score counts, and `site.insights` and `burning` come from the same verified reports. The contract does not say which reports count. A report's status follows its site, so "reports whose status is verified" would equal `report_count` on every verified site, which contradicts jdh-1 (7 reports, 6 verified).

Decision:
- A merged report counts as verified when the models auto-verified it, or when it was waiting in community check on the site at the moment neighbours' votes settled the site as verified.
- A community-check report that merges into a site that is already verified is not counted: neither a model nor a vote checked it. jdh-1's seventh report is such a report. Its status still follows the site.
- `site.insights` (and `burning`, true exactly when `insights.hazards` lists burning) merge the insights of these verified reports only. The worker recomputes them on merge, and the api recomputes them when votes settle the site.
- All four site fixtures fit: jdh-1 6 of 7, jdh-2 3 of 3, jdh-3 5 of 5, jpr-1 0 of 1.
- Related merge value: when both the site and the report have an `embedding_key`, they merge only at cosine 0.75 or more (planned, not yet measured on real photos).

Consequences for other lanes: scores sums `verified_count` over verified sites for `counts.verified_reports`. The site panel can show it next to `corroborations`.

Rejected alternatives: reports whose status is verified (always equals `report_count` on a verified site); auto-verified reports only (a site confirmed by neighbours would show 0 verified reports and no insights).
