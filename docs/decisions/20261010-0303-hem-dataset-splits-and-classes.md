---
status: proposed
superseded_by:
area: data
by: hem
date: 2026-10-10T03:03+05:30
---
# ML dataset: fixed hash splits, four detector classes, private `datasets/` prefix

Context: A2 needs an evaluation set of real field photos that training never sees. It also needs one set of detector classes and somewhere to keep dataset images out of git (issue #26).

Decision:
- Splits are hash based, `sha256("<seed>:<id>")`, with seed 26 recorded in `data/datasets/manifest_summary.json`. Public sources split 80/10/10 train/val/test.
- Field-audit photos (`field`) split 30% `holdout`, 10% `val` and the rest `train`. Adding photos never moves earlier ones, and a new seed needs `--force`. `yolo-export` and `ManifestFile.trainable()` never read `holdout`.
- The detector classes are `waste_pile`, `bag`, `bin` and `burning`.
- Dataset images, records and the full manifest live under `datasets/<source>/` in the private originals bucket, never in git. Field photos there are re-encoded blurred copies, never originals.

Consequences for other lanes: A2 trains on `train` and `val` only and reports on the field `holdout`. The contracts PR (#39) adds the `datasets/` prefix and `JUNKSNAP_DATA_CACHE`/`JUNKSNAP_REPO`.

Rejected alternatives: re-drawing a random split on each run (it moves photos between splits as the set grows); keeping images in git.
