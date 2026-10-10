# JunkSnap frontend design

Playful on top of map-app patterns (decision 20261010-1502, which replaces the minimal look of 20261010-0201). The map stays quiet and the reports are the colour on it. The chrome has a personality: a cartoon camera logo, rounded headings, a sunny Report button and springy motion.

## Brand

- Mark: a chunky yellow camera with a thick ink outline, a crumpled paper ball for a lens, a coral shutter button and three flash pops. The file is `public/brand/junksnap-mark.svg`; the `Logo` component shows it with the two-tone wordmark (Junk in ink, Snap in teal).
- Icons are in `public/brand/`: `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` and the lockups; a 432 px Android adaptive set is in `public/brand/android/`. `favicon.svg` is the mark on a teal tile (a charcoal tile in dark mode) and `favicon.ico` holds 16 and 32 px with the fine details dropped. `uv run scripts/make_icons.py` makes all of them, plus the Android launcher sources in `apps/android-tauri/` (then `npx tauri icon app-icon.json` there), from `junksnap-mark.svg`.

## Layout

- Phones (below 1024 px): the map fills everything above a 68 px bottom bar with five slots: Map, Areas, Report, Activity, Account. Report is a 60 px yellow sticker button (2 px ink outline, hard 3 px shadow, a 5 px surface ring) raised 24 px into the map. The bar paints above the map, so the button is never clipped, and the bar pads for `env(safe-area-inset-bottom)`.
- Top of the map: a 48 px search field with the 28 px logo mark (12 px padding and 12 px gap, one centre line), "Search Jodhpur" and the EN / हि toggle. Under it are the Filters pill and a one-line status toast.
- Sheets are bottom sheets with three heights (peek 156 px, half, and full minus 80 px and the status bar inset). They follow the finger: drag the handle bar, or drag down from content scrolled to the top; release snaps to the nearest height, a throw moves one height, and a drag below the peek height or a throw down from peek closes the sheet (`SheetGesture`). Content scrolls at every height. On phones, focusing a text field opens the sheet to full and hides the bottom bar while the keyboard is up. The viewport keeps the browser's default for the keyboard (no `interactive-widget`). In Chrome the keyboard overlays the page and only the visual viewport shrinks, so the map, search field and pins do not jump when someone searches. The Android app's WebView resizes the whole window. `useTypingLayer` follows `visualViewport`, which works for both. Items in a sheet that own a drag (camera, canvas, the Snap target map, the photo stage) carry `data-own-drag`, and the sheet ignores pointer events from portaled children. On tablets (640 to 1023 px) they keep a 600 px width.
- Desktop (1024 px and up): a 420 px side panel on the left holds the logo, tab pills (Map, Areas, Activity, Account), search and Filters. Under those it shows the open sheet, or "In view", the list of reports on the map. The map is on the right. Scan and Report sit at its top right and open the "use your phone" dialog with a QR code of the app's address (the code loads lazily, so phones never download it). The status toast floats at the top of the map.
- Start: a splash of at most 1.2 s (the camera pops in, the paper ball rolls into the lens, the flash pops, then the mark flies into the search field logo). Any tap or key skips it; under reduced motion the mark shows still. On the first visit to the map the "How JunkSnap works" cards open once (`/welcome`, 4 swipeable cards: why, how it works, who looks after a site, scores and sign-in). Account reopens them.
- Back (decision 20261011-0030, proposed): each open sheet is one history level. Every sheet, card or dialog that is not a route (sign-in, Filters, the pin preview card or stack list, the phone dialog) pushes a history entry (`useHistoryLayer`). Route sheets open with a depth in router state and close with history back (`useSheetNavigation`, never a bare `navigate`); opening one first unwinds the map's own layers, so nothing stays underneath. Tabs replace each other. Close, the Android and browser back buttons, Escape, a drag down and, on phones, a tap on the map each close exactly the topmost sheet, and the app is left only from the map. A text field with the keyboard up is one more level: the first back or Escape lets go of the field, not the sheet. The pin preview card has a close button and closes with back and Escape too.

## Tokens (`src/ui/tokens.css`)

