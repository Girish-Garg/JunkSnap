---
status: superseded
superseded_by: 20261011-0305-hem-structured-judge.md
area: agent
by: hem
date: 2026-10-11T02:30+05:30
---
# A judge "no" is never a "yes", a strong judge "no" vetoes whatever type it named, and an unusable photo asks for a retake

Context: on prod a blurred close-up of a person, sent as `waste_dump`/`roadside`, became a 1-of-10 site (`rpt_01m4krvscbptqdsaq2q54v9g32`). Rekognition 0, YOLO 0, embeddings 0.1994; Nova Lite said `not_waste` ("too blurry to identify any waste") with confidence 0.1, which `1 - confidence` turned into claim support 0.9. Neither 1900 veto fired (the judge's "support" was 0.9), meta-v2 gave 0.0198, and disagreement (0.9 against 0) lifted it to community_check.

Decision (report photos only; cleanups keep their rules, and every veto rejects whatever the combiner says):
- Claim support from a judge "no" (`not_waste`, or a type the claim denies) is `min(confidence, 1 - confidence)`, at most 0.5, so either reading of "confidence" stays a no. The claimed type gives its confidence; another waste type 0.5.
- `judge_veto:unclear`: the judge answers `photo_unclear: true` (new optional field of the judge answer and prompt: too blurry, dark or close to tell whether any waste is there). Its support is 0. The app says "Retake: we couldn't see waste clearly".
- `judge_veto:not_waste` / `judge_veto:low_support`: the judge's claim support is under 0.2, whatever type it named (not_waste keeps its reason; replaces 1900's not_waste-only rule).
- `detectors_veto:no_waste`: unchanged from 1900.
- `judge_veto:combined_no`: disagreement flagged, the combined probability and the judge's support both under `community_check_min` (0.5). Disagreement never lifts a judge "no" into community_check; a judge "yes" against blind detectors still gets community_check (decision 0005).
- Evidence as in 1900: `combiner.version` gets `+<reason> by <provider>/<model>@<version>`.
- A guard for cleanups: `photo_unclear` gives support 0, so an unusable photo never shows a site clean.

Consequences for other lanes: no schema change; `photo_unclear` stays inside ml and is not in `verification_result.judge`. The app reads `verification.combiner.version` for the unclear reason, then `judge.report_type` as before. The eval replay (docs/ml/eval.md) predates the new support mapping and has not been re-run.

Rejected alternatives: parsing the rationale for "blurry" (fragile, any language); an `unclear` report type (would enter the contract's judge enum); dropping the disagreement rule (a judge "yes" against blind detectors must still reach people).
