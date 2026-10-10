---
status: accepted
superseded_by:
area: agent
by: hem
date: 2026-10-11T03:05+05:30
---
# The judge answers yes, no or uncertain per attribute; an uncertain answer asks the reporter

Context: the #123 replay (docs/ml/eval.md) sent 58 of 119 clean photos to community check: the judge named `no_bin` or `overflowing_bin` on clean bins and streets, and another type scored 0.5. A real overflowing bin every detector was sure of was rejected for `photo_unclear`. The human asked for a structured answer (`garbage: no, bin: no, reasoning, user verdict, ...`), each state yes, no or uncertain, and for uncertain answers to ask the reporter to report only if 100% sure.

Decision (supersedes 20261011-0230, whose support mapping, evidence suffix and cleanup guard stay as restated here):
- Prompt `judge_v1`: `garbage`, `bin`, `bin_overflowing_or_broken`, `water_contamination`, `construction_debris`, `burning`, `photo_usable` and `user_verdict` (does the photo support the reporter's claim, now stated in the user prompt), each yes, no or uncertain, plus `user_verdict_confidence`, `context`, `reasoning` and the old brands, composition, size, hazards and scene fields. A missing or unreadable state is uncertain; an object judging none of them is invalid, so the router tries the next model. `report_type`, `context` and `burning` are derived; `verification_result.judge.attributes` carries the answer and prompt version (contracts v1.16).
- Each claim needs: waste_dump `garbage`; overflowing_bin `bin` and `bin_overflowing_or_broken`; contaminated_water `water_contamination`; open_construction `construction_debris`; an area scout any of them; no_bin is never judged (support 0.5, no judge rule); a cleanup `photo_usable` yes, `garbage` no, `user_verdict` yes and the scene check, else support 0.
- Report rules, first match wins, recorded as `+<reason> by <models>` on `combiner.version`: `photo_usable` no rejects (`judge_veto:unclear`); `user_verdict` or a needed attribute no rejects (`judge_veto:not_waste` when no waste of any kind is seen, else `low_support`); either becomes `community_check` (`judge_unclear:detector_yes`, `judge_no:detector_yes`) when YOLO, our trained object detector, is at 0.5 or more (the embedding head does not count: it gave 0.77 to the prod indoor-cupboard photo; Rekognition labels do not count: they are at 0.5 or more on 31 of 119 clean test photos); anything else uncertain gives the new decision `needs_confirmation` (`judge_unsure:ask_reporter`); a yes is combined as before. The 1900 detectors veto and 0230's `combined_no` stay as later guards.
- Support: yes `max(c, 1 - c)`, no `min(c, 1 - c)`, uncertain 0.5, unusable 0.
- `needs_confirmation`: the report joins no site; the owner answers `POST /reports/{id}/confirm` within 24 h. Sure: it merges as an unverified backer photo, never auto-verified, `confirmation.answer: sure` as evidence. Not sure: withdrawn. No answer: `not_confirmed`. Scan frames are never asked: rejected.

Consequences for other lanes: contracts v1.16 (additive). Re-test (docs/ml/eval.md): clean photos accepted 59 of 119 → 7; genuine waste rejected stays 3 of 65, accepted as the outcome (two were rejected before too: a blurry photo and a food tray); no test photo reached `needs_confirmation`. The prod indoor-cupboard (YOLO 0, head 0.77) and blurred-selfie (YOLO 0, head 0.1994) cases stay rejected.

Rejected alternatives: keeping one report_type answer (cannot say "a bin, but clean"); auto-rejecting uncertain answers (loses real waste); the embedding head or Rekognition as a trained detector (lifts the prod cupboard and clean streets).
