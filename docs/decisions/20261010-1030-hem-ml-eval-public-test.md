---
status: accepted
superseded_by:
area: data
by: hem
date: 2026-10-10T10:30+05:30
---
# Model numbers come from the public test split; teacher boxes are named

Context: decision 20261010-0200 said results tables use held-out field photos only. Issue 50 needed a table now, and decision 20261010-1245 then ruled out field photos for training and evaluation altogether. No open dataset boxes whole waste piles or bins.

Decision:
- Accepted on 10 Oct; it amends the evaluation part of 0200 (now superseded by 1245).
- `docs/ml/eval.md` reports on the public `test` split (hash seed 26, never trained on) and says so in its first line.
- `waste_pile` and `bin` boxes on the QR4Change photos come from an OWLv2 teacher (`datasets/qr4change/teacher_boxes.jsonl`), never from people. Their mAP measures agreement with the teacher and is labelled so.
- Claims are scored as "waste is visible" against people's labels (QR4Change `garbage` or `non_garbage`), so the stacker and judge numbers rest on human labels.

Consequences for other lanes: the writeup quotes eval.md with its split named and says Jodhpur accuracy is not measured.

Rejected alternatives: no table before the freeze; reporting teacher-box mAP as if hand-labelled.
