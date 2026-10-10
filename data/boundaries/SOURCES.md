# Boundary sources

## Seats: rajasthan_assembly.geojson and india_loksabha.geojson

Built 2026-10-10. Use `eci-2008-delimitation/v1` as `location_lookup.boundaries_version` for these files. GeoJSON FeatureCollections in WGS 84 (`[lon, lat]`), 5 decimal places.

| File | Holds | Size | Licence |
|---|---|---|---|
| `rajasthan_assembly.geojson` | 200 Rajasthan assembly seats (2008 delimitation). Properties: `id` (`s20-ac-<n>`), `ac_no`, `name`, `category` (`GEN`, `SC`, `ST`), `pc_id` (`s20-pc-<n>`) | 624 KB | [CC BY 2.5 India](https://creativecommons.org/licenses/by/2.5/in/): credit DataMeet and the Election Commission of India |
| `india_loksabha.geojson` | 543 Lok Sabha seats. Properties: `id` (`<eci-state>-pc-<n>`), `pc_no`, `name`, `category`, `eci_state`, `state`, `status` (`current` or `outdated`) | 1.57 MB | Mixed. The 518 seats outside Rajasthan: [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/), credit DataMeet. The 25 Rajasthan seats (`s20-pc-*`) are unions of the assembly seats, so they follow the assembly file's [CC BY 2.5 India](https://creativecommons.org/licenses/by/2.5/in/): credit DataMeet and the Election Commission of India |

### Sources

- DataMeet assembly seats: <https://github.com/datameet/maps/tree/master/assembly-constituencies> (`India_AC.shp`, scraped from ECI's polling station site), [CC BY 2.5 India](https://creativecommons.org/licenses/by/2.5/in/).
- DataMeet Lok Sabha seats: <https://github.com/datameet/maps/tree/master/parliamentary-constituencies> (`india_pc_2019_simplified.geojson`, corrected attributes), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/).
- ECI polling station locations, 2017 (source psleci.nic.in): <https://github.com/ramSeraph/indian_facilities/releases/tag/elections> (`ECI_PollingStations_2017`), [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) with a request to credit DataMeet and the government source.
- Seat numbers, names and the assembly-to-Lok Sabha mapping were checked against the Delimitation Order 2008 list as published on Wikipedia (List of constituencies of the Rajasthan Legislative Assembly) and the polling station data; ECI state codes against the 2024 ECI results site (`S20` Rajasthan, `U05` Delhi, and so on).

### How `rajasthan_assembly.geojson` was built

DataMeet's urban seats are misplaced by up to about 6 km: every polling station of Malviya Nagar, Kishanpole and Sanganer falls outside its own DataMeet polygon, and the Jodhpur city seats are wrong the same way. The LGD (BharatMaps) copy has the same geometry. So the seats were rebuilt from where ECI's polling stations are:

1. Take Rajasthan's 44,300 polling stations; drop duplicates, stations outside Rajasthan, stations more than 0.12° from their seat's DataMeet polygon (bad coordinates), and stations with fewer than 3 of their 8 nearest neighbours in the same seat.
2. Draw a Voronoi cell around each station, merge the cells per seat, clip to the Rajasthan outline of the Lok Sabha layer, and simplify the shared edges to about 40 m.
3. Twelve seats have too few usable stations and keep their DataMeet shape: 11 Bhadra, 78 Bari, 118 Pali, 133 Pokaran, 135 Barmer, 140 Chohtan, 144 Sanchore, 153 Udaipur, 155 Vallabhnagar, 161 Chorasi, 171 Bari Sadri, 197 Dag. Udaipur and Pali are city seats, so their edges may be off by a few km.
4. Rajasthan's 25 Lok Sabha seats in `india_loksabha.geojson` are the union of their 8 assembly seats each, so both files agree; the other states are DataMeet's shapes.

Check: 92.7% of all 44,300 stations fall inside their own seat (DataMeet as published: 82.6%); most misses are the bad-coordinate stations dropped in step 1. No overlaps, no gaps, every geometry valid.

Fixes against DataMeet: names of seats 38, 52, 68, 126, 147 and 195 follow the official list; 194 Kishanganj is ST; seats 65 to 68 belong to Alwar (`s20-pc-8`), not Bharatpur.

### Known limits

- Assam (`s03`) was re-delimited in 2023 and Jammu and Kashmir and Ladakh (`u08`, `u09`) in 2022; their polygons are older and marked `status: outdated`. J&K ids follow the 2024 numbering (`u08-pc-1` to `u08-pc-5`, Ladakh `u09-pc-1`). Jharkhand, Manipur, Arunachal Pradesh and Nagaland were left out of the 2008 delimitation, so their older shapes are current.
- Assembly seats exist only for Rajasthan. Elsewhere the lookup has a Lok Sabha seat but no assembly polygon yet.
- A point within about 100 m of a seat edge can land in the neighbouring seat.

## Wards: jodhpur_wards.geojson and jaipur_wards.geojson (approximate, unreviewed)

**Attribution:** places © OpenStreetMap contributors (ODbL, https://www.openstreetmap.org/copyright); ECI polling stations CC0 as declared by the ramSeraph/indian_facilities copy; ward lists from the Rajasthan Gazette. The wards are not on the web map: `frontend/public/boundaries` ships only the combined seats layer.

**Data files only until reviewed:** these wards are built as unreviewed data files; they are not on the map and not used for location lookups, scores or letters until each ward is `reviewed`, because a wrong ward would send a letter to the wrong councillor.

Built 2026-10-10 by `data/ward_boundaries`. Run it with `uv run python -m ward_boundaries.handlers.cli --city <city> --profile junksnap`. Nobody has published an open map of the 2025 wards, so these polygons are **approximations**. Each one is built from the places that the official ward-formation text lists for the ward. Every ward is `review_status: unreviewed` and carries a `confidence` from 0 to 1. Wards that could not be placed are left out (listed below), never guessed.

Each feature is a GeoJSON Polygon or MultiPolygon in WGS 84, with these properties:
- `id`: `<local-body-id>-w<n>`, the same rule as `ward_record`.
- `ward_no`, `name` (null), `zone` (null).
- `offices`: titles only, no personal names.
- `confidence`, `review_status`, `population`, `localities_listed`, `localities_found`, `area_km2`.
- `source_url`, `page_sha256`, `fetched_at`: the ward-formation text.
- `sources`: every page used.
- `notes`.
- `models`: provider, model and version of every Bedrock call that shaped the ward (transliteration for Jodhpur, place extraction for Jaipur).

### How a ward is built

1. **Read the ward-formation text.**
   - **Jodhpur:** the gazette's ward table (ward number and population) is read from the Scribd copies. The readable locality list per ward comes from a Patrika copy of the same list, which matches the gazette's "क्षेत्र" lists. The gazette text is preferred for ward numbers and population.
   - **Jaipur:** a Bedrock model (Amazon Nova Pro; the account's Claude models are not enabled) reads the official gazette and lists the places each ward is said to include. Boundary roads are excluded.
2. **Spell the localities in Latin script.** A Bedrock model transliterates them (cached in `.cache/`).
3. **Find each locality on a map.** Two sources are searched:
   - named OpenStreetMap places (Overpass API, ODbL);
   - ECI polling stations (2017 locations, CC0 as declared by the ramSeraph/indian_facilities copy), whose names carry the colony or village they serve.

   A locality counts only if all of these hold:
   - Its distinctive words match. Generic words like "Nagar", "Colony", "School" or "Balaji" alone do not count, and only small spelling slips are allowed.
   - All its spots lie within 1.5 km of each other.
   - No other ward claims the same spot.
4. **Draw the polygon.** Each ward's places that lie close together (within 1.75 km of its middle place) become seeds. The polygon is the union of the seeds' Voronoi cells, cut to 700 m around them. The wards therefore never overlap, but they leave gaps where nothing was found.
5. **Score confidence.** It is `0.5 × min(1, localities found / 4) + 0.4 × share of listed localities found + 0.1` when the ward's row was read from the gazette.

### Sources

**Jodhpur Municipal Corporation (`jodhpur-mc`, 100 wards):**
- The order: Rajasthan Gazette Extraordinary, 15 September 2025, Part 6(A), Local Self Government Department, F.10(N.P.)(Gathan)(Chunav)DLB/25/17621.
- No copy is on an official host. The LSG, SEC and old corporation sites were checked on 2026-10-10.
- Secondary copies used:
  - https://www.scribd.com/document/1059031983/ (gazette text);
  - https://www.scribd.com/document/854168221/;
  - the Patrika ward list of 18 September 2025, https://www.patrika.com/jodhpur-news/jodhpur-nagar-nigam-has-100-wards-see-the-full-list-of-which-ward-will-your-house-be-located-in-19956535.

**Jaipur Municipal Corporation (`jaipur-mc`, 150 wards):** the official gazette of 20 September 2025, https://jaipurmc.org/PDF/Others/FinalParisimanGazette2025.pdf.

**Not used as geometry:**
- The 2020 Jodhpur North and South ward maps exist only as images.
- The 2008 delimitation order and the Census 2011 ward tables describe older ward sets.

### Coverage on 2026-10-10

**Jodhpur:** 34 of 100 wards were built. Confidence ranges from 0.00 to 0.43, with a median of 0.26.
- There are no overlaps and no invalid geometries; 3 wards are MultiPolygons. The wards cover 44.1 km².
- Jodhpur has no official ward-to-seat list, so the only cross-check is that ward numbers run in walking order. Most built wards lie within 0.3 to 2.5 km of a ward numbered next to them. Wards 1 and 100 lie 10 and 5 km away, and their confidence is lowered.
- No locality found on the map: 2, 3, 5, 6, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 24, 26, 28, 29, 30, 31, 33, 34, 35, 36, 37, 38, 39, 40, 42, 43, 44, 45, 47, 50, 52, 53, 54, 56, 57, 60, 62, 65, 67, 68, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 82, 83, 84, 88, 89, 91, 94, 95.

**Jaipur:** 12 of 150 wards were built. Confidence ranges from 0.15 to 0.94, with a median of 0.44.
- There are no overlaps and no invalid geometries. The wards cover 23.7 km².
- The corporation's ward list gives each ward's assembly seat by range. Each ward is checked against those seats in `rajasthan_assembly.geojson`: 12 wards were dropped because they lay mostly outside their seat (a wrong place match).
- No locality found on the map: 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 15, 16, 18, 19, 20, 21, 22, 23, 24, 27, 29, 30, 32, 33, 34, 35, 37, 38, 39, 40, 42, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 59, 61, 62, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 125, 126, 129, 131, 132, 133, 134, 135, 136, 137, 138, 139, 142, 143, 144, 145, 146, 147, 148, 149, 150.
- Dropped as a conflict with the ward's official assembly seat: 10, 14, 25, 26, 28, 31, 41, 43, 83, 95, 98, 128.

### Known limits

- These are not surveyed boundaries.
  - A ward's polygon covers the places found for it, not its legal limits.
  - Edges between wards are Voronoi lines, not the roads the gazette names.
  - Areas where nothing was found are gaps.
- A wrong place match moves a ward. Generic and repeated names are filtered out, but check every ward against the gazette text before marking it `reviewed`.
- The Jodhpur text comes from secondary copies of the official order.

## Web copies: frontend/public/boundaries

`uv run scripts/simplify_boundaries.py` writes the one layer the web map draws, `areas`: assembly seats in Rajasthan and Lok Sabha seats everywhere else (`areas.geojson`, `areas_labels.geojson`, `areas_fine.geojson` and an `index.json`; each feature carries its `kind`). Each source layer is first simplified as one coverage, so neighbours keep shared edges, at the smallest tolerance that fits its byte budget; coordinates are rounded to 4 decimals (about 11 m). Where the two layers meet on the Rajasthan border, the outside Lok Sabha seats are cut back from the assembly seats and the slivers between them are given to the bordering outside seat. Only display properties are kept. Marker points are each area's pole of inaccessibility (polylabel) on the original shape, so they always fall inside the area. `areas_fine.geojson` keeps the original Rajasthan assembly edges (5 decimals) for zooms past 12. Ward files are not drawn and not copied. These copies are for drawing only: location lookups use the full files above. Rerun the script whenever a boundary file here changes. Same sources and licences as the files they come from.

## india_outline.geojson

India outline for the inside-India authenticity check (issue #13). One Feature, a MultiPolygon in WGS 84 (lon, lat).

- Source: Natural Earth 1:10m Admin 0 countries, India point of view (`ne_10m_admin_0_countries_ind`), feature `ADM0_A3 = IND`.
- URL: https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries_ind.geojson (repo VERSION `5.2.0-pre`; file last changed in commit `9380cca`, 2022-05-13).
- Licence: public domain (https://www.naturalearthdata.com/about/terms-of-use/). No attribution required.
- As of: downloaded 2026-10-10.
- Processing: shapely `simplify(0.005, preserve_topology=True)` (about 500 m), coordinates rounded to 3 decimals, all 35 parts kept (Andaman and Nicobar, Lakshadweep). 64.7 KB.
- Use: buffer by about 0.02 degrees (2 km) before point-in-polygon, to absorb the simplification and GPS drift at coasts and borders.
- Spot checks (inside): Jodhpur, Jaipur, Mumbai Marine Drive, Chennai Marina, Kavaratti, Port Blair, Leh. Outside: Lahore, Kathmandu, Dhaka, Colombo.
