---
status: proposed
superseded_by: 20261010-1430-hem-measured-bin-access.md (bin access only)
area: data
by: hem
date: 2026-10-10T02:38+05:30
---
# Area score formulas scores-v1 and area insights

Context: issue #20 needs versioned, measured formulas for the city, citizen and bin access scores, the diagnosis (handover decision 11) and the area insights (decision 20261010-0202).

Decision (`formula_version: "scores-v1"`; scores 0 to 100, higher is better; metrics read verified sites, counts read every site that is not rejected):
- City = mean of the measurable parts: max(0, 100 - 10 x median days to clear) (first report to `cleaned_at`; open sites count the days so far; a reopened site keeps its last cleanup); % cleared within 7 days (only sites reported 7 or more days before the run, else null); 100 - re-dumped % (reopened / ever cleared); no-bin response % (no_bin sites ever cleared / all no_bin sites). scores-v3 (decision 20261010-1645) adds a fifth part, bin service % (verified overflowing_bin sites ever cleared / all verified overflowing_bin sites; metric `bin_service_pct`), so bins not serviced count under city response; a bin service % below 50 also triggers the city_response diagnosis.
- Citizen raw = mean of max(0, 100 - 5 x new verified waste_dump sites per km² per month (month = max(window days, 1) / 30)), 100 - share of verified waste_dump reports on vacant plots, drains and roadsides, and 100 - re-dumped %. Needs ward km², else no_data. Published citizen = raw + (100 - raw) x (100 - bin access) / 200, unadjusted when bin access is null.
- Bin access = mean of 100 - no-bin share (verified no_bin reports / verified reports) and max(0, 100 - median metres from verified sites to the nearest disposal point / 10). Needs disposal points, else no_data.
- Diagnosis reads the raw citizen score, so the adjustment never hides dumping: infrastructure_gap = citizen < 50 and bin access < 50; behaviour = citizen < 50 and bin access >= 50; city_response = median days > 7 or 7-day % < 50; repeat_spot = re-dumped % >= 20. A null input never triggers one.
- Guardrails: a verified report is auto-verified or confirmed by neighbours (`site.verified_count`); under 10 every score is null (too_few_reports), metrics null, diagnosis empty; counts always show; pilot when any site in the area is; data window from the earliest first report to the run, never back-filled; each run overwrites the area's row. Scores round to whole numbers, metrics to 0.1, distance to 1 m.
- Facts come from `review_status: reviewed` records in `<ASSETS_DIR>/wards/<city>.json`. A ward area `<local-body>-w<n>` joins on the cities of the body's towns (`representatives/local_bodies.json`) plus `ward_number`; two matching records mean unknown. v1 has km² and disposal points for wards only, so seats and districts get no_data for citizen and bin access. Population is unused.
- Insights: composition = report-weighted mean of site shares, with the distinct models behind them; hazardous % = sites with burning or a hazard; top 5 brands by readable labels; repeat spots = reopened or reported on 2 or more IST days; IST hour and weekday histograms (weekday no_data under 7 days); sites with a `school` or `water` place in `site.insights.near`, no_data when the sites' cities have no school or water map layer. Shares and patterns follow the guardrail; counts always show.
- A failing area is logged by key and skipped; the run scores the rest, then exits non-zero.

Consequences for other lanes: the worker's seeded scores row is the ward_scores body plus `area_kind` and `area_id`; the frontend area page reads `insights` as in contracts v1.1.

Rejected alternatives: diagnosing from the adjusted citizen score; summing ward km² for seats (partial coverage understates density); population rates (no reliable ward census yet).
