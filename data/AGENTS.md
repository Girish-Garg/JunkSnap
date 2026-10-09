# data: boundaries, representatives and labels

Small reference data that the backend and the map use. Small files only: anything large lives in S3.

## Layout (docs/working.md section 1)

- `boundaries/`: assembly (MLA) and Lok Sabha (MP) seat boundaries across India from the 2008 delimitation, and ward boundaries only where open ward maps exist. Simplified GeoJSON, small enough for git.
- `representatives/`: all MPs and, first, Rajasthan MLAs. Each row has the seat, the representative's name, an as-of date and a source. No party field.
- `labels/`: the Label Studio setup and CSV exports for `report_type`, `context`, `burning` and `brands`, plus the fixed train and held-out test split (about 30% test).

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
- Store a reporter's name, phone number or exact home location in any file here.
- Add a party field to any table.
- Write to `demo` data. The human promotes data to `demo` from a clean `main`.
