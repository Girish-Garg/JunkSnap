# Decisions

One decision per file, so parallel branches never edit the same file.

- Name: `YYYYMMDD-HHMM-<code>-<slug>.md`, IST time, person code (`gir`, `hem`, `har`), a 3–5 word slug.
- Shape: copy `_template.md`, keep it under about 25 lines.
- Status: `accepted` binds every agent, `proposed` is context only, `superseded` is history.
- Never edit someone else's decision, except to set `status: superseded` and `superseded_by:` when you replace it.
- In Claude Code, `/decide` writes these for you. The session brief lists the 10 newest.
