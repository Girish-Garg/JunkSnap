---
status: accepted
superseded_by:
area: contracts
by: hem
date: 2026-10-10T16:30+05:30
---
# Community notes: residents add notes to sites; Bedrock turns them into neutral, counted signals

Context: residents know things a photo cannot show, such as how long a dump has been there, burning, or a school nearby. Approved by the lead on 10 Oct (issue 101).

Decision:
- `POST /sites/{id}/notes` (signed in, 280 characters, en or hi) answers with `site_note`. The `notes` table stores an author hash, never the user id. Report-note moderation applies: Bedrock only, and a toxic, personal or unchecked note is hidden with no text kept. Limit: 10 per hour per user and device.
- A new `note_analysis` task runs on the Bedrock-only note router, at most once per 10 minutes per site. It reads shown site notes and report notes as untrusted data and writes `site.community`. That holds the signals, an en and hi summary that states how many people it rests on, and provider, model and version. One person's notes count once.
- An unsafe summary is replaced by one built from the signals in code.
- Letters gain `evidence.residents`. The "Residents report" line is written from signals by code and never quotes a note.

Consequences for other lanes: infra adds `junksnap-<stage>-notes` and `NOTES_TABLE`. The frontend shows notes on the site sheet. Writing `site.community` bumps the site version.

Rejected alternatives: notes inside the site item (version conflicts), OpenAI for analysis (personal text), and quoting notes in letters.
