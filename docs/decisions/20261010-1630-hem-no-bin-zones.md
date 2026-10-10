---
status: accepted
superseded_by:
area: contracts
by: hem
date: 2026-10-10T16:30+05:30
---
# No bin is a community zone, verified by 10 people; mapped bins are evidence, not a gate

Context: a missing dustbin cannot be photographed as waste, and bins on maps can be missing or broken. Set by the lead on 10 Oct.

Decision:
- A signed-in user reports "There is no dustbin within 1 km of here" from where they stand: GPS accuracy at most 50 m, photo optional (moderated and blurred when given; no waste check). Same rate limits.
- A report joins the nearest open no-bin zone whose centre is within 500 m, else founds one. The centre is the mean of its reports' points. A zone is a `no_bin` site with `zone_radius_m` 1000.
- A zone is verified when 10 different people (user id, else device; once each) reported it or voted yes; the no-vote valve of 20261010-1530 applies.
- The nearest mapped bin (OpenStreetMap, ward records) is shown as evidence ("A mapped bin is X m away") and never blocks verification.
- Site and area no-bin letters need a verified zone; the 5-reporter and 3 km rule is gone (`NO_BIN_MIN_REPORTERS` is unused).
- Scores-v3 bin access: the share of verified sites that are verified no-bin zones, plus the measured distance to known bins.

Supersedes: the letter eligibility and scores-v2 bin access parts of 20261010-1430.

Consequences for other lanes: the app reports no-bin from the Report tab without a photo and draws zones as 1 km circles.

Rejected alternatives: requiring a photo of the missing bin; blocking letters when a mapped bin is near.
