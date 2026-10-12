---
status: accepted
superseded_by:
area: contracts
by: hem
date: 2026-10-11T17:30+05:30
---
# Same-spot duplicates are merged into the oldest site; the absorbed site is removed as merged, with merged_into

Context: the prod dry run of `mergeSameSpotSites.ts` listed 10 groups with 11 absorbed sites, left by the old cosine-only rule and the batch race (decisions 20261011-1610 and -1700). Closing a duplicate needs a removal reason the contract did not have. The human approved the contract change and the consolidation in chat on 11 Oct 2026; that approval makes this decision accepted.

Decision:
- Contracts v1.18, additive: `removed_reason` gains `merged`; the site gains optional, nullable `merged_into` (a site id), set exactly with `merged`. Fixture `site.jdh-merged`.
- `mergeSameSpotSites.ts <stage> --apply` merges each group into its oldest site with the live domain: each absorbed report is re-merged with `Site.merge` (a Me too aimed at the absorbed site counts for the kept one), its votes are copied (a device's newer vote wins), the kept site is recounted and saved on its version, each report row's `site_id` and status follow it, and the absorbed site is saved as removed, merged, `merged_into`. A second run changes nothing.
- A group whose absorbed site has photo reports, shown residents' notes, cleanup state, a report row elsewhere, or a report beyond the kept site's merge radius is skipped and named; those are merged by hand.
- `GET /sites/{id}` returns `merged_into`; the share card of a merged site is its survivor's; the app opens the survivor; an app that does not know `merged` shows it as removed.

Consequences for other lanes: the frontend gains a chip and an explainer for merged sites (en and hi). Scores and letters already leave removed sites out.

Rejected alternatives: reusing `withdrawn` (says a reporter withdrew, which is false); deleting the duplicates (loses the audit trail and breaks shared links).
