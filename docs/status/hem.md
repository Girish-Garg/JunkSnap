# hem (Hemang): status   (overwrite; at most 30 lines)
Updated: 2026-10-10 15:55 IST
Areas: frontend, docs
## Now
fe-76-redesign → #76 part C, visual redesign of the web app (committed locally, not pushed, no PR yet)
## Done since last update
- Playful redesign: tokens (4 px spacing, type scale, radii, elevation, light and dark), Baloo 2 + Hanken Grotesk + Noto Sans Devanagari.
- Cartoon camera logo and brand assets in frontend/public/brand (PWA icons, Android adaptive set).
- Hand-drawn icons, raised Report button on phones, desktop side panel with a QR "use your phone" dialog for Scan and Report.
- Spring motion: sheets, cards, tabs, pins drop in, selected-pin pulse, confetti and tick on save and vote, logo loader, splash.
- "How JunkSnap works" cards (/welcome), Light, Dark and System appearance with a dark basemap.
- Android and browser back close the topmost sheet first (useHistoryLayer, useSheetNavigation), with tests.
- Restyled the merged ranking list, boundary controls and photo viewer; map legend behind a "Legend" chip (folded on phones).
## Next
- Re-check the Legend chip when the area-markers PR lands (it wraps BoundaryLegend; contents unchanged).
- Push fe-76-redesign and open the PR when the human says so.
## Blocked / needs from others
- Hemang to accept decision 20261010-1502 (proposed), then flip 0201 to superseded.
## Handoff notes
- The PR is large (about 150 files). Either split it or note in the PR that the team accepts one PR.
- The basemap stays OpenFreeMap Positron, recoloured. Dark mode repaints it in place (BasemapMode).
- Dev server for screenshots: `npx vite --port 5191`. The Playwright scripts are outside the repo.
## AI tools used
- Claude Code (Claude Opus): design, code, tests, review and screenshots for the redesign; Playwright with local Chrome for screenshots.
