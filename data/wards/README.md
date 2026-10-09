# Ward records

Written by `data/ward_crawler`:

```
cd data/ward_crawler
uv run python -m ward_crawler.handlers.cli --city jodhpur --profile junksnap
uv run python -m ward_crawler.handlers.cli --city jaipur --profile junksnap
```

Every record matches `contracts/schemas/ward_record.schema.json` and stays `unreviewed` until a person checks it against the source.

| File | Wards | Sources (fetched 10 Oct 2026) | Licence |
|---|---|---|---|
| `jodhpur.json` | 2020 ward formation of Nagar Nigam Jodhpur Uttar and Dakshin (80 + 80), merged into one corporation in 2025 | Rajasthan Gazette ward-formation orders, January 2020, on lsg.urban.rajasthan.gov.in | Government of Rajasthan publication |
| `jaipur.json` | 2025 ward formation of Nagar Nigam Jaipur (150 wards): zone and assembly constituency name | jaipurmc.org ward list | Government of Rajasthan publication |

Each file also has `map_layers`: city-wide OpenStreetMap disposal points, schools, hospitals, water bodies and drains with coordinates, for checks such as "dump within 100 m of a drain". Map data (c) OpenStreetMap contributors, ODbL 1.0.

- Each fact carries `source_url`, `fetched_at` and `page_sha256` of the page it was read from.
- `sources` lists every page tried and its status. `not_used` in `data/ward_crawler/sources/<city>.json` says why some official pages were left out.
- No personal names, personal phone numbers or party fields.
