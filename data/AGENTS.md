# Lane `data`: geo and data scripts

Holder: see `.claude/roster.json`. The holder adds conventions here as the lane learns them. Keep it under about 60 lines.

- Python with `uv`. Each script validates its output against `contracts/schemas/` before uploading anything.
- Sentinel-2: Earth Search STAC `https://earth-search.aws.element84.com/v1`, collection `sentinel-2-c1-l2a`; use the legacy `sentinel-2-l2a` collection for 2022. Jodhpur sits in the overlap of tiles 43RBK and 43RCK, so de-duplicate by date. Pre-render chips to S3; no live raster reads in Lambda.
- FIRMS history: keyless yearly CSVs (`https://firms.modaps.eosdis.nasa.gov/data/country/viirs-snpp/<year>/viirs-snpp_<year>_India.csv`), clipped to the district and written as Parquet partitioned by year and month. Recent data comes from the area API (needs `FIRMS_MAP_KEY`).
- Earth Index embeddings: pick one model generation (SoftCon 2024 or SSL4EO) and never compare vectors across the two.
- S3: write under `s3://saboot-data-<account-id>/<stage>/`. Only the data holder's promote script writes `demo/`.
- Large files (rasters, Parquet, embeddings) never go in git.
- Every Python lane needs `ruff` and `pytest` as dev dependencies and at least one test, or CI fails.
