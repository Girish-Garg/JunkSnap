---
status: proposed
superseded_by:
area: process
by: hem
date: 2026-10-10T01:36+05:30
---
# Only the lead session edits status files

Context: parallel PRs that each edit `docs/status/*.md` collide.

Decision: task agents never edit `docs/status/*.md`. The lead session updates `docs/status/hem.md` at checkpoints.

Consequences for other lanes: task agents put their state in the PR body and skip `/handoff`. The `/handoff` skill still writes status files and needs a follow-up change.

Rejected alternatives: each task agent updates its person's status file.
