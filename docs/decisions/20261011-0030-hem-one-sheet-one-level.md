---
status: proposed          # proposed | accepted | superseded
superseded_by:            # filename of the replacement, if any
area: frontend            # frontend | data | agent | infra | contracts | process
by: hem                   # person code
date: 2026-10-11T00:30+05:30
---
# Each open sheet is one history level: opening a route sheet clears the map's own sheets, and close, back, Escape, a drag down and a map tap each pop exactly one

Context: field testing on the Android app found the previous sheet staying open after a close. Filters, the stack list and the preview card (not routes) stayed under the next route sheet and came back when it closed; the area letter, the ranking button and area taps navigated without depth, so a close pushed a new entry and back revived closed sheets. Sheets could only be closed with the X.

Decision (refines 20261010-1502, which stays accepted):
- Every visible sheet, card or dialog is one history level. Route sheets stack through `useSheetNavigation.open`; tabs `swap`. Never call `navigate()` for a sheet route; use `open`, `swap`, `close` or a `<Link state={linkState}>`.
- `open`, `swap`, `close` and `home` first unwind the open `useHistoryLayer` layers (`HistoryLayers.unwind`), so the map's own sheets never sit under a route sheet. A repeat within 600 ms on the same screen is dropped (a double tap pops one level).
- The pin preview card and the stack list share one layer (back closes them; the card has a close button and takes Escape). A layer that closes without history drops its own entry. A step back marks the entry it leaves, so a second request waits for it instead of popping two levels.
- A text field with the keyboard up is one more level (`useTypingLayer`): the first back or Escape lets go of the field, so a half-written note survives.
- `BottomSheet` drags on phones: the handle bar always, and the body downwards once its content is scrolled to the top. Snap points peek/half/full; drag below 60 % of peek, or throw down from peek, to close. The pure reducer is `ui/SheetGesture.ts`.
- On phones a map tap with a sheet open closes the topmost one (`TopLayer.dismiss`, the Escape path); a pin tap with a site sheet open opens that site in its place.

Consequences for other lanes: frontend only. New sheets must use `BottomSheet` (or `useEscapeKey` + `useHistoryLayer`) to join the model. Elements inside a sheet body that own a vertical drag mark themselves `data-own-drag` (video, canvas and inputs are exempt already).

Rejected alternatives: sheets opened from another always replacing it (would contradict 1502's "back closes the topmost sheet" and lose drill-down context); a gesture library (no animation or gesture dependency in the app).
