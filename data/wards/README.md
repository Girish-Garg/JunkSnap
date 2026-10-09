# Ward records

Written by `data/ward_crawler`:

```
cd data/ward_crawler
uv run python -m ward_crawler.handlers.cli --city jodhpur --profile junksnap
uv run python -m ward_crawler.handlers.cli --city jaipur --profile junksnap
```

Every record matches `contracts/schemas/ward_record.schema.json` and stays `unreviewed` until a person checks it against the source.

| File | Wards | Facts | Sources (fetched 10 Oct 2026) | Licence |
|---|---|---|---|---|
| `jodhpur.json` | 2020 ward formation of Nagar Nigam Jodhpur Uttar and Dakshin (80 + 80); the two merged into one corporation in 2025 | population (census year not printed) | Rajasthan Gazette ward-formation orders, January 2020, on lsg.urban.rajasthan.gov.in | Government of Rajasthan publication |
| `jaipur.json` | 2025 ward formation of Nagar Nigam Jaipur (150 wards) | zone only (no assembly seat) | jaipurmc.org ward list | Government of Rajasthan publication |

How facts are read:

- A Bedrock model reads each page. Facts are then kept only if the page shows them. The ward's snippet must be on the page word for word, and the population and zone must sit in the ward's own row.
- A hand-checked row pattern for each source then fills wards the model missed. It corrects any value it disagrees with; `extracted_by` is `junksnap / row-pattern`.
- Garbled PDF zone names are used only through the hand-checked `aliases` in `data/ward_crawler/sources/jaipur.json`.
- Each fact carries `source_url`, `fetched_at` and `page_sha256` of the page it was read from.
- `sources` lists every page tried, its status and which wards were filled, corrected or dropped. `not_used` in the sources file says why some official pages were left out.

`map_layers` holds city-wide OpenStreetMap layers with coordinates, for checks such as "dump within 100 m of a drain". Map data (c) OpenStreetMap contributors, ODbL 1.0.

Layers fetched on 10 Oct 2026: Jodhpur has disposal (0 points mapped in OSM, an empty layer), school 27, hospital 96 and water 41. Its **drain layer is missing, not empty**: every Overpass mirror was busy, and an earlier run that day fetched 17 drain, ditch and stream ways. Jaipur has disposal 3, school 81, hospital 435, water 62 and drain 65. A layer absent from `map_layers` was not fetched; see `sources` for the error.

No personal names, personal phone numbers or party fields.
