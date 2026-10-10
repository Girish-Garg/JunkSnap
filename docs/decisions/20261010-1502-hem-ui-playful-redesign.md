---
status: accepted
superseded_by:
area: frontend
by: hem
date: 2026-10-10T15:02+05:30
---
# UI style is playful: cartoon logo, rounded type, warm palette, spring motion; map-app patterns stay

Context: Hemang's review on 10 Oct found the minimal look soulless: no animation, a dated feel, a clipped Report button on phones, and no sensible Report action on desktop. This replaces the "minimal" part of decision 20261010-0201 (relayed to the redesign lane by the coordinator; flip 0201 to superseded once Hemang accepts this).

Decision:
- Keep the map-app patterns from 0201: full-bleed map, floating search, Filters pill, bottom sheets with peek, half and full, 48 px targets, AA contrast, no gradients, glass or purple.
- Brand: a cartoon camera with a crumpled paper ball for a lens (`frontend/public/brand/`), a two-tone "JunkSnap" wordmark, and icon sets for PWA and Android.
- Type: Baloo 2 (rounded, Latin and Devanagari) for headings and numbers, Hanken Grotesk for text, Noto Sans Devanagari for Hindi text.
- Colour: warm cream neutrals, teal accent, sunny yellow for Report and the logo, coral only inside illustrations. No saffron and no party or flag combinations.
- Motion: CSS `linear()` springs for sheets, cards, tabs and chips; Report wiggles every few seconds and squashes on press; confetti and a drawn tick on send and vote. All of it honours prefers-reduced-motion. No animation library.
- Layout: phones get a bottom bar with a raised 60 px Report button. Desktop (1024 px and up) gets a 420 px side panel (logo, tabs, search, the open sheet or the reports in view) with the map on the right; Scan and Report sit at the top right and open a QR "use your phone" dialog.
- Hand-drawn two-tone icons (`src/ui/icons/`). Appearance can be Light, Dark or System, and the basemap goes dark too. A splash of at most 1.2 s plays at start, and the "How JunkSnap works" cards open once (offices only, never names).
- Every sheet or dialog that is not a route pushes a history entry. Route sheets close with history back, so the Android and browser back buttons close the topmost sheet and leave the app only from the map.

Consequences for other lanes: the demo video and screenshots show this UI. The Android app can take its launcher icons from `frontend/public/brand/android/`. No contract changes.

Rejected alternatives: keeping the minimal Material look, because it was judged generic; the `motion` library, because CSS springs give the same feel with no extra bundle.
