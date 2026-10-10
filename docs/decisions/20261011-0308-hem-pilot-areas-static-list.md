---
status: proposed
superseded_by:
area: frontend
by: hem
date: 2026-10-11T03:08+05:30
---
# The app lists Jodhpur's areas from a static list and merges in area-list counts; map areas get neighbour tints

Context: live, the Areas tab showed only the 3 seats, 1 Lok Sabha seat and the district that already had a site. `GET /areas/{kind}?within=` returns `scores` rows, and the worker writes a row only when a site lands in an area. Decision 20261010-1422 (proposed) rejected a static district-to-seat table for filtering, because the geocoder decides the district.

Decision:
- `frontend/src/domain/PilotAreas.ts` lists the pilot city's areas: Jodhpur district's 8 assembly seats since December 2024 (`s20-ac-124` to `-131`), their 2 Lok Sabha seats (Jodhpur `s20-pc-16`, Pali `s20-pc-15`), the district `rajasthan-jodhpur` and the local body `jodhpur-mc`. A test checks the ids and names against `data/boundaries/` and `data/representatives/`.
- The list only names areas. Counts and scores come only from the api: rows from the area list route are merged in. With no row, the area shows "No reports yet" and zero counts. Area pages and the map card read `GET /areas/{kind}/{id}/scores`, where 404 means no reports.
- Each map area gets one of 8 muted tints (`--area-tint-1..8`) from a graph colouring of shared vertices, so no two neighbours match. A shown score's colour overrides the tint.
- No contract change. The server could seed zero-count rows for every seat instead, but that needs a seat-to-district source the server lacks (see 20261010-1422) and writes rows nobody reported.

Consequences for other lanes: none required. A new pilot city means a new list. If a site in one of these seats is geocoded to another district, its counts appear only when that district is listed too (the tab also lists the map's own districts).

Rejected alternatives: a server-side seed of every seat (needs a district source and a contract note); the tint palette baked into `areas.geojson` (it would have to be regenerated whenever the boundaries change).
