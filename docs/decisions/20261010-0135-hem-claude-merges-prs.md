---
status: proposed
superseded_by:
area: process
by: hem
date: 2026-10-10T01:35+05:30
---
# Claude merges PRs after green CI and a SHIP verdict

Context: AGENTS.md and the handover said only the human merges PRs.

Decision: Claude merges a PR once CI is green and the reviewer's verdict is SHIP. It squash-merges through the GitHub API. The commit message ends in exactly one co-author line, alternating `Co-authored-by: Hemang <coehemang@gmail.com>` and `Co-authored-by: Girish Garg <garggirish2020@gmail.com>`. This supersedes the "the human merges" rule for this event.

Consequences for other lanes: AGENTS.md (Git, Never) and handover sections 2 and 6 change. Never push to `main` and never force-push still hold.

Rejected alternatives: the human merges every PR.
