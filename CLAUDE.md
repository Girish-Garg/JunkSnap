@AGENTS.md

## Claude Code only

- Run /handoff before you end a session. Record cross-task decisions with /decide.
- Use the reviewer subagent on your diff before opening a PR.
- Parallel work: give every writing agent its own worktree and branch (`isolation: worktree`, or `claude -w <task>`). Never let two agents edit the same files.
