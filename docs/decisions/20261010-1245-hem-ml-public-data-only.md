---
status: accepted
superseded_by:
area: data
by: hem
date: 2026-10-10T12:45+05:30
---
# Models are trained and evaluated on openly licensed public data only; no field training

Context: Hemang ruled on 10 Oct that field-audit photos are not used for training, labelling or a holdout. This replaces the field parts of decisions 20261010-0200 and 20261010-0303.

Decision:
- Training data is openly licensed public datasets only, each licence checked and recorded in `data/datasets/SOURCES.md`; images live in S3 under `datasets/`, never in git (kept from 0200).
- Field photos are never imported into datasets, labelled for training or held out. `import-field`, the field source, the field split and its group keys, and the Label Studio config are removed. S3 `datasets/field/` is no longer referenced (nothing deleted).
- Splits stay hash based with seed 26, 80/10/10 train/val/test for every source; the detector classes are `waste_pile`, `bag`, `bin`, `burning`, `waste_item` (kept from 0303, plus A2's `waste_item`).
- Results tables use the public `test` split and say so (decision 20261010-1030). Teacher-made boxes are named as such.

Consequences for other lanes: `docs/ml/eval.md` is the model evidence; real-world accuracy in Jodhpur is not measured by any table.

Rejected alternatives: the 30% field holdout (0200); training on field photos.
