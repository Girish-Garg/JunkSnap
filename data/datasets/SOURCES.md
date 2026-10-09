# ML datasets: sources, licences and splits

Images never go in git. `uv run training fetch` (in `backend/ml/training/`) downloads each source into the local cache named by `JUNKSNAP_DATA_CACHE` (outside the repo), re-encodes every image to an upright JPEG of at most 1280 px, and uploads it to the private bucket (`ORIGINALS_BUCKET`, or the `OriginalsBucketName` output of the `junksnap-<JUNKSNAP_STAGE>` stack; SSE-KMS) under `datasets/<source>/images/`. Each source's labels and normalised boxes go to `datasets/<source>/records.jsonl` next to them. If the bucket cannot be found every command stops with an error; only an explicit `--no-upload` keeps files local. A machine without the cache rebuilds the manifest from those S3 records, and `yolo-export` downloads the images it lacks. This folder holds only the class map, the manifest summary and this file. Sources fetched on 10 Oct 2026.

## Used

| Source id | Dataset | Licence | Images we keep | Classes | What we use it for |
|---|---|---|---|---|---|
| `qr4change` | Urban Civic Issues Image Dataset: Potholes and Garbage (QR4Change), Vishwakarma Institute of Information Technology, Pune. Mendeley Data, https://doi.org/10.17632/zndzygc3p3.2 | CC BY 4.0 | the garbage part only: 708 dump and 1,259 non-garbage photos (5 videos and the pothole part skipped) | `garbage`, `non_garbage` | India street scenes for the report-type classifier: `waste_dump` against `not_waste` |
| `taco` | TACO: Trash Annotations in Context. https://zenodo.org/records/3587843, annotations from https://github.com/pedropro/TACO | CC BY 4.0 | 1,034 of 1,500, as the 640 px copies the TACO download script uses | 60 litter classes in 28 groups, with boxes | materials, hazards (battery: e-waste; aerosol: chemicals), `bag` boxes for the detector |
| `garbage_od` | GARBAGE CLASSIFICATION 3, Roboflow Universe (https://universe.roboflow.com/material-identification/garbage-classification-3/dataset/2), mirrored at https://huggingface.co/datasets/keremberke/garbage-object-detection | CC BY 4.0 | 10,464 at 416 px | `biodegradable`, `cardboard`, `glass`, `metal`, `paper`, `plastic`, with boxes | material boxes and crops for the material classifier. Mostly product-style photos on plain backgrounds, so no report type |
| `dfire` | D-Fire fire and smoke dataset, https://github.com/gaiasd/DFireDataset, files read from the public mirror https://huggingface.co/datasets/badsaarow/d-fire | CC0 1.0 | a fixed, evenly spaced 1,500 of the mirror's 3,013 train image/label pairs (the other train files have no matching partner) | `smoke`, `fire` (YOLO boxes); unlabelled images are `none` | the `burning` hazard and the detector's `burning` class |
| `field` | JunkSnap field audit, Jodhpur and other cities | private, never redistributed | added by `import-field` from a Label Studio export; only the pipeline's blurred copies (`media/reports/…`), never originals | see `data/labels/label_studio.xml` | the only source of real JunkSnap photos; about 30% held out for evaluation |

Excluded inside TACO: 466 images from OpenLitterMap batches carry "ODbL (c) OpenLitterMap & Contributors" per image (share-alike database licence, no 640 px copy), so `fetch` skips them.

CC BY credit: the four public sources above are credited here and must be credited again in the README's data sources section. QR4Change states that some of its images came from open repositories and government portals; the licence note says content identified as third party may need further permission. None is identified, so we use it under the dataset's CC BY 4.0 licence.

## Considered, not fetched

| Dataset | Licence | Why not now |
|---|---|---|
| UAVVaste, https://zenodo.org/records/8214061 (772 drone images, 3,718 rubbish boxes) | CC BY 4.0 | allowed; drone view, 3 GB. Candidate for `waste_pile` boxes later |
| Roboflow Universe heap sets: `ourouba/garbage_detection` (boxes around whole heaps), `garbage-ovvwj/garbage-detection-all` (`scattered_household_garbage`, `accumulation_household_garbage`, `construction_garbage`) | CC BY 4.0 | allowed and the best open source of `waste_pile` and construction-debris boxes, but the download needs a Roboflow account and API key (a human step) |
| TrashNet, https://huggingface.co/datasets/garythung/trashnet (2,527 single objects) | MIT | allowed; adds little over `garbage_od` |
| GIZ E-Waste Database, https://huggingface.co/datasets/GIZ/E-Waste-Database | CC BY 4.0 | allowed; candidate for the `e_waste` material |
| TrashBox, NITK (17,785 images incl. medical and e-waste) | no licence stated; IEEE DataPort subscribers only | not allowed until a licence is published |
| GINI / SpotGarbage, IIT Ropar | web-search images, no licence found | not allowed |
| Garbage Image Dataset, IEEE DataPort 10.21227/c0q8-nr65 | licence field empty | not allowed |
| UniDataPro/outdoor-garbage, ud-smart-city/garbage-classification | CC BY-NC-ND 4.0 | not allowed (non-commercial, no derivatives) |
| UniqueData/outdoor_garbage | CC BY-ND 4.0 | not allowed (no derivatives) |
| Kaggle garbage sets | per dataset | need a Kaggle login; skipped |

Tools: Ultralytics YOLO is AGPL-3.0. Training with it is fine in a public repo, but code that imports it, and a service that serves a model through it over a network, falls under the AGPL. This package does not depend on it: `yolo-export` writes the plain YOLO format, so A2 can choose the trainer.

Gaps no open dataset covers: bins, medical waste, dead animals, chemicals, construction debris and Indian dump piles with boxes. The field audit has to label these.

## Class map and manifest

- `class_map.json` maps every source class to a JunkSnap report type (`waste_dump`, `open_construction`, `contaminated_water`, `no_bin`, `not_waste`), materials (`plastic`, `organic`, `construction_debris`, `paper`, `glass`, `metal`, `textile`, `e_waste`, `medical`), hazards (`burning`, `medical_waste`, `e_waste`, `dead_animal`, `chemicals`) and a detector class (`waste_pile`, `bag`, `bin`, `burning`). When one image's labels give several report types, the order of `report_types` wins.
- `manifest.jsonl`: one line per image with `id`, `source`, `licence`, `s3_key`, `local_path` (inside the cache), `report_type`, `context`, `materials`, `hazards`, `size_class`, `brands`, `has_boxes` and `split`. Past 5 MB it lives at `datasets/manifest.jsonl` in the private bucket instead of here; with the four public sources (14,965 rows) it is there now.
- `manifest_summary.json`: counts per source, licence, split, source and split, report type, material and hazard.

## Splits

Splits are hash based: `sha256("<seed>:<id>")` gives each image a fixed point in 0..1, so the same seed always gives the same split and adding images never moves earlier ones. Seed 26, recorded in `manifest_summary.json`; `build-manifest`, `split` and `import-field` refuse another seed unless given `--force`.

| Source | test | val | train | holdout |
|---|---|---|---|---|
| public sources | first 10% | next 10% | rest | never |
| `field` | never | next 10% | rest | first 30% |

As a safeguard, Roboflow-style copies of one photo (`<name>_jpg.rf.<hash>`) hash on the photo's name, so augmentation copies would always share a split; the current `garbage_od` export has none. The field `holdout` split is the evaluation set for A2: `yolo-export` never writes it, and training code reads rows through `ManifestFile.trainable()`, which returns only `train` and `val`.

## Commands

```sh
cd backend/ml/training
export JUNKSNAP_DATA_CACHE=/path/outside/repo AWS_PROFILE=junksnap
uv run training fetch taco qr4change garbage_od
uv run training fetch dfire --limit 1500
uv run training build-manifest                # builds rows and assigns splits with the recorded seed
uv run training split                         # re-assigns splits; --seed N --force to change the seed
uv run training labelstudio-config            # writes data/labels/label_studio.xml
uv run training import-field export.json      # --keep-missing or --replace for a partial export
uv run training yolo-export --out /path/outside/repo/yolo
```

Field photos are labelled and stored only as the blurred copies the app pipeline produces, never originals. Point the Label Studio tasks at either:
- `s3://junksnap-<stage>-public-<account_id>/media/reports/<report_id>.jpg`, by connecting Label Studio's S3 source storage to the public bucket with prefix `media/reports/`; or
- the CloudFront URL `<PUBLIC_BASE_URL>/media/reports/<report_id>.jpg`.

`import-field` refuses every other reference: originals (`reports/…` in the private bucket), local files and uploads.

For each blurred copy, `import-field`:
1. re-encodes it, which also drops any EXIF;
2. uploads it to `datasets/field/images/` in the private bucket, with its labels in `datasets/field/records.jsonl`;
3. rebuilds the manifest.

A missing or unreadable copy stops the import. The export is merged with the recorded field photos by image id. An export that lacks photos already recorded is refused: `--keep-missing` keeps them, and `--replace` drops them.

One machine (the lead's) writes the shared manifest. A local cache copy is trusted over S3, so a stale cache elsewhere could overwrite newer field rows.

Labels describe waste only and never name a person.
