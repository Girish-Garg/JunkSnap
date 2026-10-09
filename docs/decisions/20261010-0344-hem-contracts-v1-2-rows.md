---
status: proposed
superseded_by:
area: contracts
by: hem
date: 2026-10-10T03:44+05:30
---
# Contracts v1.2: row fields, GSIs project ALL, ASSETS_DIR

Context: the reviews of the intake (#11) and sites (#19) branches found fields and settings that the code relies on but `contracts/README.md` did not list (issue 53).

Decision: no schema shape changes; only the `letter_draft` `source_sha256` description is reworded, to match decision 20261010-0330. The `reports` row lists `completed_steps` (the worker steps already done, so a retried message resumes) and `location` (the full location the worker wrote); the `sites` row lists `version` (the optimistic lock), `report_ids`, `merged_reports`, `reporter_devices`, `reporter_users`, `me_too_count`, `embedding_key` and `pending_cleanup_id`, with the names the branches already use. Every GSI (`by-site`, `by-device`, `by-user`, `by-geohash`) projects ALL attributes, as `infra/aws/stage.yaml` already does. `ASSETS_DIR` (api, worker, scores) names the folder with the repo's `data/` files, `/app/data` in the image. `OPENROUTER_SECRET_ID` is marked planned (decision 0133), since neither `api` nor `ml` has an OpenRouter provider yet. In `docs/working.md`, `domain` and `ports` may import generated contract types with `import type`, never the generated validators.

Consequences for other lanes: server keeps its current names; infra should set `ASSETS_DIR` and copy `data/` into the server image, and may drop the OpenRouter secret from the pod roles until a provider exists.

Rejected alternatives: mirroring every contract type by hand in `domain`, which duplicates the schemas and drifts.
