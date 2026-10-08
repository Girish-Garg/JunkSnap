# Lane `data`: FIRMS Lambda

This folder belongs to the `data` lane. Holder: see `.claude/roster.json`.

- A small Lambda that calls the FIRMS area API (`/api/area/csv/<MAP_KEY>/<SOURCE>/<w,s,e,n>/<1-5 days>`) for recent days. History comes from the Parquet data lake, not from this Lambda.
- `FIRMS_MAP_KEY` comes from the environment, never from code.
- Match fires to a site within at least 375 m. Label likely static or industrial sources using the `type` field.
- Response shape is `contracts/schemas/firms.schema.json`. Wording: "thermal anomalies recorded near this location".
- Every Python lane needs `ruff` and `pytest` as dev dependencies and at least one test, or CI fails.
