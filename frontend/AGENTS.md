# frontend: the JunkSnap web app

Mobile-first web app: Snap and Scan capture, the India map opening on Jodhpur, site pages, community checks, area pages and letter previews. Amplify builds and hosts it from `main` using `amplify.yml`.

Stack: React 19.3, Vite 8.3, TypeScript 6.0.3 (`strict: true`; not 7, because typescript-eslint supports only `typescript <6.1`), MapLibre GL 6.13, i18next, Vitest, ESLint 10.

## Layout (docs/working.md section 1)

- `src/app/`: `App.tsx`, routes and the `ServiceContainer` (the one place that builds services).
- `src/domain/`: types that mirror `contracts/schemas/`, plus small domain classes.
- `src/services/`: classes such as `ApiClient`, `UploadQueue`, `CameraCapture`, `GeoLocator`, `CapabilityProbe`, `ScanController`, `EdgeDetector`.
- `src/features/<name>/`: `snap`, `scan`, `map`, `site`, `community`, `area`, `letters`, each with `components/` and `hooks/`.
- `src/layers/`: one MapLibre layer per file.
- `src/ui/`: shared presentational components.
- `src/i18n/`: `en.json` and `hi.json`. Load Noto Sans Devanagari for Hindi.
- `public/models/`: the small on-phone model files. `tests/`: Vitest tests.

## Commands

```
cd frontend
npm ci
npm run dev
npm run lint
npm test -- --run
npm run build
```

## Conventions

- Direction: components → hooks → services → `ApiClient`. Components hold no business logic; hooks only adapt service state to React.
- One class or component per file, named after it. Hooks are `useX`. Readonly value types; no `any`.
- ESLint enforces the limits: `max-lines` 250 (`.tsx` 150), `max-lines-per-function` 30, `complexity` 8, `max-params` 4, `max-depth` 3. `scripts/check_limits.py` checks file sizes too.
- Mock mode reads `contracts/fixtures/`; live mode calls the API through CloudFront. Keep mock mode working until the end. Environment variable names are listed in `contracts/README.md`.
- Shapes and routes come from `contracts/`. If the app needs a new field, raise it on the contracts issue first.
- Capture is the in-app camera only (no gallery upload). Hash the original with SHA-256 on the phone, then upload with the presigned PUT and submit the report.
- Scan records video (at most 60 s, 720p, 40 MB) and a GPS track from `watchPosition`, at least one fix per second, both timed from the start of recording; then it presigns, PUTs the video and posts a `scan_session` (decision 20261010-0203).
- Edge mode runs only when the startup probe passes; otherwise use cloud mode. Scores from the phone are hints for live boxes and frame choice; the server always re-verifies.
- UI style: playful on top of map-app patterns (cartoon logo, rounded headings, springy motion), custom components, no generated look; details in `frontend/DESIGN.md` (decision 20261010-1502, replacing the minimal look of 20261010-0201). Use only the tokens in `src/ui/tokens.css`.
- Back button: a sheet that is not a route uses `useHistoryLayer`; route sheets open and close through `useSheetNavigation` (never a bare `navigate`), so Android back closes the topmost sheet. Each open sheet is one level: close, back, Escape, a drag down and a map tap pop exactly one (decision 20261011-0030, proposed). Tabs and "All areas" use `up(path)`: back to that screen if it is underneath, else it takes the current sheet's place. The map's pin card, stack list and area card share one history level (`usePickLayer`). A replace that keeps the screen (a filter in the address) passes `location.state` along. Build sheets on `BottomSheet` to get the drag and the model.
- Accounts (decision 20261010-0227): browsing needs no sign-in; Snap, Scan, votes, cleanups and letters do. Sign in with Cognito (`VITE_COGNITO_*`) and send the ID token as `Authorization: Bearer`. Never show or store another user's id, email or name.
- Failed uploads wait in the IndexedDB offline queue and retry with backoff.
- An action that can be off gets a gate in `domain/`, decided in a hook that hands the component a `GatedAction` (`useSiteGates`, `useSessionGate`); an api call handles failures with `useActionErrors` (decision 20261011-0303). Never show the server's message.
- Letters: render the draft as HTML with a print stylesheet and use the browser's Save as PDF. No server-side PDF library (they mangle Devanagari). Nothing is filed automatically; the resident files.
- Area pages show counts next to every score, the pilot flag, and "not enough reports" below 10 verified reports.
- Neutral design: no party colours, no names of individuals anywhere on screen.
- The on-phone detector in `public/models/` (from S3 `models/edge_int8/` or `models/edge_fp16/`) is an Ultralytics-trained YOLO model and ships under the repo's AGPL-3.0 licence.

## Never

- Commit `.env.local` or any key. The browser never holds AWS credentials; it only uses presigned URLs.
- Show an unblurred image or an original. Only the public blurred copy is ever displayed.
- Invent data, history or scores in the UI. A demo replays real outputs, and the writeup says so.
