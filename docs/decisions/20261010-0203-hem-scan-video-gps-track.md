---
status: accepted
superseded_by:
area: contracts
by: hem
date: 2026-10-10T02:03+05:30
---
# Scan mode records video with a synced GPS track; the worker cuts frames

Context: uploading single frames from a moving scooter loses frames and location. Confirmed in chat on 10 Oct.

Decision:
- Scan records video in the app (at most 60 s, 720p, 40 MB) and a GPS track from `watchPosition`, at least one fix per second, timed from the start of the video. Optional on-phone detections go with it as hints only.
- `POST /scans/presign`, then a PUT to `scans/{scan_id}.webm` or `.mp4` in the private bucket, then `POST /scans` with a `scan_session`, which queues `kind: scan`. `GET /scans/{id}` gives the status and the report ids made.
- The worker samples one frame per second (a phone-hinted frame replaces the plain one in its second), maps each frame's time onto the track by interpolation, and drops frames whose nearest fix is more than 3 s away or worse than 50 m. Each kept frame becomes a `capture_mode: scan` report and runs the normal pipeline, including moderation and blur.
- The video is never public and never goes to a model. The limit of 1 frame per second per device stays.

Consequences for other lanes: replaces cloud mode's frame-per-second upload in handover decision 4. P2 builds the scan routes and sampler, F3 records the video and track, I1 adds the `scans` table.

Rejected alternatives: uploading single frames during the ride; trusting the phone's frame choice alone.
