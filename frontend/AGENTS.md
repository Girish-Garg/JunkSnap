# Lane `fe`: frontend and video

Holder: see `.claude/roster.json`. The holder adds conventions here as the lane learns them. Keep it under about 60 lines.

- Stack: Vite + React + MapLibre GL. Load Noto Sans Devanagari for Hindi text.
- Data mode: `VITE_API_MODE=mock` reads `contracts/fixtures/`; `live` calls `VITE_API_URL`. Keep mock mode working all week.
- One file per map layer under `src/layers/`, discovered with `import.meta.glob`, so adding a layer adds a file instead of editing a shared list.
- Complaint PDF: render the draft as HTML with a print stylesheet and use the browser's Save as PDF. Don't use a server-side PDF library (they mangle Devanagari).
- Wording on screen: "thermal anomalies recorded near this location", "candidate sites". Credit "Contains modified Copernicus Sentinel data [year]".
- Demo mode (`?demo=1`) replays real outputs the system produced, and the writeup says so.
- Dev ports: Hemang 5173–5176, Girish 5180–5183, Harshit 5190–5193.
