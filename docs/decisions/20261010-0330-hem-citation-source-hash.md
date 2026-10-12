---
status: accepted
superseded_by:
area: contracts
by: hem
date: 2026-10-10T03:30+05:30
---
# A letter citation's `source_sha256` is the SHA-256 of the official PDF

Context: `letter_draft.citations[].source_sha256` says "SHA-256 of the official text the quote was checked against". `data/rules/rules.json` holds two hashes for each text: `source_sha256` for the downloaded official PDF, and `text_sha256` for our stored page extract. The quote verifier reads the extract.

Decision:
- A citation carries the rule's `source_sha256`, the hash of the official PDF. Anyone can download that PDF from the rule's `source_url` and check the hash.
- `text_sha256` stays in `rules.json`. The api checks it at startup and refuses to start when a stored extract differs. It never appears in a letter.
- At startup the api also checks each rule's `document` and `source_sha256` against its text entry.

Consequences for other lanes: the frontend's citation cards show the PDF hash and link to `source_url`. A new or updated text needs both hashes in `rules.json`, and `scripts/check_rules.py` must stay green.

Rejected alternatives: the extract's `text_sha256` in letters, which no reader can check against anything public.
