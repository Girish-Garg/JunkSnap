---
status: proposed
superseded_by:
area: agent
by: hem
date: 2026-10-10T01:37+05:30
---
# LLMs are the last step in detection and mainly crawl ward data

Context: Hemang wants detection to rest on the measured models, and the LLM effort to go into ward data, which is spread across many official public pages.

Decision:
- Detection: Rekognition labels, YOLO and Titan embeddings decide first. The vision LLM judge runs only when they are not confident or disagree. It never sets counts or boxes.
- Ward-data crawler: an offline job reads official public pages (municipal corporation and ward lists, census tables, state election and assembly sites, Lok Sabha, Swachh Survekshan). It extracts ward records: ward number and name, municipal body, zone, area km², population, councillor seat, sanitation office contact, legal disposal and collection points, assembly and Lok Sabha seat.
- Each field carries its source URL, `fetched_at` and a SHA-256 of the page. Output is validated JSON in `data/wards/`, reviewed before use.
- No personal names are stored: offices and seats only.

Consequences for other lanes: new task W1 in wave 2 feeds D2 (location) and the area scores. The ward record shape needs a contract (contract-only PR).

Rejected alternatives: the LLM judge as an equal signal on every report; hand-typing ward data.
