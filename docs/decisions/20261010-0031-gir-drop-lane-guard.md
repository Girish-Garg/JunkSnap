---
status: accepted
superseded_by:
area: process
by: gir
date: 2026-10-10T00:31+05:30
---
# Drop the lane guard, roster and SABOOT_WHO; one person drives the build

Context: the scope guard needed SABOOT_WHO on every machine and blocked work; the team chose one driver with parallel agents.

Decision: remove the PreToolUse scope guard, .claude/roster.json and all SABOOT_WHO steps. Keep the session brief, permission rules, CI and PR review. Every writing agent gets its own branch and worktree. Commit trailers rotate between Hemang and Girish, never an AI trailer; the writeup still lists every AI tool.

Consequences: folder ownership is guidance in AGENTS.md, not enforced. Supersedes 20261008-1500-gir-lanes-and-roster.md.

Rejected alternatives: keep the guard with per-person roster; launch sessions with SABOOT_GUARD=off.
