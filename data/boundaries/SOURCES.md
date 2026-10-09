# Boundary sources

## Seats: rajasthan_assembly.geojson and india_loksabha.geojson

Built 2026-10-10. Use `eci-2008-delimitation/v1` as `location_lookup.boundaries_version` for these files. GeoJSON FeatureCollections in WGS 84 (`[lon, lat]`), 5 decimal places.

| File | Holds | Size | Licence |
|---|---|---|---|
| `rajasthan_assembly.geojson` | 200 Rajasthan assembly seats (2008 delimitation). Properties: `id` (`s20-ac-<n>`), `ac_no`, `name`, `category` (`GEN`, `SC`, `ST`), `pc_id` (`s20-pc-<n>`) | 624 KB | CC BY 2.5 India: credit DataMeet and the Election Commission of India |
| `india_loksabha.geojson` | 543 Lok Sabha seats. Properties: `id` (`<eci-state>-pc-<n>`), `pc_no`, `name`, `category`, `eci_state`, `state`, `status` (`current` or `outdated`) | 1.57 MB | CC0 1.0 (credit DataMeet) |

### Sources

- DataMeet assembly seats: <https://github.com/datameet/maps/tree/master/assembly-constituencies> (`India_AC.shp`, scraped from ECI's polling station site), CC BY 2.5 India.
- DataMeet Lok Sabha seats: <https://github.com/datameet/maps/tree/master/parliamentary-constituencies> (`india_pc_2019_simplified.geojson`, corrected attributes), CC0 1.0.
- ECI polling station locations, 2017 (source psleci.nic.in): <https://github.com/ramSeraph/indian_facilities/releases/tag/elections> (`ECI_PollingStations_2017`), CC0 1.0 with a request to credit DataMeet and the government source.
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

## Wards: none yet

Jodhpur's two corporations (North and South, 80 wards each) became one Jodhpur Municipal Corporation with 100 newly delimited wards in November 2025; Jaipur's became one corporation with 150 wards. No open map of the new wards was found: OpenStreetMap has no `admin_level=10` boundaries in Jodhpur (checked 2026-10-10), and the open ward maps that exist (DataMeet Municipal_Spatial_Data for Jaipur, Swachh Bharat Mission wards in indian_admin_boundaries) predate the 2025 merger, so their ward numbers are wrong now. `ward` stays null until a current map is published or the ward records task (W1) provides one.

## india_outline.geojson

India outline for the inside-India authenticity check (issue #13). One Feature, a MultiPolygon in WGS 84 (lon, lat).

- Source: Natural Earth 1:10m Admin 0 countries, India point of view (`ne_10m_admin_0_countries_ind`), feature `ADM0_A3 = IND`.
- URL: https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries_ind.geojson (repo VERSION `5.2.0-pre`; file last changed in commit `9380cca`, 2022-05-13).
- Licence: public domain (https://www.naturalearthdata.com/about/terms-of-use/). No attribution required.
- As of: downloaded 2026-10-10.
- Processing: shapely `simplify(0.005, preserve_topology=True)` (about 500 m), coordinates rounded to 3 decimals, all 35 parts kept (Andaman and Nicobar, Lakshadweep). 64.7 KB.
- Use: buffer by about 0.02 degrees (2 km) before point-in-polygon, to absorb the simplification and GPS drift at coasts and borders.
- Spot checks (inside): Jodhpur, Jaipur, Mumbai Marine Drive, Chennai Marina, Kavaratti, Port Blair, Leh. Outside: Lahore, Kathmandu, Dhaka, Colombo.
