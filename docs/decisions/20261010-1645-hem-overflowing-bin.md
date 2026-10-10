---
status: accepted
superseded_by:
area: contracts
by: hem
date: 2026-10-10T16:45+05:30
---
# New report type overflowing_bin: an overflowing or broken public bin

Context: a bin that is there but overflowing, broken, burnt or missing its lid is a different failure from no bin at all (city service, not access). Residents report it often and it fits no existing type. Approved by the lead on 10 Oct (issue 100).

Decision:
- `overflowing_bin` ("Overflowing or broken bin") joins every `report_type` enum: `report_upload`, `scan_session`, `site`, the `verification_result` judge, and `area_letter_draft` (issue and worst sites). Contexts: `overflowing` (waste over the brim or spilling around it) and `damaged` (broken, burnt or missing its lid). The schemas enforce the pair.
- ML: the judge describes and may answer the new type; a YOLO `bin` box with waste items near it supports the claim. The stacker falls back to the judge with a stated reason until it has training rows for the type.
- Sites merge it like other types (same type, 40 m). Scores count it under city response as bins not serviced: formula `scores-v3` adds bin service % (verified overflowing_bin sites ever cleared / all of them) as a fifth city part, exposed as the optional `ward_scores.metrics.bin_service_pct`, and a value under 50 triggers `city_response`. It stays null until the area has at least 3 verified overflowing_bin sites. Bin access never measures overflowing_bin sites, which stand at a bin (decision 20261010-0238 updated). Letters ask the local body to empty the bin regularly and repair or replace it, citing only the existing verified SWM clauses on collection and storage containers; no new rule text.
- No change to `no_bin` and its eligibility rules.

Consequences for other lanes: frontend adds the chip, icon, filter, pin and en/hi strings. Server letter wording and clause picker add the type. Additive only; v1.6 producers stay valid.

Rejected alternatives: a context under `no_bin` (it would inherit the no-bin eligibility rule, which measures bin distance, not bin state); a hazard flag on `waste_dump` (no letter or score of its own).
