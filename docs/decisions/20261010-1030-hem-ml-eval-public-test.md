---
status: proposed
superseded_by:
area: data
by: hem
date: 2026-10-10T10:30+05:30
---
# Model numbers come from the public test split until field photos are imported; teacher boxes are named

Context: decision 20261010-0200 says results tables use held-out field photos only, but no field photos are imported yet, and issue 50 asks for an evaluation table now. No open dataset boxes whole waste piles or bins.

Decision:
- `docs/ml/eval.md` reports on the public `test` split (hash seed 26, never trained on), says so in its first line, and is rerun on the field `holdout` (grouped by scan and site) once field photos are imported. The README's headline numbers wait for the field holdout.
- `waste_pile` and `bin` boxes on the QR4Change photos come from an OWLv2 teacher (`datasets/qr4change/teacher_boxes.jsonl`), never from people. Their mAP measures agreement with the teacher and is labelled so; it is reported on human-drawn boxes only when the field audit has them.
- Claims are scored as "waste is visible" against the people's labels (QR4Change `garbage` or `non_garbage`), so the stacker and judge numbers rest on human labels.

Consequences for other lanes: the writeup quotes eval.md with its split named; the field audit should draw pile and bin boxes.

Rejected alternatives: waiting for field photos (no table before the freeze); reporting teacher-box mAP as if hand-labelled.
