---
status: accepted
superseded_by:
area: contracts
by: hem
date: 2026-10-11T04:00+05:30
---
# Long-range marking: an optional report target up to 500 m from the reporter's GPS

Context: residents often see a dump from a distance (across a vacant plot, a drain or a road, or from a rooftop) and cannot or should not walk to it. The site landed on the phone's GPS point, so the pin was wrong. Asked for by the human on 11 Oct (issue 115).

Decision:
- `report_upload.target` `{lat, lon}` is optional and additive. Absent means "the waste is right here", so the normal flow costs no extra tap.
- The api rejects a target more than 500 m from `gps` with 422 `target_too_far` and stores `target_distance_m`. The app caps the pin at 300 m, or 500 m when the reporter says they are up high, and says why.
- The worker uses `target` for the site point, merge radius, nearby places, nearest bin, ml's nearby-verified count and the ward and seat lookup. Authenticity stays on `gps`: duplicate radius, `gps_accuracy_m`, timestamps.
- `gps` stays as evidence on the reports row and is never public; a site's point is its spot, never a reporter's position.
- A long-range report merges only on a matching photo (both embeddings present, cosine 0.88 or more); otherwise it founds its own site.
- Not for `no_bin` (the zone is where the reporter stands) or scan frames: the schema forbids both.

Consequences for other lanes: the cleanup `near_site` check (50 m from the site) still needs the cleaner at the waste; a long-range cleanup is a later change. Votes keep their 1 km radius from the site point.

Rejected alternatives: replacing `gps` with the target (loses the authenticity evidence); a bearing and distance instead of a point (harder to check, same privacy).
