---
name: handoff
description: Overwrite your docs/status/<code>.md with your current state before opening a PR, at a checkpoint, or when ending a session, so teammates' agents see what you are doing.
---
# Handoff

1. Get your person code from the `SABOOT_WHO` environment variable (`echo $SABOOT_WHO`, or `$env:SABOOT_WHO` in PowerShell). If it is empty, ask the human.
2. Read `.claude/roster.json` to list the lanes you hold.
3. Overwrite `docs/status/<code>.md`. Never append. Keep it under 30 lines with exactly these sections:

```markdown
# <code> (<name>): status   (overwrite; at most 30 lines)
Updated: <YYYY-MM-DD HH:MM> IST
Lanes held: <lanes>
## Now
<worktree name> → #<issue> <title>, PR #<n> if open
## Done since last update
## Next
## Blocked / needs from others
(name the lane and the person you need)
## Handoff notes
(half-done state, gotchas, exactly where to resume)
## AI tools used
(tool and what it was used for; this feeds the writeup)
```

4. Fill it from this session only. Don't invent progress. Put integration debt (mocks still in place) under Handoff notes with its issue number.
5. If this session made a decision that reaches beyond its task and it isn't in `docs/decisions/` yet, run `/decide` first.
6. Commit only the status file on this branch: `git add docs/status/<code>.md` then `git commit -m "status(<code>): <one line>"`.
7. If the session worked on a GitHub issue, post a 2–3 line summary with `gh issue comment <n>`.
