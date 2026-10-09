---
status: proposed
superseded_by:
area: data
by: hem
date: 2026-10-10T03:03+05:30
---
# ML dataset: fixed hash splits, four detector classes, private `datasets/` prefix

Context: decision 20261010-0200 fixes the data sources and a 30% field holdout. DS1 (issue #26) needs the exact split rule, the detector classes and the S3 layout.

Decision:
- Splits are hash based, `sha256("<seed>:<id>")`, with seed 26 recorded in `data/datasets/manifest_summary.json`. Public sources split 80/10/10 train/val/test.
- Field-audit photos (`field`) split 30% `holdout`, 10% `val` and the rest `train`. Adding photos never moves earlier ones, and a new seed needs `--force`. `yolo-export` and `ManifestFile.trainable()` never read `holdout`.
- The detector classes are `waste_pile`, `bag`, `bin` and `burning`.
- Dataset files live in the private originals bucket, never in git:
  - public images under `datasets/<dataset>/`;
  - field copies at `datasets/field/{report_id}.jpg`, re-encoded from the blurred `media/reports/` copies, never originals;
  - `datasets/field/records.jsonl` and `datasets/manifest.jsonl`.

Consequences for other lanes: A2 trains on `train` and `val` only and reports on the field `holdout`. The S3 rows and the env vars are in `contracts/README.md`.

Rejected alternatives: re-drawing a random split on each run (it moves photos between splits as the set grows); keeping images in git.
