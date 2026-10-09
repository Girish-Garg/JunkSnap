# Boundary sources

## india_outline.geojson

India outline for the inside-India authenticity check (issue #13). One Feature, a MultiPolygon in WGS 84 (lon, lat).

- Source: Natural Earth 1:10m Admin 0 countries, India point of view (`ne_10m_admin_0_countries_ind`), feature `ADM0_A3 = IND`.
- URL: https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_countries_ind.geojson (repo VERSION `5.2.0-pre`; file last changed in commit `9380cca`, 2022-05-13).
- Licence: public domain (https://www.naturalearthdata.com/about/terms-of-use/). No attribution required.
- As of: downloaded 2026-10-10.
- Processing: shapely `simplify(0.005, preserve_topology=True)` (about 500 m), coordinates rounded to 3 decimals, all 35 parts kept (Andaman and Nicobar, Lakshadweep). 64.7 KB.
- Use: buffer by about 0.02 degrees (2 km) before point-in-polygon, to absorb the simplification and GPS drift at coasts and borders.
- Spot checks (inside): Jodhpur, Jaipur, Mumbai Marine Drive, Chennai Marina, Kavaratti, Port Blair, Leh. Outside: Lahore, Kathmandu, Dhaka, Colombo.
