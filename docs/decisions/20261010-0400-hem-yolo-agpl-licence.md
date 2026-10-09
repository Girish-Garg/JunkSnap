---
status: proposed
superseded_by:
area: agent
by: hem
date: 2026-10-10T04:00+05:30
---
# The detector trains with Ultralytics YOLO26 (AGPL-3.0) and serves as ONNX; RF-DETR is the fallback

Context: A2 (issue 50) needs a detector trained on our GPU this weekend. Ultralytics 8.4 (YOLO26) is the fastest path, but it is AGPL-3.0, and Ultralytics says trained models fall under it too.

Decision:
- Train and export with Ultralytics only in `backend/ml/training` (the `gpu` dependency group). The `ml` service runs the exported ONNX through onnxruntime and never imports Ultralytics.
- The repo stays public, so the training code, configs and the service that serves the model are open, as the AGPL asks. The weights sit in the private bucket (`models/`); publish them with the repo if anyone asks.
- If JunkSnap ever needs closed source or a paid product, switch the detector to RF-DETR (Apache-2.0) or D-FINE (Apache-2.0), which export to ONNX too and fit the same `YoloSignal` port, or buy an Ultralytics Enterprise licence.

Consequences for other lanes: the writeup lists Ultralytics and its AGPL licence. The phone model (edge pre-check) is the same AGPL model.

Rejected alternatives: RF-DETR now (slower to train, less tooling for int8 phone export); no detector (piles and burning need boxes).
