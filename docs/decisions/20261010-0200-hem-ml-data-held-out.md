---
status: accepted
superseded_by:
area: data
by: hem
date: 2026-10-10T02:00+05:30
---
# ML data: open public waste datasets plus Jodhpur field photos, 30% of field photos held out

Context: the models need more training images than one field audit gives, and the results table must be honest. Confirmed in chat on 10 Oct.

Decision:
- Training data is openly licensed public waste datasets (for example TACO or Roboflow Universe garbage sets) plus the Jodhpur field-audit photos.
- Check and record the licence of every dataset before use. Images live in S3 (private bucket, `datasets/` prefix), never in git; `data/datasets/` holds only manifests and licences.
- About 30% of field photos are held out with a recorded seed. They are never trained on, and no photo moves between train and test once evaluation starts.
- Every results table (precision, recall, each model alone vs the stack) uses only held-out field photos.
- Training and evaluation read only blurred copies. The field audit goes through the app, so the pipeline makes blurred copies under `media/reports/`; `datasets/field/` holds those copies, never originals.

Consequences for other lanes: DS1 (issue 26) builds the manifests and the split; A2 trains on the train part and reports on the held-out part; the README shows only these measured numbers.

Rejected alternatives: field photos only (too few); scraped images without a licence check; reporting accuracy on public datasets.
