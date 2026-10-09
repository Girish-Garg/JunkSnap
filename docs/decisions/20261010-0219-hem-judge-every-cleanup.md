---
status: proposed
superseded_by:
area: agent
by: hem
date: 2026-10-10T02:19+05:30
---
# Every cleanup photo goes to the vision judge; reports only when unsure

Context: decision 0137 runs the judge only when the signals are unsure or disagree. A cleanup closes a site, which is high-stakes and rare, and a photo with no waste labels may simply show a different place.

Decision:
- `purpose: cleanup` always runs the vision judge. The site's report type and context go into the judge prompt, and its answer must include `scene_fits_site`; an answer without it is invalid (retry, then the next provider).
- A cleanup is clean only when the judge says no waste in an outdoor place that fits the site and the combined probability reaches 0.85 without disagreement. No judge answer means not clean.
- Reports are unchanged: the judge runs only when unsure (0.5 to 0.85) or split, and never sees the claim.

Consequences for other lanes: the worker keeps calling `/internal/verify` the same way; cleanups take a few seconds longer and cost one judge call each.

Rejected alternatives: trusting labels alone for cleanups (passes photos of somewhere else); a community check for cleanups (the contract keeps cleanups out of it).
