# hem (Hemang): status   (overwrite; at most 30 lines)
Updated: 2026-10-11 01:20 IST
Areas: frontend, docs
## Now
fe-112-sheet-ux → mobile sheet UX: drag to dismiss, closing logic, touch audit (committed locally, not pushed, no PR yet)
## Done since last update
- Every BottomSheet drags on phones: the handle bar, or down from content scrolled to the top; peek/half/full snap points, spring back, drag below peek or throw down from peek closes. Pure reducer `ui/SheetGesture.ts` with tests.
- Root cause of "previous sheet stays on close": Filters, the stack list and the preview card were history layers that stayed under route sheets and came back on close; the area letter, ranking button and area tap used bare `navigate` without depth, so a close pushed a new entry and back revived closed sheets; a route close could fire twice.
- Fix: `useSheetNavigation` unwinds open layers before open/swap/close/home and drops a repeat within 600 ms; `useExitAnimation` closes once; preview card and stack list share one layer; a map tap on phones closes the topmost sheet; Filters paints above route sheets.
- Content scrolls at every sheet height; text fields open the sheet to full and hide the bar; no double-tap zoom; full height respects the status bar inset; `interactive-widget=resizes-content`.
- Decision 20261011-0030 (proposed): each open sheet is one history level.
## Next
- Push fe-112-sheet-ux and open the PR (body in the session scratchpad) when the human says so.
- Check on a real phone in the Tauri WebView: drag from the body over long lists, keyboard with the Areas search.
## Blocked / needs from others
- Hemang to accept decision 20261011-0030 and post it in team chat (frontend lane only).
## Handoff notes
- Expect small conflicts with fe-113-heat-filters in MapPage.tsx (Filters moved after the Outlet, map taps wrapped by useSheetMapTaps) and FiltersSheet; with PR #108 only if SnapRoute stops using BottomSheet.
- Elements in a sheet body that own a vertical drag need `data-own-drag` (video, canvas, inputs are exempt).
- Bug-hunt items folded in: preview card close/back/Escape, typing level keeps notes, focus back to opener, Report overhang padding, 44 px targets. Leftovers: EN/हि hit areas overlap 2 px; MapLibre credits 24 px; no swipe-down on the preview card.
## AI tools used
- Claude Code (Claude Opus): diagnosis, code, tests, review and headless Chrome (CDP touch emulation) screenshots for the sheet UX fix.
