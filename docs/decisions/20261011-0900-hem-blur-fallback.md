---
status: accepted
superseded_by:
area: contracts
by: hem
date: 2026-10-11T09:00+05:30
---
# The blur never trusts "found nothing": people and vehicles from DetectLabels are blurred too

Context: issue 110. A night photo in Jodhpur went public with a readable motorbike plate and two unblurred people: DetectFaces and DetectText found nothing in the low light, so nothing was blurred. The human asked for this privacy fix, and that request authorises this decision as accepted.

Decision:
- One DetectLabels call (instances, confidence 40 and up) finds License Plate boxes, people and vehicles. Every plate box is blurred. A person with no face found inside gets the top quarter of the box blurred; a vehicle with no plate found inside gets its lower 60% (two-wheelers and three-wheelers 75%) blurred, full width.
- A face or plate covers a subject only when its centre is in that subject's own head band or plate zone, never a neighbour's.
- A whole person or vehicle box is blurred when the photo is dark (mean grey below 0.3), the instance confidence is below 70, the box is under 20% of the image height, or a person's box is wider than 0.7 of its height (bent over or crouching). Over-blurring beats leaking.
- A dark photo where nothing at all is found (no face, plate, person or vehicle) gets the lower 45% of the image blurred, where kerb-level plates and nearby faces usually are; the record says `low_light: true` and `regions.band: 1`.
- Contracts v1.13, additive: optional `blur.regions` (counts by kind, `band` included) and `blur.low_light`. `faces` and `plates` keep their meaning. Public copies carry S3 metadata `blur-policy` (`subjects-2`).
- `backend/server/scripts/reblurPublic.ts` re-blurs existing public copies of one stage from their originals; the lead runs it.

Consequences for other lanes: none for the app or ml; the blurred photo shows more blur on night and crowded photos. CloudFront caches `/media/*` for a day, so a re-blur needs an invalidation.

Rejected alternatives: blurring the whole photo when dark (the report becomes useless); trusting DetectFaces and DetectText alone.
