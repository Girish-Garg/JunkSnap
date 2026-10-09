---
status: proposed
superseded_by:
area: process
by: hem
date: 2026-10-10T01:36+05:30
---
# Only the lead session runs /handoff and commits status files

Context: parallel PRs that each edit `docs/status/*.md` collide.

Decision: task agents skip `/handoff` and never commit `docs/status/*.md`. The lead session runs `/handoff` at checkpoints, which updates `docs/status/hem.md`.

Consequences for other lanes: task agents put their state in the PR body. CLAUDE.md's "Run /handoff before you end a session" still holds for the lead session; a task agent ends with its PR instead.

Rejected alternatives: each task agent updates its person's status file.
