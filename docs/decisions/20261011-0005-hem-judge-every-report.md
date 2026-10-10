---
status: accepted
superseded_by:
area: agent
by: hem
date: 2026-10-11T00:05+05:30
---
# The vision judge runs on every report, scan frame and cleanup; untrained types are the judge's call

Context: on prod a night photo of a flyover site (`open_construction`/`dusty_site`) was rejected without the judge. Rekognition 0.31, YOLO 0 (its only class for the type is a teacher's "pile of garbage"), embeddings neutral; meta-v2 claimed rows for the type (its file has no `report_types`, and the old default listed it) and its Rekognition-only fallback gave 0.13. The human asked to make the LLM a standard pipeline stage.

Decision:
- `StackedVerifier` asks the judge on every case (reports, scan frames, cleanups), not only when unsure or split. Its answer is one signal the combiner weighs with the detectors (meta-v2's judged model, or the fixed weights).
- A signal not trained on the claimed type is neutral and counts as absent, never as a no. YOLO has no class for `open_construction` or `contaminated_water`; the embedding head sees only `waste_dump` and `no_bin`. Burning is a hazard, not a report type.
- The meta-learner decides only types it has rows for and all its signals can see; meta-v2 (no `report_types` in its file) covers `waste_dump` and `no_bin`. Otherwise the judge decides on the fixed weights, with the reason logged.
- Judge outage: the detectors decide, but a report is never auto-verified (capped at community_check). An untrained type with no judge answer goes to community_check (probability 0.5), unless the detectors veto of 20261010-1900 fires (every non-neutral detector, here Rekognition, under 0.2). Cleanups without the judge stay rejected.
- The #105 vetoes are unchanged (decision 20261010-1900).
- Judge order: Nova Lite, then Nova Pro, then OpenAI; Bedrock refuses Claude here, so Claude is reachable only through `LLM_TASKS`. Cost: about $0.17 per 1,000 photos ($0.00017 a report), median 1.5 s, p90 2.0 s; Nova Pro $2.24 per 1,000 if it answers instead (docs/ml/eval.md). The eval replay (judge on 27% of test photos) has not been re-run with the judge always on.

Consequences for other lanes: no schema change. Every report waits about 1.5 s more and costs one Bedrock call; the worker's 60 s verify timeout already covers it. Fewer reports are auto-verified while Bedrock is down. Replaces the report rule of the proposed decisions 20261010-0137 and 20261010-0219.

Rejected alternatives: keeping the judge for unsure or split cases only (the blind detectors' "no" rejected a real site with no judge); hard-coding a list of judge-only types (coverage comes from meta.json and the signals' neutral flags).
