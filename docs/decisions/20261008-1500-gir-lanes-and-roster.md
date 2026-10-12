---
status: superseded
superseded_by: 20261010-0031-gir-drop-lane-guard.md
area: process
by: gir
date: 2026-10-08T15:00+05:30
---
# Lanes own folders; .claude/roster.json says who holds each lane

Context: three people each run several coding agents. Two people's agents writing the same folder is the main source of conflicts, and the team may drop to two people.

Decision: five lanes (fe, data, agent, infra, contract) plus lead for root files. Holders: Harshit fe; Girish data and infra; Hemang agent; contract is shared through contract-only PRs. Lead is the infra holder Thu–Fri (Girish) and the fe holder Sat–Sun (Harshit). Worktrees are named `<lane>-<issue>-<slug>`, and the scope guard checks the lane holder in the roster. Dropping to two people changes only the roster (see docs/Parallel coding agents team workflow.md).

Consequences for other lanes: nobody's agents write outside their lane; cross-lane needs go through issues or PR comments.

Rejected alternatives: per-person directory ownership (breaks when someone is absent); a shared DECISIONS.md (every branch appends to the same file).
