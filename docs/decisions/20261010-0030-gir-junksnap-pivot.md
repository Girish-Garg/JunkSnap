---
status: accepted
superseded_by:
area: process
by: gir
date: 2026-10-10T00:30+05:30
---
# Build JunkSnap: community-reported, ML-verified waste reporting for India, Jodhpur pilot

Context: the satellite-first "Saboot" idea could not see small dumps and felt like a plain complaint app.

Decision: JunkSnap. In-app camera reports (Snap and live Scan) from anywhere in India; moderation and blurring; stacked verification (Rekognition, YOLO, embeddings, vision judge, meta-learner); sites with ward, MLA and MP lookup; community verification; three area scores (city, citizen, bin access); verified letters. Full list of 15 decisions: docs/handover.md section 4.

Consequences: AGENTS.md, README, features.json and contracts are rewritten for JunkSnap. Satellite history becomes a should-ship layer for large sites only.

Rejected alternatives: satellite-only detection; Google Street View (terms, coverage); drones (none available); potholes (off-track).
