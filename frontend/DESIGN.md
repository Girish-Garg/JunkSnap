# JunkSnap frontend design

Map-app patterns (Google Maps, Apple Maps, Material 3), not their branding. Minimal, custom components, no UI kit look.

## Layout

- Full-bleed map. Everything else floats over it.
- Top: a white search bar (pill, radius 28 px, elevation 2) with a menu button (language, data note) and a search field over the loaded sites (ward, seat, town, type).
- Under it: one row of filter chips (Dumps, No bin, Water, Construction, Verified only). The row scrolls sideways on phones. Each type chip carries its marker glyph, so the chip row is the legend.
- Bottom-right, in the thumb zone: "My location" (48 px, white) above the Snap button (56 px, accent, camera icon). Snap is the one primary action. Both hide while a sheet covers them on phones.
- Bottom-left: the map credit line (OpenFreeMap, OpenMapTiles, OpenStreetMap).
- Site details open in a bottom sheet with three heights. Peek (156 px) shows type, status and distance. Half (50%) adds the action row, photo strip, location line and counts. Full (100% minus 80 px, so a band of map stays visible) adds the details and history.
- Desktop (768 px and up): the sheet becomes a 408 px left side panel. The search bar sits inside it at the top, and the chips sit to the right of the panel.

## Components (src/ui, inline SVG only)

- `Icon`: one 24 px icon set (stroke 2, round caps). Icons are always paired with a visible label or an aria-label.
- `IconButton`: 48 px round. Variants are surface (white with elevation), plain and accent.
- `Chip`: a filter chip, a toggle with `aria-pressed`. 32 px visual height inside a 48 px target, radius 8. Off is a 1 px outline. On is accent-soft fill, an accent outline and a leading check.
- `BottomSheet`: the 48 px handle is a button. Tap cycles the heights, ArrowUp and ArrowDown step through them, dragging snaps to the nearest height, a quick flick moves one step, and Escape closes it.
- `ActionRow`: equal-width labelled icon buttons (Confirm, Me too, Cleaned, Letter, Share). An action that isn't built yet is shown disabled, with "Coming soon".
- `Notice`: one banner at a time, below the chips, in this priority order: offline, load failed, location problem, empty, zoom hint.
- `Skeleton`: grey blocks that stand in for loading content. No spinners.
- `MarkerGlyph`: the report-type shape plus colour, shared by map markers, chips and the sheet.

## Markers

- Shapes are readable without colour: waste dump is a circle, no bin is a square, water is a drop and construction is a triangle. Each has an Okabe-Ito fill with a 2 px white edge.
- Clusters below zoom 12 are white discs with a near-black count. Tapping one zooms in.
- The selected site gets a white halo and a 3 px accent ring.

## Tokens (src/ui/theme.css)

- Spacing: an 8 px grid (4 px only inside small controls).
- Radii: 8 (chip), 16 (card), 24 (sheet top), 28 (search bar).
- Surfaces: white `#ffffff` and muted `#f2f4f5`. Ink: near-black `#1a1f24` and muted `#4b5661`. Lines: `#d8dde1`.
- Accent: teal `#0b5d57` (7.7:1 on white), with soft accent `#e2efed`. It is the only accent colour; there is no purple and there are no gradients or glass effects.
- Status scale: open uses `#b42318` on `#fdecea`, reopened uses `#b54708` on `#fef0e6` and cleared uses `#067647` on `#e7f6ec`. All pairs pass WCAG AA.
- Type: Noto Sans for Latin and Noto Sans Devanagari for Hindi (line-height 1.65). Sizes are 12, 14, 16, 20 and 24.
- Focus: a 3 px accent outline with 2 px offset on every interactive element. Touch targets are at least 48 px.

## States

- Loading: a skeleton in the sheet. Map markers stay up while the next box loads.
- Empty: say what to do. With no sites here: "Move the map or zoom out". With filters on: "Turn a filter off".
- Errors: plain words and what still works. Offline: "Showing what was already loaded".
- Mock mode: a "Sample data" pill in the search bar, so fixtures are never mistaken for live reports.