- Type: Baloo 2 for headings and numbers, Hanken Grotesk for text, Noto Sans Devanagari for Hindi text (`:lang(hi)`). The scale is caption 12/16, small 13/18, body 15/22, lead 17/24, title 26/30 and headline 32/36. Inputs are 16 px.
- Spacing: a 4 px scale (`--s-1` 4 to `--s-12` 48). Screen edges are 16 px on phones and 24 px on desktop. Use only the scale.
- Radii: 8, 12, 16, 22, 30 and pill. Sheets use 30, cards 16 to 22, inputs 12; buttons are pills.
- Colour: page `#fbf6ee`, surface `#fffdf8`, tile `#f4ecdf`, text `#221c15` and `#5f5446`, accent teal `#0b7a73` (white text 5.2:1), sun `#ffc23d` for Report and the logo, and coral `#ff7a59` only inside illustrations. Dark mode keeps the roles with warm charcoal neutrals and a lighter teal. There are no party colours: no saffron, and no saffron-white-green or other flag combinations.
- Report types: dump `#c5221f`, no bin `#e37400`, water `#1967d2`, construction `#5d4037`, overflowing or broken bin `#7b3fa6`. Chips and lists use hand-drawn type icons (`TypeIcon`: heap, crossed bin, drop, cone, open bin spilling over) filled with the type colour on a soft tint tile; map pins keep the round glyph discs. Colour is never the only cue.
- Icons: the key icons are hand-drawn components in `src/ui/icons/` (one file each, 24 grid, 2 px rounded outline): map with a pin, neighbourhood with a flag, the logo camera, clipboard with a tick, a friendly face, sliders, target, share and printer. At rest they are outlines; the current tab or a pressed pill fills the two tones (sun and teal tint) and hops. The small utility icons (close, search, chevrons) stay plain paths in `Icon`.
- Appearance: Account → Settings offers System (the default), Light and Dark (`ThemePreference`, localStorage key `junksnap.theme`). An inline script in `index.html` sets `data-theme` before first paint. The basemap switches to its dark palette in place (`BasemapTheme.paint`).
- Language: Account → Settings also offers English and हिन्दी (the same choice as the EN / हि toggle). In list mode, where the search field is hidden, the toggle sits beside Filters.
- Status chips: a dot plus the word, on a tint (open, cleaned, reopened, community check).
- Elevation: soft warm shadows for floating things, and a hard ink "sticker" shadow for the chunky ones (Report, the primary site action, the success tick).

## Motion

- Springs come from CSS `linear()` (`--spring`, `--spring-bouncy`); there is no animation library. Sheets spring up and slide away (`useExitAnimation`). Content rises a beat after its sheet, lists stagger, and the selected tab pill pops.
- Buttons press down into their shadow and squash. Report wiggles every 7 s.
- Map: pins drop in with a bounce when sites first arrive (`PinDrop`); the selected pin gets a landing splash and then a breathing ring (`SelectedPulse`), and the user dot pings.
- Delight: confetti and a self-drawing tick when a report or video is saved, confetti when a vote counts, and a hopping logo while a letter drafts. Skeletons sweep.
- `prefers-reduced-motion` cuts every animation to 1 ms and hides the confetti.

## States

- Empty states use small cartoons in the logo's style (`Illustration`): a happy bin (nothing here), a sleepy unplugged cloud (could not load) and the camera with its lens shut (camera blocked).
- The toast gives one line for each of: offline, load failed, location blocked, filters hiding everything, "zoom in", sites just off screen (with a "Show the nearest report" button), and a truly empty view. It never says "No reports here yet" while the search around the view is still running.
- Opening view: if the first view loads empty and nothing else has moved the map (the person, a search, a deep link or a location fix), it widens once to take in the nearest sites (`NearestSites`).
- Actions that are off (decision 20261011-0303, proposed): a reason the person must act on (own site, too far, letters waiting for 10 people, offline, rate limited) shows the action muted with `aria-disabled` and a dashed tile, and a tap says why in the app toast at the top; a short wait (sending, camera starting, first GPS fix) is plainly disabled; a sign-in reason looks normal and opens sign-in with the reason. Every sheet shows a line while offline, and a crashed sheet shows "Something went wrong" with Try again.
- Mock mode: Filters carries a small "Sample data" note, and code fields show the sample code.

## Rules kept from 0201

- 48 px touch targets, a 2 px focus ring, and AA contrast in both themes.
- No gradients used as decoration, no glass and no purple. Show no names of individuals anywhere.
