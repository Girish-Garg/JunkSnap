---
status: proposed
superseded_by:
area: data
by: hem
date: 2026-10-10T03:03+05:30
---
# ML dataset: fixed hash splits, contract size classes, detector classes, private `datasets/` prefix

Context: decision 20261010-0200 fixes the data sources and a 30% field holdout. DS1 (issue #26) needs the exact split rule, the label classes and the S3 layout.

Decision:
- Splits are hash based, `sha256("<seed>:<group>")`, with seed 26 recorded in `data/datasets/manifest_summary.json`. A new seed needs `--force`.
  - Public sources split 80/10/10 train/val/test.
  - Field photos split 30% `holdout`, 10% `val`, the rest `train`. The group is the scan (`scan_id`), else the site (`site_id`), else the photo, so one scan or site never straddles holdout and train.
  - `yolo-export` and `ManifestFile.trainable()` never read `holdout`.
- Labels use the contract's enums. Size class is `small`, `medium` or `large`, with the `verification_result` wording as labelling hints.
- Detector classes: `waste_pile`, `bag`, `bin`, `burning`. The YOLO export in the training work adds `waste_item`.
- Dataset files live in the private originals bucket, never in git: public images under `datasets/<dataset>/`; blurred field copies at `datasets/field/{report_id}.jpg`, from `media/reports/` only; `datasets/field/records.jsonl`; and `datasets/manifest.jsonl`, never shrunk without `--force`.

Consequences for other lanes: A2 trains on `train` and `val` only and reports on the field `holdout`. The S3 rows and the env vars are in `contracts/README.md`.

Rejected alternatives: re-drawing a random split on each run (it moves photos between splits as the set grows); keeping images in git.
