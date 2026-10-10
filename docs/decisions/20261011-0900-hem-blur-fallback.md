---
status: proposed
superseded_by:
area: contracts
by: hem
date: 2026-10-11T09:00+05:30
---
# The blur never trusts "found nothing": people and vehicles from DetectLabels are blurred too

Context: issue 110. A night photo in Jodhpur went public with a readable motorbike plate and two unblurred people: DetectFaces and DetectText found nothing in the low light, so nothing was blurred.

Decision:
- One DetectLabels call (instances, confidence 40 and up) finds License Plate boxes, people and vehicles. Every plate box is blurred. A person with no face found inside gets the top quarter of the box blurred; a vehicle with no plate found inside gets its lower 60% (two-wheelers and three-wheelers 75%) blurred, full width.
- A whole person or vehicle box is blurred when the photo is dark (mean grey below 0.3), the instance confidence is below 70 or the box is under 20% of the image height. Over-blurring beats leaking.
- Contracts v1.10, additive: optional `blur.regions` (counts by kind) and `blur.low_light`. `faces` and `plates` keep their meaning. Public copies carry S3 metadata `blur-policy`.
- `backend/server/scripts/reblurPublic.ts` re-blurs existing public copies of one stage from their originals; the lead runs it.

Consequences for other lanes: none for the app or ml; the blurred photo shows more blur on night and crowded photos. CloudFront caches `/media/*` for a day, so a re-blur needs an invalidation.

Rejected alternatives: blurring the whole photo when dark (the report becomes useless); trusting DetectFaces and DetectText alone.
