@AGENTS.md

## Claude Code only

- Run /handoff before you end a session. Record cross-task decisions with /decide.
- Use the reviewer subagent on your diff before opening a PR.
- Subagents are for reading only (research, review). The scope guard blocks writes from subagent worktrees, because their auto-generated names don't start with a lane.
