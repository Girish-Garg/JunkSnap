---
status: accepted
superseded_by:
area: frontend
by: hem
date: 2026-10-10T02:01+05:30
---
# UI style: minimal custom components with map-app patterns, no generated look

Context: design and usability are judged, and the app must work one-handed on a phone in the street. Confirmed in chat on 10 Oct.

Decision:
- Minimal, custom components. Map-app patterns: full-bleed map, floating search bar, filter chips, a draggable bottom sheet (peek, half, full) with an action row, and one camera button in the thumb zone.
- No generated look: no gradients, glassmorphism, emoji or purple.
- Fonts: Noto Sans and Noto Sans Devanagari. Touch targets at least 48 px. Contrast meets WCAG AA.
- Details live in `frontend/DESIGN.md` (added in PR 33).

Consequences for other lanes: frontend tasks F1 to F5 follow `frontend/DESIGN.md`; the video shows this UI.

Rejected alternatives: a stock component kit look; a dashboard layout with side panels.
