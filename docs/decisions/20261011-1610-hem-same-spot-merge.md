---
status: accepted
superseded_by:
area: contracts
by: hem
date: 2026-10-11T16:10+05:30
---
# Same type within 20 m always merges; from there up to 40 m only when the photos look alike

Context: field bug on 11 Oct: two waste-dump photos less than 1 m apart became two sites ("2 sites at this spot", 2 of 10 and 1 of 10). A merge needed the same type within 40 m and SigLIP 2 cosine 0.88 or more, and two angles of one dump can fall below 0.88 (docs/ml/eval.md: 95% of simulated second shots pass). The human decided on 11 Oct 2026 that same type within 20 m always consolidates; that request authorises this decision as accepted.

Decision:
- New `SITE_SAME_SPOT_M` (default 20, 0 to `SITE_MERGE_RADIUS_M`). A photo report joins the nearest open site of its type within it, the oldest (earliest `first_reported_at`) on a tie, whatever the embeddings say. From there up to `SITE_MERGE_RADIUS_M` (40 m) the `MERGE_MIN_COSINE` (0.88) test applies unchanged.
- Order: the Me too site (at the same spot or with a matching photo), the nearest same-spot site, a scan frame's spot site, the nearest matching site. A frame within 20 m of a nearer existing site joins it even after its spot's site exists.
- Unchanged: the sites nothing may join (rejected, removed, expired; a cleaned site still takes a photo and reopens), long-range reports (matching photo only, decision 20261011-0400) and no-bin zones (decision 20261010-1630).
- Contract text only (contracts/README.md); no schema change.
- `backend/server/scripts/mergeSameSpotSites.ts <dev|demo>` lists the same-spot duplicates already stored, read only. Merging them would mark each absorbed site removed, and `removed_reason` allows only `withdrawn` and `photos_reported`. A value for merged sites is a contract change left to the human, so `--apply` is refused for now.

Consequences for other lanes: fewer stacked pins at one spot; a later photo at the same spot backs the existing site. Two reports at one spot merged in the same worker batch could both found a site (a race); decision 20261011-1700-hem-merge-lock closes it, and the listing finds the duplicates made before.

Rejected alternatives: a lower `MERGE_MIN_COSINE` at every distance (merges different piles up to 40 m apart); a smaller `SITE_MERGE_RADIUS_M` (splits large dumps).
