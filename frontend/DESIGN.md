# JunkSnap frontend design

Restrained map-app patterns (Google Maps, Apple Maps, Material 3), not their branding. A quiet map where reports are the only colour; few elements; small soft controls.

## Layout

- The map fills everything above the navigation. The basemap is OpenFreeMap Positron recoloured in `BasemapTheme`: near-white land, pale grey roads, soft blue water, grey labels, no landuse fills, POIs or shields.
- Top: one 48 px search field (radius 24) with a search icon, "Search Jodhpur", and a compact EN / हि toggle. Results are places from the loaded sites (ward, seat, locality); picking one flies the map there.
- Under it: a small "Filters" pill that opens a sheet with the map view (Auto, Pins, Heat), one switch per report type with its count, and "Verified only". A slim one-line toast below the pill reports states.
- Bottom: a 64 px Material 3 navigation bar with five equal slots: Map, Areas, Report (centre), Activity, Account. Every slot has a 24 px icon and a 12 px label. Report is a 48 px filled accent circle on the same centre line, rising 5 px (8 px at most) above the bar. Only the selected tab shows the soft pill. Desktop turns it into an 80 px left rail with Report in the middle.
- A 40 px white "my location" circle sits right, just above the bar. The map credit is MapLibre's compact "i" bottom-left.
- Desktop: sheets become a 400 px side panel next to the rail.

## Map

- Zooms are MapLibre's (512 px tiles, one below Google's). The app opens Jodhpur at 12, the city view.
- Auto mode shows a heatmap up to zoom 11, which fades out between 11 and 12 as pins fade in. The ramp runs from transparent through the teal family to deep red for hotspots.
- Pins are a 26 px round disc in the type colour with a 2 px white ring, a soft shadow and a white glyph. A selected pin grows to about 39 px with an accent ring.
- Tapping a pin shows a 104 px preview card (thumbnail, type, status, reports, distance, Details). Tapping the map dismisses it.

## Components (src/ui, inline SVG only)

- Pill, IconButton (40 px with a 48 px hit area), SwitchRow, Segmented, TextField, PasswordField, Checkbox, Button (primary or text), BottomSheet, Notice, Skeleton and ActionRow.
- BottomSheet has three heights (peek 156 px, half, full minus 80 px). It has a drag handle, and it focuses its title on open and returns focus on close.
- ActionRow: 40 px circles with 12 px labels; the primary action is filled. Unbuilt actions say "Coming soon" in visible text.
- Accounts: sign in, sign up (password strength hint, terms), a 6-digit code with a resend timer, and a reset flow. Errors appear under their field. Signed-out users browse freely; Report and the site actions ask to sign in first, then continue.

## Tokens (src/ui/theme.css)

- Neutrals: text `#1f1f1f`, secondary `#5f6368`, divider `#e8eaed`, surface `#ffffff`, page `#f8f9fa`, tile `#f1f3f4`.
- Accent (actions and selected states only): `#0b6e63`, hover `#095c53`, tint `#e1f0ee`.
- Report types: dump `#c5221f`, no bin `#e37400`, water `#1967d2`, construction `#5d4037`. Each pairs with a glyph, so colour is never the only cue.
- Status pills (20 px, 12 px text, tint plus AA text): open `#c5221f` on `#fce8e6`, cleared `#137333` on `#e6f4ea`, reopened `#9c5700` on `#fef7e0`, community check `#5f6368` on `#f1f3f4`.
- Spacing: an 8 px grid with 16 px edges and 24 px between sections. Radii are 8, 12, 16, 24 and pill.
- Type: Noto Sans and Noto Sans Devanagari. Title 22/28 semibold, body 14/20, secondary 12/16, inputs 16.
- Shadow, for floating elements only: `0 1px 2px rgb(60 64 67 / .3), 0 1px 3px 1px rgb(60 64 67 / .15)`. No gradients, glass or purple.
- Touch targets are 48 px. Focus shows a 2 px accent ring; sheet titles take focus without a ring.

## States

- Loading: a skeleton in the sheet. Pins stay up while the next box loads.
- The toast is one line each for offline, load failed, location blocked, filters hiding everything, "zoom in", and a truly empty view.
- Mock mode: Filters carries a small "Sample data" note, and code fields show the sample code.
