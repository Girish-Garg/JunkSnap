---
name: decide
description: Record a team decision that reaches beyond the current task (an interface, a library, a naming rule, a scope cut, an AWS resource) as a new file in docs/decisions/.
---
# Decide

1. List `docs/decisions/` and read any decision on the same topic. If an accepted one exists and this replaces it, tell the human. The only change allowed to the old file is `status: superseded` plus `superseded_by: <new filename>`.
2. Get your person code from `SABOOT_WHO` (`echo $SABOOT_WHO`, or `$env:SABOOT_WHO` in PowerShell). Get the IST time with `date`.
3. Create `docs/decisions/YYYYMMDD-HHMM-<code>-<slug>.md`, with a 3–5 word kebab-case slug, using the shape of `docs/decisions/_template.md`. Keep it under about 25 lines. Write the title as the decision itself, e.g. "Draft endpoint is async: POST /draft returns case_id, client polls".
4. Set `status: proposed` unless the human says in this session that it is agreed; then `accepted`. A decision that changes `contracts/` also needs a contract-only PR approved by every affected lane holder.
5. Fill "Consequences for other lanes" honestly. If any other lane is affected, tell the human to post the decision in team chat now.
6. Commit only the decision file (plus the superseded file's status line, if any): `git commit -m "decision: <title>"`.
