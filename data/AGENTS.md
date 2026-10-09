# data: boundaries, representatives and labels

Small reference data that the backend and the map use. Small files only: anything large lives in S3.

## Layout (docs/working.md section 1)

- `boundaries/`: assembly (MLA) and Lok Sabha (MP) seat boundaries across India from the 2008 delimitation, and ward boundaries only where open ward maps exist. Simplified GeoJSON, small enough for git.
- `representatives/`: all MPs and, first, Rajasthan MLAs. Each row stores the seat, the office, `as_of` and `source` only: no names (decision 20261010-0137, offices and seats only) and no party field.
- `labels/`: the Label Studio setup and CSV exports for `report_type`, `context`, `burning`, materials, hazards and `brands`, plus the fixed train and held-out test split (about 30% of field photos held out, never trained on; decision 20261010-0200).
- `wards/`: `<city>.json`, written by `ward_crawler/`: `records` (each a `ward_record`, contract in `contracts/schemas/`) from official pages, and `map_layers` from OpenStreetMap (disposal, school, hospital, water, drain), reviewed before use. The worker finds nearby places in the layers.
- `datasets/`: manifests and licences of the openly licensed public waste datasets only; the images live in S3 under `datasets/`.

## Conventions

- Record the source URL, licence and as-of date for every dataset in a README next to it. Check the licence before committing boundaries.
- Helper scripts are single-file Python 3.12 scripts with a PEP 723 header, run with `uv run <script>`. They follow the same size limits as all code (`uv run scripts/check_limits.py`).
- A script that writes data the backend reads validates it against `contracts/schemas/` before writing or uploading.
- The label split is fixed with a recorded seed. Never move a photo between train and test once evaluation has started.
- Brand-to-parent-company mappings carry a source for each row.
- Area scores and evaluation tables only use real, measured data. Never invent rows or history.

## Large files

- Photos, rasters, Parquet, embeddings and models over 5 MB go to S3, never to git. The S3 layout is in `contracts/README.md`.
- Field-audit photos are personal data: they stay in the private bucket. Labels refer to them by report id or S3 key, never by a person.

## Never

- Commit photos, `.env` files or keys.
- Store any person's name (reporter or office holder), phone number or exact home location in any file here.
- Add a party field to any table.
- Write to `demo` data. The human promotes data to `demo` from a clean `main`.
