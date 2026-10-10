---
status: accepted
superseded_by:
area: contracts
by: hem
date: 2026-10-10T14:30+05:30
---
# No bin is reported by people but proven by measurement (scores-v2)

Context: issue #79. A "no bin" report alone is one person's word; a city needs to see that many people say so and that the map agrees.

Decision:
- `no_bin` stays a report type. A no-bin site gets a letter only when at least `NO_BIN_MIN_REPORTERS` (5) distinct people reported it (user id, else device; `site.reporters`) and no known bin or collection point lies within `BIN_RADIUS_M` (3000 m). Otherwise POST /sites/{id}/letters answers 409 `not_verified` with the reason ("3 of 5 people reported no bin here; nearest known bin 4.2 km").
- Known bins: the crawler's `disposal` map layer in `data/wards/<city>.json` (OSM waste_disposal, recycling, waste_transfer_station) plus disposal points of reviewed ward records. Bins seen by the detector are not used: `verification_result` exposes no detections.
- The worker measures at merge, from the founding report's point (`BinLocator`, a 0.05 degree grid): `site.insights.nearest_bin` {distance_m, ref, source} and `no_bin_within_3km`. A town is measured only when its city file gives at least one known bin; an empty layer or no layer leaves both null, never "no bin", and a no-bin letter needs a measured true. Older sites take the first measured report's reading.
- scores-v2 = scores-v1 (decision 20261010-0238) except bin access = mean of 100 - `no_bin_within_3km_pct` (over measured verified sites) and max(0, 100 - median nearest-bin metres / 30); no_data when no verified site was measured. `no_bin_reports` stays a count only; `counts.sites_without_bin_within_3km` is added.
- Every letter carries `evidence` for the app to show and print: report count, distinct reporters, verified count, first and last report, blurred photo links, the measured insights, and the nearest bin for waste_dump and no_bin sites. The resident files it; nothing is sent.

Consequences for other lanes: frontend shows "N of 5 people reported no bin here; nearest known bin X km", the new score fields and letter evidence. The crawler's disposal query lacks `amenity=waste_basket`, and Jodhpur's disposal layer is empty, so Jodhpur sites stay unmeasured and get no no-bin letter until it is re-crawled.

Rejected alternatives: removing `no_bin` reports; counting no_bin reports in the score; treating an unmapped town as having no bins.
