---
status: proposed
superseded_by:
area: contracts
by: hem
date: 2026-10-10T14:22+05:30
---
# Area list: GET /areas/{kind}?within= queries the scores partition and filters on a table-only within list

Context: issue 76 needs a ranked list of a city's areas. A `scores` row holds only `area {kind, id, name}`, and the boundary files carry no district, so nothing on the row says which district or city an area lies in.

Decision (contracts v1.3):
- `scores` rows gain a table-only `within` list: the sorted district ids and local body ids of the area's sites (`site.location.district.id`, `site.location.local_body.id`). The scores CronJob writes it from every site in the area on each run; the worker seeder writes the founding site's two ids. It is not part of `ward_scores`; readers strip it with the keys.
- `GET /areas/{kind}?within=<district-or-local-body-id>&limit=<n>` (public) does one Query on partition `area_kind` with `contains(within, :within)`, reads every page, ranks, then applies `limit` (default 50, capped at 200).
- Ranking: rows with a shown score first, lowest mean of the shown scores first (a score below `min_verified_reports` never counts), then the rest; ties by more verified reports, then area id. Rows go out as stored, so withheld scores stay withheld.
- New wrapper schema `area_list` `{kind, within, total, limit, areas}`; each item is a `ward_scores` body (schemas never cross-reference, so items are checked against `ward_scores` separately).

Consequences for other lanes: frontend reads `area_list` for the city ranking. Rows seeded before this change have no `within` and stay out of the list until the next CronJob run (every 15 minutes). An api pod older than this change fails to read a row that has `within`, so deploy api, worker and scores together (one image).

Rejected alternatives: a static district-to-seat table (no source in `data/`, and Phalodi split from Jodhpur in 2023, so it would disagree with the geocoder's district); a Scan of the whole table; storing the district inside `ward_scores` (a shape change for every reader).
