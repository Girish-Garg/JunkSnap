---
name: handoff
description: Overwrite your docs/status/<code>.md with your current state before opening a PR, at a checkpoint, or when ending a session, so teammates' agents see what you are doing.
---
# Handoff

1. Your person code is `hem`, `gir` or `har`. Work it out from `git config user.email` (coehemang -> hem, garggirish2020 -> gir); if unsure, ask the human.
2. List the areas this session worked on (frontend, pipeline, agent, infra, contracts, docs).
3. Overwrite `docs/status/<code>.md`. Never append. Keep it under 30 lines with exactly these sections:

```markdown
# <code> (<name>): status   (overwrite; at most 30 lines)
Updated: <YYYY-MM-DD HH:MM> IST
Areas: <areas worked on>
## Now
<branch name> → #<issue> <title>, PR #<n> if open
## Done since last update
## Next
## Blocked / needs from others
(name the area and the person you need)
## Handoff notes
(half-done state, gotchas, exactly where to resume)
## AI tools used
(tool and what it was used for; this feeds the writeup)
```

4. Fill it from this session only. Don't invent progress. Put integration debt (mocks still in place) under Handoff notes with its issue number.
5. If this session made a decision that reaches beyond its task and it isn't in `docs/decisions/` yet, run `/decide` first.
6. Commit only the status file on this branch: `git add docs/status/<code>.md` then `git commit -m "status(<code>): <one line>"`.
7. If the session worked on a GitHub issue, post a 2–3 line summary with `gh issue comment <n>`.
