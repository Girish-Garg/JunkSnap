# Split the writes, share the memory

Run Saboot as four single-writer lanes (frontend, data, agent, infra) joined by written contracts, and use git as the only shared memory. A roster file says who holds each lane, so the same setup runs with three people or with two. No 2026 tool carries chat history or agent memory across three laptops: Claude Code's auto memory is machine-local, Projects belong to one user, and agent-team task lists live on one machine. "One agent that remembers everything" therefore has to be rebuilt from files that every session reads when it starts. Those files are a canonical `AGENTS.md` that `CLAUDE.md` imports, frozen contracts with example fixtures, one file per decision, a short status file per person, GitHub Issues as the task board, and a SessionStart hook that briefs every new or compacted session. Speed comes from each person running three Claude Code sessions, at most two of which write, each in its own git worktree and branch. All sessions build against mocks made from the contract fixtures, so nobody waits on anyone else. Conflicts are prevented rather than resolved. Each directory belongs to one lane, and each lane has one holder at a time. Contracts merge before features. Every task is one small PR into a protected `main` that merges only on green CI. Hooks and permission rules keep agents inside their lane and away from `main`. Each person deploys to a personal AWS stage, and only the infra-lane holder deploys the shared `demo` stage. The very first step is a commit and push today: `claude --worktree` fails in a repo with no commits, and the event requires repo history inside 8–11 October. Budget about two hours of setup before anyone runs parallel agents. The evidence below shows that skipping it costs merge conflicts and contradictory decisions, which a 3.5-day build cannot absorb.

Reading guide: statements with a citation are verified against documentation or primary sources fetched on 8 October 2026, unless marked "secondary". Statements marked *Judgment* are recommendations from this synthesis. A list of what must be tested on Windows comes near the end.

## No agent memory crosses laptops, so git must carry it

Goal (1), a single agent that holds the whole history, does not exist across three machines, and no current feature provides it. Claude Code's auto memory stays on the machine that wrote it and is never shared with other machines or cloud sessions ([Claude Code memory](https://code.claude.com/docs/en/memory)). A Project belongs to a single user and cannot be shared ([Claude Code Projects](https://code.claude.com/docs/en/claude-projects)). Agent-team mailboxes and task lists are JSON files under `~/.claude/` on the lead's machine ([Agent teams](https://code.claude.com/docs/en/agent-teams)). Cross-session messaging reaches only your own sessions ([Cross-session messaging](https://code.claude.com/docs/en/cross-session-messaging)). Session transcripts are local files in an internal format that changes from version to version ([Sessions](https://code.claude.com/docs/en/sessions)). **The only layers all three of you share are the git repo and GitHub.** Coherence has to be rebuilt at the start of every session from files in the repo, and it stays consistent only if no two sessions write the same thing.

The failure this guards against is well documented. Cognition's 2025 essay warned that every agent action embeds unstated decisions, and that agents making conflicting ones produce broken results. Its example was two subagents that built mismatched halves of a Flappy Bird clone ([Cognition 2025](https://cognition.com/blog/dont-build-multi-agents)). The April 2026 follow-up names what works instead: multi-agent setups succeed when **"writes stay single-threaded"** and the extra agents contribute intelligence (review, research, planning) rather than parallel edits ([Cognition 2026](https://cognition.com/blog/multi-agents-working)). Anthropic's 16-agent C compiler project shows both sides. Independent tasks claimed through lock files worked. On one giant shared task, the agents overwrote each other's fixes, and CI had to be added because new features kept breaking old ones ([Anthropic, C compiler](https://www.anthropic.com/engineering/building-c-compiler)). For Saboot this becomes three rules: one writer per lane, any number of read-only helpers, and written contracts in place of implicit decisions.

Anthropic's harness for long-running agents supplies the memory mechanics. An initializer writes a progress file and a JSON feature list. Every session begins with a ritual that reads git history and the progress file before coding, and it ends with one feature finished and the code left clean. The harness uses JSON because Anthropic found the model less likely to wrongly rewrite or overwrite a JSON file than a Markdown one ([Anthropic harness](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)). That harness serves one agent across many sessions. For three people, each shared file splits into per-person or per-decision files, so no two writers ever touch the same one.

Treat speed claims with the same skepticism. In METR's 2025 trial, experienced developers were **19% slower** with AI tools while believing they were about 20% faster ([METR 2025](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/)). The 2026 follow-up estimates about 18% faster for returning developers but describes its own data as very weak evidence ([METR 2026](https://metr.org/blog/2026-02-24-uplift-update/)). DORA's 2025 report finds AI raises throughput while going hand in hand with rising instability, and it lists small batches among the capabilities that make AI pay off ([DORA 2025](https://dora.dev/insights/dora-2025-year-in-review/); [DORA capabilities model](https://dora.dev/research/2025/ai-capabilities-model)). Measure progress by never-cut features passing on the deployed URL, not by how many agents are running.

## Four lanes, one holder each, assigned by a roster

| Lane | Worktree prefix | Directories its agents may write | AWS powers | Holder (three people) | Also owns |
|---|---|---|---|---|---|
| Frontend and video | `fe` | `frontend/`, `amplify.yml` | Amplify app | Harshit | Video, screenshots |
| Geo and data | `data` | `data/`, `backend/firms/` | Data prefixes in S3; promoting data to `demo/` | Girish | GeoJSON, timeline and S3-layout schemas in `contracts/` |
| Agent and legal corpus | `agent` | `backend/agent/`, including the gazette, the rules JSON and the verifier | Bedrock access, the Knowledge Base, every ingestion job | Hemang | API and DynamoDB schemas in `contracts/` |
| AWS and infra | `infra` | `infra/` | Account, IAM, budget, every `demo` deploy | Girish | Stage and resource naming in `contracts/README.md` |
| Contracts | `contract` | `contracts/` | None | The holder who owns the schema, in contract-only PRs | Approval from every affected holder |
| Shared root | `lead` | `AGENTS.md`, `CLAUDE.md`, `.claude/`, `.github/`, `.gitattributes`, `.gitignore`, `.worktreeinclude`, `docs/features.json`, `scripts/` | None | Integration lead: infra holder Thu–Fri (Girish), frontend holder Sat–Sun (Harshit) | `main`'s health, checkpoints, smoke test |

The lanes come from the build plan in `docs/Saboot hackathon idea evaluation.md`, with two changes the team asked for: Harshit takes the frontend and the video, and the old "agent, legal corpus and AWS" role is split between Hemang (agent and corpus) and Girish (AWS and infra). *Judgment:* the split falls there because the corpus and the agent are tested together through the verifier, while `infra/` deploys both Lambdas, including Girish's FIRMS Lambda. Holders can change at any time through the roster below, but each lane has exactly one holder. A holder's agents write only inside that lane's directories. Anyone else who needs a change there opens an issue or comments on the PR. *Judgment:* the two Python Lambdas live in separate folders with no shared `backend/common/` package. Each lane validates against `contracts/` instead of importing another lane's code, because a shared helper module is the classic file two parallel agents both create or edit.

*Judgment:* the integration lead is the infra holder on Thursday and Friday (Girish) and the frontend holder from Saturday (Harshit). The lead's checkpoint work (CI, root files, the smoke test after each `demo` deploy) sits next to the infra holder's `demo` deploys, and the repo lives on Girish's laptop, so Girish bootstraps it. From the Saturday freeze on, the final demo runs and the video all go through the frontend. The agent holder stays off the role because the agent carries the riskiest path in the build plan: the Bedrock go/no-go test, the Knowledge Base and the drafting. The role takes about 45 minutes a day: merge order at checkpoints, root files, the feature checklist and the smoke test.

The roster lives in `.claude/roster.json`, the only place that maps people to lanes. The scope guard, the SessionStart brief and the humans all read it, and only the lead changes it, in a small PR.

```json
{
  "people": { "gir": "Girish", "hem": "Hemang", "har": "Harshit" },
  "lanes": {
    "fe":       { "holder": "har", "write": ["frontend/**", "amplify.yml"] },
    "data":     { "holder": "gir", "write": ["data/**", "backend/firms/**"] },
    "agent":    { "holder": "hem", "write": ["backend/agent/**"] },
    "infra":    { "holder": "gir", "write": ["infra/**"] },
    "contract": { "holder": "*",   "write": ["contracts/**"] },
    "lead":     { "holder": "gir", "write": ["AGENTS.md", "CLAUDE.md", ".claude/**", ".github/**", ".gitattributes",
                                             ".gitignore", ".worktreeinclude", "docs/features.json", "scripts/**"] }
  },
  "always": ["docs/decisions/**"]
}
```

Each laptop sets `SABOOT_WHO` to its person code (`gir`, `hem` or `har`). On Saturday the lead changes the `lead` holder to `har`. Girish holds two lanes, so Girish's two writing sessions can run one in `data` and one in `infra` at the same time.

## Three sessions per person, and only two of them write

| Session | Job | Where it runs | Writes? | Model (*Judgment*) |
|---|---|---|---|---|
| 1. Lane writer | One issue at a time inside your lane. The only session that needs your steady attention | Its own worktree: `claude -w <lane>-<issue>-<slug>` | Yes | Opus |
| 2. Reader and reviewer | Research, "how does X work" questions, scout runs whose code is thrown away, fresh-context review of session 1's diff before the PR | Main checkout in plan mode (read-only), or a scratch worktree for scouts | No | Sonnet |
| 3. Chore writer (optional) | Small, fully specified work on files session 1 is not touching: tests, fixtures, styling, seed scripts, README sections | Its own worktree | Yes, disjoint files | Sonnet |

That caps the team at **nine sessions, six writers, and three that need attention at once** (six sessions and four writers with two people). One rule sits above the cap: a lane's writing sessions all belong to its holder, so two people's agents never write in the same lane. Someone who holds two lanes uses session 3 as the writer for the second lane instead of for chores. *Judgment:* start session 3 only when session 1's PR is not waiting on you. The research notes ranged from two to four agents per person. This plan picks three because every practitioner caps what they review, not what they start. Simon Willison names his own review speed as the bottleneck, and he lands one significant change at a time ([Willison](https://simonwillison.net/2025/Oct/5/parallel-coding-agents/)). Mitchell Hashimoto turns off agent notifications because switching context costs him so much ([Hashimoto](https://mitchellh.com/writing/my-ai-adoption-journey)). Claude Code's own guidance is that three focused teammates often beat five scattered ones ([Agent teams](https://code.claude.com/docs/en/agent-teams)). Higher counts exist: incident.io engineers run four or five agents each, each in its own worktree ([incident.io](https://incident.io/blog/shipping-faster-with-claude-code-and-git-worktrees)), and Claude Code's creator reportedly runs about five local plus five to ten remote sessions while abandoning 10–20% of the remote ones ([InfoQ, secondary](https://www.infoq.com/news/2026/01/claude-code-creator-workflow/)). Those people work in mature codebases they know. Saboot is a new codebase whose four lanes meet at contracts that are hours old.

Quota sets a second ceiling: background sessions draw on your plan just as interactive ones do, so ten parallel agents burn quota about ten times as fast as one ([Agent view](https://code.claude.com/docs/en/agent-view)). *Judgment:* anyone on a Pro plan should run only sessions 1 and 2, with session 2 on Sonnet. Check each person's plan today.

Skip four things. **Agent teams** are experimental and off by default, do not isolate teammates in worktrees, and use roughly 7x the tokens in plan mode. Their split-pane mode is not supported in Windows Terminal or the VS Code terminal ([Run agents in parallel](https://code.claude.com/docs/en/agents); [Agent teams](https://code.claude.com/docs/en/agent-teams); [Manage costs](https://code.claude.com/docs/en/costs)). **Projects** are single-user and in beta. **Third-party orchestrators** add install risk for little gain: Conductor is macOS-only, claude-squad needs tmux, Vibe Kanban is sunsetting and Crystal is deprecated ([Conductor](https://www.conductor.build/); [claude-squad](https://github.com/smtg-ai/claude-squad); [Vibe Kanban](https://www.vibekanban.com/); [Crystal](https://github.com/stravu/crystal)). **Writing subagents without `isolation: worktree`** share the session's checkout. Read-only subagents for research are fine, because they return condensed summaries.

Kiro, Cursor and Codex all read `AGENTS.md` ([Kiro steering](https://kiro.dev/docs/steering/); [Cursor rules](https://cursor.com/docs/context/rules); [Codex AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md)). Any of them can therefore fill one of a person's three slots under the same worktree, branch and PR rules. They do not run Claude Code's hooks, so `AGENTS.md` tells them to read the status files and recent decisions by hand, and CI is their only guardrail. *Judgment:* their best use is as a fresh-context reviewer, or (for Kiro, the sponsor's IDE) for a one-off spec pass. Don't use them as a second concurrent writer in the same lane. A July 2026 study of 33,596 agent PRs found that overlapping PRs from different vendors conflicted in **41.7%** of replayed merges, against 19.8% for pairs from the same agent ([arXiv 2607.04697, figures secondary](https://arxiv.org/abs/2607.04697)). Kiro's usage is metered in credits, with 50 free per month at third-party-reported prices ([Morph, secondary](https://www.morphllm.com/kiro-pricing)). List every tool you use in the writeup; the event requires it.

## Seven kinds of files rebuild one agent's memory

| Path | What it holds | Who writes it | When | Size cap |
|---|---|---|---|---|
| `AGENTS.md` | The canonical rules. Product summary and never-cut path, the event and product rules (moved word for word from today's `CLAUDE.md` and kept at the top), lanes and owners, commands, session protocol, stop-and-ask list, pointers to long docs | Integration lead, via PR | Kickoff; then only after a repeated agent mistake | ~120 lines |
| `CLAUDE.md` | Line 1 is `@AGENTS.md`, followed by at most 10 Claude-only lines | Integration lead | Rarely | 10 lines |
| `frontend/AGENTS.md`, `data/AGENTS.md`, `backend/AGENTS.md`, each with a one-line `CLAUDE.md` containing `@AGENTS.md` | Lane conventions: libraries, file layout, test commands | Lane owner | As the lane learns | ~60 lines |
| `contracts/README.md`, `contracts/schemas/*.schema.json`, `contracts/fixtures/*.json` | The interfaces between lanes (see the next section) | Contract owners, contract-only PRs | First 90 minutes; rare after | n/a |
| `docs/decisions/YYYYMMDD-HHMM-<who>-<slug>.md` | One decision per file, with a `status` field | Any agent through `/decide`, approved by a human in the PR | Whenever a choice reaches beyond the current task | ~25 lines |
| `docs/status/hem.md`, `gir.md`, `har.md`, named by person code | Now, Done, Next, Blocked, Handoff notes, AI tools used. Overwritten, never appended | Only the owner's lane-writer session, through `/handoff` | Before every PR and at each checkpoint | ~30 lines |
| GitHub Issues | The task board. Each issue is a mini spec, the assignee field is the claim, and `Closes #n` records completion | Humans create issues; agents comment | Continuously | n/a |
| `docs/features.json` | The 10–15 never-cut features, each as `{id, issue, lane, demo_step, passes}`; only `passes` ever changes | Integration lead only | At checkpoints, after an end-to-end check on the deployed URL | n/a |
| `.claude/settings.json`, `.claude/hooks/brief.py`, `.claude/hooks/scope_guard.py`, `.claude/roster.json`, `.claude/skills/handoff/SKILL.md`, `.claude/skills/decide/SKILL.md`, `.claude/agents/reviewer.md` | The machinery that loads and writes the files above | Integration lead | Day 1 | n/a |

**Pick one file per decision, not a shared `DECISIONS.md`.** The notes split evenly on this. One file per decision wins because up to six writing sessions on separate branches would all append to the end of the same file, and every rebase would conflict there. The usual patch, `merge=union`, is unreliable: GitHub's web merge did not honor it in a 2016 report, and union merges misplace entries when a file's structure changes ([RuboCop PR 3594](https://github.com/rubocop-hq/rubocop/pull/3594); [quantify-scheduler issue 406](https://gitlab.com/quantify-os/quantify-scheduler/-/issues/406)). New files with unique timestamp-and-initials names cannot conflict, the same idea as the hash-derived IDs the Beads tracker uses to avoid merge collisions across agents and branches ([Morph on Beads](https://www.morphllm.com/beads-agent-memory)). The cost is losing a single chronological read. The SessionStart brief restores it by listing the newest decision titles, and the timestamp prefix sorts the folder. Give each file a status, following Duncan Davidson's rule for agents: accepted records bind, proposed ones are context only, and superseded ones are history ([Davidson](https://duncandavidson.com/agents-love-decisions)). Never edit someone else's decision file, except to set `status: superseded` and point to its replacement.

```markdown
---
status: accepted          # proposed | accepted | superseded
superseded_by:            # filename of the replacement, if any
area: contracts           # frontend | data | agent | infra | contracts | process
by: har
date: 2026-10-08T15:10+05:30
---
# (example) Draft endpoint is async: POST /draft returns case_id, client polls GET /cases/{id}
Context: (2-4 lines)
Decision:
Consequences for other lanes:
Rejected alternatives:
```

```markdown
# gir (Girish): status   (overwrite; at most 30 lines)
Updated: 2026-10-09 13:05 IST
Lanes held: data, infra
## Now          data-14-firms → #14 FIRMS Lambda, PR #31 open
## Done since last update
## Next
## Blocked / needs from others
## Handoff notes (half-done state, gotchas)
## AI tools used (for the writeup)
```

`AGENTS.md` carries the session protocol that turns these files into memory. Keep it to about 120 lines. Claude Code's docs recommend keeping each `CLAUDE.md` under 200 lines because longer files lower adherence, and imports do not reduce context cost ([Claude Code memory](https://code.claude.com/docs/en/memory)). HumanLayer puts reliable instruction-following at about 150–200 instructions for frontier models, and adherence drops across all instructions as the count rises ([HumanLayer](https://www.humanlayer.dev/blog/writing-a-good-claude-md)). The product rules (cite only retrieved documents, never name a person, say "thermal anomalies" and "candidates", file nothing automatically) must stay in the root file. On compaction, Claude Code re-injects the root `CLAUDE.md` but summarizes away nested `CLAUDE.md` files and path-scoped rules ([Context window](https://code.claude.com/docs/en/context-window)).

```markdown
# Saboot: rules for every agent and every tool
<one paragraph: product + never-cut path: pin → dated timeline → fire anomalies → cited Hindi draft with verifier → hashed photo, three seed sites>
## Event rules          (moved verbatim from the old CLAUDE.md)
## Product rules        (moved verbatim)
## Lanes (holders: .claude/roster.json, printed in the brief)
fe: frontend/ · data: data/, backend/firms/ · agent: backend/agent/ · infra: infra/ · contract: contracts/ · lead: root files
Your worktree name starts with your lane. Write only inside it. For another lane, open an issue or comment on the PR.
## Session protocol
Start: read the SessionStart brief (other tools: read .claude/roster.json, docs/status/*.md and the 10 newest docs/decisions/ files),
then `gh issue view <n>`, then contracts/README.md if you touch an API, table, S3 key or GeoJSON.
One issue per session. End with /handoff. Team decisions go to docs/decisions/ via /decide, never to auto memory.
Accepted decisions are binding; proposed are context; superseded are history. On conflict with an accepted one: stop and ask.
## Stop and ask before you
change contracts/ · add a dependency or AWS resource · delete or skip a test · change a table key, S3 layout or schema ·
try a third approach after two failures · touch another lane
## Never
push to main · force-push · merge a PR · deploy or write to the demo stage · start a KB ingestion job · commit secrets · use --no-verify
## Commands (PowerShell and bash)
frontend: cd frontend; npm ci; npm run dev -- --port <yours>; npm run lint; npm test -- --run; npm run build
python lanes: cd <lane>; uv sync; uv run ruff check .; uv run pytest -q
contracts: uv run python scripts/validate_contracts.py
## Read only when needed
docs/Saboot hackathon idea evaluation.md (build plan, gates, cut list, video script) · docs/research/*.md
```

`CLAUDE.md` imports `AGENTS.md` instead of being a symlink to it. The Claude Code docs tell teams with any Windows user to use the `@AGENTS.md` import rather than a symlink, because creating a symlink needs Administrator rights or Developer Mode, and Git can check a committed symlink out as a one-line text file ([Claude Code memory](https://code.claude.com/docs/en/memory)). The same import is used for the lane files. That keeps one text readable by every tool without relying on how each tool loads nested `AGENTS.md` files.

**The SessionStart brief is the "I know what's going on" moment of a single long-running agent, replayed at every start.** A SessionStart hook with matchers `startup|resume|clear|compact` adds its output to Claude's context before the first prompt, and it runs again after compaction. Its output is capped at 10,000 characters; anything longer is replaced by a file path and a 2,000-character preview ([Hooks](https://code.claude.com/docs/en/hooks)). *Judgment:* `brief.py` should print at most about 6,000 characters, built as follows:

1. Run `git fetch origin` with a 5-second timeout.
2. Print the current branch and the first 15 lines of `git status -s`.
3. Print `git log --oneline -15 origin/main`.
4. Print the roster from `origin/main` (lane → holder), then the Now, Next and Blocked sections of each rostered person's status file, read with `git show origin/main:docs/status/<code>.md`. Each session then sees who holds what and teammates' latest merged state, even when its own branch is older.
5. List the titles and statuses of the 10 newest decision files on `origin/main`.
6. Print the last commit that touched `contracts/`.
7. Run `gh issue list --assignee @me --state open` with a 3-second timeout, and skip it if `gh` fails.

Use auto memory and `CLAUDE.local.md` only for personal preferences. Auto memory's "project" type is built to store decisions, but it stays on one machine, so three people would end up with three private, diverging records of team decisions. The `AGENTS.md` rule above sends all team decisions to `docs/decisions/` instead. `CLAUDE.local.md` exists only in the worktree where it was created ([Claude Code memory](https://code.claude.com/docs/en/memory)), so put personal preferences in `~/.claude/CLAUDE.md`. Skip MCP shared-memory servers. They add a hosted dependency and a second source of truth, and they spread one person's mistaken note to everyone.

## Contracts and fixtures merge before any feature branch

Contracts are the defense against the Flappy Bird failure, where two halves are built on different assumptions. Write them in the first 90 minutes, with all three people on a call and one driver session, and merge them as PR #1 before any lane starts feature work.

| File | Owner | Contents |
|---|---|---|
| `contracts/README.md` | Agent and infra holders (Hemang, Girish) | Routes and methods; env var names (`VITE_API_URL`, `VITE_API_MODE`, `KB_ID`, `SABOOT_STAGE`); stage naming; DynamoDB tables and keys; S3 key layout; the shared wording ("thermal anomaly recorded near this location", "candidate") |
| `contracts/schemas/draft_request`, `draft_response` (citations carry source URI, page and hash), `case_item` | Agent holder (Hemang) | Agent API and DynamoDB item shapes |
| `contracts/schemas/site` (GeoJSON feature properties), `timeline`, `firms` | Data holder (Girish) | Data products the frontend renders |
| `contracts/fixtures/<schema>.<seed-site>.json` | Same owner as the schema | One valid example per schema for each of the three seed sites |

*Judgment:* use JSON Schema plus fixtures, not OpenAPI with code generation. CI can validate every fixture against its schema with Python's `jsonschema`, and the same fixtures serve as mocks. The OpenAPI and type-generation tools named in the notes were not verified for Windows or for October 2026 versions. The chain still catches drift. The frontend's hand-written TypeScript types are type-checked against the fixtures in a test, CI checks the fixtures against the schemas, and each Lambda's tests validate its real output against the same schemas.

Mocks let all three lanes start in hour one. The frontend reads fixtures behind `VITE_API_MODE=mock|live`. The agent Lambda's tests feed it fixture inputs with Bedrock stubbed. The data scripts validate their outputs against the schemas before uploading anything. Every mock left standing gets an `integration-debt` issue with an owner. One hackathon post-mortem describes exactly this trap: subagents met their acceptance criteria literally and never wired the data through the user experience ([Muxin Li post-mortem](https://humaninference.substack.com/p/why-i-didnt-win-the-opus-47-hackathon)).

To change a contract, write a decision file and open a `contract-` worktree for a PR that touches only `contracts/`. Both affected owners approve it, it merges before any PR that depends on it, and you announce it in team chat at once. Dependent branches then run `git merge origin/main`. Seed the decision log at kickoff with the five to eight calls the build plan already raises:

- Function URL with a 120-second timeout, or submit-and-poll, for the agent.
- Which Bedrock profile passed the smoke test.
- The Knowledge Base on S3 Vectors.
- SAM or CDK.
- The S3 key layout.
- The Python version and `uv`.
- The mock flag.
- Squash merges.

## One task, one worktree, one branch, one small PR

| Rule | Detail |
|---|---|
| `main` | Protected: PR required, required checks, no force-push, squash merges only, head branches deleted after merge. Amplify builds from it |
| Writing sessions | Always in a worktree. `claude -w fe-12-legend` creates `.claude/worktrees/fe-12-legend` on branch `worktree-fe-12-legend` ([Worktrees](https://code.claude.com/docs/en/worktrees)). The lane prefix (`fe`, `data`, `agent`, `infra`, `contract`, `lead`) drives the scope guard |
| Main checkout | Stays on `main` and clean. Use it only to pull, to launch worktrees, and for read-only plan-mode sessions |
| Base | The default `worktree.baseRef` of `"fresh"` branches from `origin/HEAD` (normally `origin/main`), not local `main` ([Worktrees](https://code.claude.com/docs/en/worktrees)). Push merged work promptly; use `"head"` only for subagents extending your own unpushed branch |
| Size and lifetime | One issue, one lane, under ~400 changed lines, under ~4–6 hours (*Judgment*, well inside the two-day ceiling for short-lived branches from [trunkbaseddevelopment.com](https://trunkbaseddevelopment.com/short-lived-feature-branches/)) |
| Sync | Before the first push: `git fetch` then `git rebase origin/main`. After pushing: `git merge origin/main`, never a force-push. Also sync whenever `contracts/` or your lockfile changes on `main` |
| Merging | The person who launched the agent merges their own PR after CI is green. Agents never merge. Cross-lane and contract PRs also need the other owner's approval |
| Cleanup | Choose "remove" on exit (this deletes the worktree and its branch), or run `git worktree remove`; run `git worktree prune` daily |
| Dev servers | One Vite port range per person: Hemang 5173–5176, Girish 5180–5183, Harshit 5190–5193 (*Judgment*; incident.io reports parallel sessions straining ports and local services) |

Each worktree is a fresh checkout. Run `npm ci` or `uv sync` in it once, and let `.worktreeinclude` copy gitignored `.env` files in ([Worktrees](https://code.claude.com/docs/en/worktrees)). Run linters and tests from inside a lane folder, never from the root of the main checkout, or they will also scan everything under `.claude/worktrees/` (general tool behavior, not verified in the notes).

| Hotspot | Rule |
|---|---|
| `frontend/package-lock.json`, each lane's `uv.lock` | One lock per lane, no root lockfile. On conflict, fix the manifest by hand and regenerate (`npm install --package-lock-only`, `uv lock`); never hand-merge a lockfile ([TkDodo](https://tkdodo.eu/blog/solving-conflicts-in-package-lock-json)) |
| `contracts/**` | Contract-only PRs, merged first |
| Root files and `.claude/**`, `.github/**` | Integration lead only, in small PRs |
| `docs/decisions/*` | New files only |
| `docs/status/<code>.md` | Owner only. On conflict, rerun `/handoff` instead of merging by hand |
| Map layers and routes | One file per layer under `frontend/src/layers/`, discovered through `import.meta.glob`, so adding a layer adds a file instead of editing a shared list (*Judgment*) |
| Line endings | `.gitattributes` goes in the first commit |

The July 2026 merge-conflict study found that **84.4% of conflicted files were source code**, while only 3.9% were manifests or lockfiles. About 42% of conflicts were structural: one side deleted what the other modified, or both added the same file ([arXiv 2607.04697, figures secondary](https://arxiv.org/abs/2607.04697)). The practical rule is that one person scaffolds every shared folder and file in the first commit, so agents never both create the same module. When conflicts do happen, agents may resolve mechanical ones: lockfiles by regeneration, imports and formatting, two independent additions, their own status file, and conflicts where both sides are in their own lane. They must stop and hand to the owner anything touching contracts, a function signature or data shape used across lanes, `infra/`, IAM or CORS, DynamoDB keys, the S3 layout, or the same logic changed on both sides. Semantic conflicts can still compile. The PR description lists each conflicted file and which side was kept. Then the agent reruns the checks, and a human reads the resolution diff.

Host the repo publicly under a free GitHub organization. Branch protection and rulesets are not enforced on private repos on GitHub Free, though sources conflict somewhat ([SSW](https://www.ssw.com.au/rules/which-github-plan)), and the submission requires a public repo anyway. Check the event rules and confirm in the repo settings that protection is enforced. If you keep the repo private, the hooks, the permission rules and team discipline are the only protection. *Judgment:* skip the merge queue. It requires every workflow to trigger on `merge_group` ([GitHub Docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/managing-a-merge-queue)), and three people merging at checkpoints don't need it. Use required checks with "require branches to be up to date" instead. Turn that setting off if PRs start piling up behind each other.

The event requires commits from every member, so authorship matters. Each person's `user.name` and `user.email` must match their GitHub account, and each person opens and squash-merges their own agents' PRs from their own account. The repo machine is currently configured as Girish Garg, so anyone else typing there commits as Girish. Never backdate or import commits made before kickoff.

## Four guardrail layers keep agents in their lane

| Layer | Mechanism | What it stops | Strength |
|---|---|---|---|
| Permissions | Committed `.claude/settings.json` allow and deny rules | Pushes to `main`, force-pushes, merges, `demo` deploys, KB ingestion, `--no-verify` | Hard for commands that match; each pattern must be tested |
| Hooks | SessionStart brief; PreToolUse scope guard | Stale context; edits outside the lane | Soft: file writes made through shell commands bypass Edit/Write hooks |
| Verify and review | The issue's verify command with pasted evidence; a fresh-context reviewer subagent | "Done" claims without tests; drift from the spec | Only as good as the human who reads it |
| CI | Three required jobs | Lint, type, test, build and contract breakage before merge | Hard when branch protection is enforced |
| Smoke test | `scripts/smoke.py` against `demo` after each deploy | Integration that is broken on the real stage | Revert the merge, don't fix forward |

```json
{
  "permissions": {
    "allow": [
      "Bash(git status*)", "Bash(git diff*)", "Bash(git log*)", "Bash(git add *)", "Bash(git commit *)",
      "Bash(git fetch*)", "Bash(git rebase origin/main)", "Bash(git merge origin/main)",
      "Bash(git push -u origin worktree-*)", "Bash(gh issue view*)", "Bash(gh issue comment*)",
      "Bash(gh pr create*)", "Bash(gh pr view*)", "Bash(npm ci)", "Bash(npm run *)", "Bash(npm test*)",
      "Bash(uv sync*)", "Bash(uv run *)"
    ],
    "deny": [
      "Bash(git push --force*)", "Bash(git push -f*)", "Bash(git push origin main*)",
      "Bash(git push origin HEAD:main*)", "Bash(git reset --hard*)", "Bash(*--no-verify*)",
      "Bash(gh pr merge*)", "Bash(*--config-env demo*)", "Bash(*stage=demo*)", "Bash(*Stage=demo*)",
      "Bash(*deploy_demo*)", "Bash(aws bedrock-agent start-ingestion-job*)"
    ]
  },
  "hooks": {
    "SessionStart": [{ "matcher": "startup|resume|clear|compact",
      "hooks": [{ "type": "command", "command": "python",
                  "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/brief.py"], "timeout": 20 }] }],
    "PreToolUse": [{ "matcher": "Edit|Write|NotebookEdit",
      "hooks": [{ "type": "command", "command": "python",
                  "args": ["${CLAUDE_PROJECT_DIR}/.claude/hooks/scope_guard.py"], "timeout": 10 }] }]
  }
}
```

Several verified behaviors shape this file. Hooks in `.claude/settings.json` are committed and shared. A PreToolUse hook blocks by exiting with code 2, or by printing `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"..."}}`. **Other nonzero exits and timeouts are non-blocking** ([Hooks](https://code.claude.com/docs/en/hooks)), so a crashing guard lets the edit through. `scope_guard.py` must therefore catch its own errors and deny. On Windows, hooks run in Git Bash if it is installed and in PowerShell otherwise. Exec-form commands must be real executables, so `.cmd` shims such as `npx` cannot be spawned. The docs also call the `if` filter best-effort and say hard allow and deny rules belong in the permission system ([Hooks](https://code.claude.com/docs/en/hooks)). Inside a worktree, `${CLAUDE_PROJECT_DIR}` still points at the main checkout, while the hook's `cwd` input follows the worktree ([Worktrees](https://code.claude.com/docs/en/worktrees)). The guard therefore runs the main checkout's copy of the script and reads the worktree name from `cwd`. On Windows, "Yes, don't ask again" approvals stay with the worktree where they were given ([Worktrees](https://code.claude.com/docs/en/worktrees)). Without the committed allowlist, every new worktree would prompt again. Native Windows has no sandbox ([Setup](https://code.claude.com/docs/en/setup)), so never run `--dangerously-skip-permissions` there. The exact deny-pattern syntax was not confirmed in the research; test each pattern (see the Windows tests below).

`.claude/roster.json`, shown in the lanes section, drives the guard. The guard takes the worktree name from `cwd` (the part after `.claude/worktrees/`) and uses the prefix before the first hyphen as the lane. It reads the person from `SABOOT_WHO` and checks that this person holds the lane in the main checkout's roster. It normalizes Windows backslashes and letter case, then makes the target path relative to the worktree root. It allows the edit if the path matches the lane's globs, `always`, or `docs/status/<SABOOT_WHO>.md`. It denies everything else with a reason: relaunch with the right lane name, or ask the lead to update the roster. If `SABOOT_WHO` is unset or the roster can't be read, it denies. A session outside `.claude/worktrees/` may not write at all. Claude Code's own isolation does not track files written by shell commands, and for PowerShell only the working-directory check applies ([Worktrees](https://code.claude.com/docs/en/worktrees)). The guard is a lane marker, not a wall. CI and review are the backstop.

| CI job | Steps | Runs on |
|---|---|---|
| `contracts` | `uv run python scripts/validate_contracts.py` validates every fixture against its schema | Every PR and every push to `main` |
| `frontend` | In `frontend/`: `npm ci`, `npm run lint`, `npx tsc --noEmit`, `npm test -- --run`, `npm run build` | Every PR |
| `python` | For each of `data/`, `backend/agent/`, `backend/firms/`: `uv sync --locked`, `uv run ruff check .`, `uv run pytest -q`, with Bedrock and AWS calls stubbed | Every PR |

*Judgment:* run all three jobs on every PR instead of path-filtering them. A required check that a path filter skipped can block a merge (a general GitHub behavior, not verified in the notes), and the jobs are small. Set `concurrency` per branch with `cancel-in-progress: true`, so rapid agent pushes do not pile up runs. Skip a pre-commit framework on day 1: lint already runs in each issue's verify command and in CI, and it would be one more tool to install on Windows.

The fresh-context reviewer is `.claude/agents/reviewer.md`. It runs on Sonnet with read-only tools and compares `git diff origin/main...HEAD` against the issue's acceptance criteria, `AGENTS.md`, the contracts and the accepted decisions. Cognition reports that a review agent works best when it shares no prior context with the coder, and that Devin Review flags about two bugs per PR, roughly 58% of them severe ([Cognition 2026](https://cognition.com/blog/multi-agents-working)). Claude Code's docs warn that a reviewer told to find gaps will always find some, so restrict it to correctness and the stated requirements ([Best practices](https://code.claude.com/docs/en/best-practices)). Name `AGENTS.md` in the reviewer's prompt; don't rely on what loads automatically.

*Judgment:* add no blocking Stop hook on day 1. A Stop hook fires every time Claude finishes a response, the loop-guard field it needs was not confirmed in the research, and the verify command plus CI already cover the same ground. Add one later only if agents keep declaring work done without running tests.

## Four AWS stages share one account without collisions

| Resource | Personal stages `hem`, `gir`, `har` | Shared `demo` stage |
|---|---|---|
| Identity | One IAM Identity Center user (or IAM user) per person; profile `saboot-<code>`; region `ap-south-1`; root locked away with MFA | The infra holder's identity |
| Lambda stack | `saboot-<code>`, from one template with a `Stage` parameter | `saboot-demo`, deployed by the infra holder from a clean `main` checkout only |
| Function URLs | One per Lambda per stage, set in that person's `frontend/.env.local` | Set in Amplify environment variables |
| DynamoDB | `saboot-<code>-cases`, on-demand | `saboot-demo-cases` |
| S3 | `s3://saboot-data-<account-id>/<code>/...` | `.../demo/...`, written only by the data holder's promote script and the agent holder's corpus upload |
| Bedrock Knowledge Base | The shared KB, read-only, located through `KB_ID` | One KB on S3 Vectors over `demo/corpus/`; only the agent holder starts ingestion |
| Amplify Hosting | Local `npm run dev` against your own stage | Auto-builds from `main`; PR previews off |
| Tags | `project=saboot`, `stage=<code>`, `owner=<name>` | `stage=demo` |

*Judgment:* set user-level environment variables `AWS_PROFILE=saboot-<code>` and `SABOOT_WHO=<code>` on each laptop. Deploy scripts use `SABOOT_WHO` as the stage name, and the scope guard uses it as the person. Every agent in every worktree then defaults to its owner's personal stage, and reaching `demo` takes a deliberate override that the deny rules block for agents. Give each stage its own stack. CloudFormation will not run two updates on one stack at once (general behavior, not re-verified), so separate stacks remove the "update in progress" collision entirely. Record SAM versus CDK as a kickoff decision and let the infra holder pick the one they know.

Bedrock Knowledge Base ingestion is serialized. Secondary summaries of an AWS blog report one ingestion job per knowledge base and per data source, and five per account ([Let's Data Science, secondary](https://letsdatascience.com/news/amazon-bedrock-adds-automatic-knowledge-base-sync-solution-1f8bab66)). `StartIngestionJob` accepts an idempotent `clientToken` ([Bedrock API](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_agent_StartIngestionJob.html)). The agent holder's ingestion script should call `ListIngestionJobs` first and wait if a job is running. Retrieval is read-only, so every stage can share the one KB. Bedrock throughput quotas are account-wide, so automated tests run on fixtures and live model calls are left to manual checks and the smoke test (*Judgment*).

*Judgment:* skip a separate Amplify `demo` branch. Judging is on the video, not on a live URL, so the Saturday 20:00 freeze protects the recording well enough. Keep PR previews off; Amplify exposes `EnablePullRequestPreview` as a branch-level setting ([AWS CDK CfnBranchProps](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_amplify.CfnBranchProps.html)). Deploy `demo` by hand on Thursday and Friday. Move it into CI with an OIDC role only if someone has a free hour. On Sunday after submission, tear down every stage stack and the KB.

## Every task takes the same nine steps from issue to merge

| # | Step | Who | Command or artifact |
|---|---|---|---|
| 1 | Write the issue | Lane owner (session 2 may draft it) | `gh issue create --label area:data,never-cut --assignee @me` with a body containing: goal, never-cut step, acceptance check as seen in the video, verify command, directories, out of scope. Size: 30–120 minutes of agent work |
| 2 | Claim it | Assignee | The assignee field is the lock. If someone else holds it, don't start |
| 3 | Launch | Human | `git -C C:\Coding\saboot pull`, then `claude -w data-14-firms`; on first use, `uv sync` or `npm ci` in the worktree |
| 4 | Plan | Session 1 in plan mode | Reads the brief, `gh issue view 14` and the contracts, then proposes a plan for the human to edit and approve. Skip this step if the diff fits in one sentence ([Best practices](https://code.claude.com/docs/en/best-practices)) |
| 5 | Build and verify | Session 1 | Runs the verify command and pastes the evidence (test output or a screenshot). Each mock left in place gets an `integration-debt` issue |
| 6 | Record | Session 1 | `/decide` for anything that reaches beyond this task; a comment on the issue |
| 7 | Review | Reviewer subagent or session 2 | Fresh-context check against the acceptance criteria, `AGENTS.md`, the contracts and accepted decisions; fix correctness gaps only |
| 8 | Hand off and open the PR | Session 1, then the human | `/handoff` updates the status file. Then `git fetch`, `git rebase origin/main`, `git push -u origin worktree-data-14-firms`, `gh pr create --fill`. The body has `Closes #14`, evidence, decisions, conflicts resolved, integration debt |
| 9 | Merge and close out | Human | Squash-merge after CI is green (with the other owner's approval for cross-lane or contract PRs), exit the session and remove the worktree, start the next issue in a fresh session |

Two habits keep the lifecycle healthy. After two failed corrections, `/clear` and restart with a better prompt instead of piling on fixes; the docs list repeated correction of the same session as a failure pattern ([Best practices](https://code.claude.com/docs/en/best-practices)). And treat abandoned sessions as normal: Claude Code's creator reportedly abandons 10–20% of his remote sessions ([InfoQ, secondary](https://www.infoq.com/news/2026/01/claude-code-creator-workflow/)). Only the lane writer runs `/handoff`. Chore PRs leave the status file alone, so one person's PRs rarely collide with each other.

## Checkpoints every three to four hours, pinned to the build plan's gates

| When (IST) | Ritual | Build-plan gate it serves |
|---|---|---|
| Thu, kickoff + ~2 h | Setup (next section), then the first issues start | "Bedrock works from Mumbai: go or no-go" |
| Thu ~17:00, ~20:00, 23:00 | 15-minute checkpoints | 23:00: map live on Amplify, Retrieve returns relevant clauses, schema verified |
| Fri and Sat 09:00 | 10-minute stand-up: each person names today's issues and directories; pending contract changes go first | n/a |
| Fri 13:00, ~17:00, 22:00 | Checkpoints | 13:00: one site works locally. 22:00: the never-cut path works when deployed, for three sites |
| Sat 12:00 | Checkpoint, then **freeze `contracts/` and `infra/`** (fixes only; *Judgment*) | Fallback stubs in place by noon |
| Sat 16:00, 20:00 | Checkpoints; **20:00 feature freeze** | Feature freeze |
| Each night ~23:00 | 30 minutes: demo run on the deployed URL, a rough screen capture as backup, prune `AGENTS.md`, queue read-only overnight agents | Backup take saved |
| Sun | Fixes only until 09:30, then recording | Submit by about 15:00 |

Each checkpoint follows a fixed agenda (*Judgment*):

1. Merge green PRs in dependency order: contracts, then backend, data and frontend.
2. Everyone runs `git pull` in the main checkout and restarts any agent whose branch is more than about four hours old from a fresh `origin/main`.
3. The infra holder deploys `demo`, and the integration lead runs the smoke test.
4. Everyone skims the new decision files, and anyone whose decision was replaced marks it superseded.
5. The lead flips `passes` in `docs/features.json` for features that worked end to end.
6. Each person names their next issues.

The cadence follows Claude Code's warning that agents left unattended for long stretches waste more effort ([Agent teams](https://code.claude.com/docs/en/agent-teams)), and DORA's small-batch evidence.

Overnight agents follow Hashimoto's pattern: exploration, research and triage run unattended but are not allowed to act ([Hashimoto](https://mitchellh.com/writing/my-ai-adoption-journey)). Examples are a review of `main` against `AGENTS.md`, a writeup draft built from the decision files, and research questions. They write to files in a scratch worktree and never push. Background sessions are local and stop when the machine shuts down ([Agent view](https://code.claude.com/docs/en/agent-view)), so leave those laptops awake.

## Two people run the same setup with a different roster

Nothing in the setup is tied to three people. Directories belong to lanes, worktree names start with the lane, and the scope guard checks the lane's holder in `.claude/roster.json`. Dropping to two people (someone leaves, falls ill or is offline for a day), or running the whole project with two, changes that one file. Folders, contracts, CI, AWS stages and the checkpoint times stay the same.

| Who is missing | Two-person roster (*Judgment*) | Integration lead |
|---|---|---|
| Harshit | Hemang: agent, fe. Girish: data, infra | Girish Thu–Fri, Hemang Sat–Sun |
| Hemang | Harshit: fe, agent. Girish: data, infra | Girish Thu–Fri, Harshit Sat–Sun |
| Girish | Harshit: fe, data. Hemang: agent, infra | Hemang Thu–Fri, Harshit Sat–Sun |

The rule behind the table: the missing person's lanes go to whoever holds fewer lanes, so as few lanes as possible change hands. The lead is still the infra holder until Friday and the frontend holder from Saturday.

Switching takes about 15 minutes:

1. The person leaving runs `/handoff` in each writing session and pushes every branch, opening a draft PR for unfinished work. If they left without warning, the new holder reads their status file and runs `gh pr list --author <their GitHub username>`.
2. The lead changes the holders in `.claude/roster.json` in a `lead-roster` PR and merges it straight away. Until it merges, the scope guard keeps blocking the new holder, which is intended.
3. The new holder pulls, then picks up each draft PR in that lane by launching a worktree on its branch, or closes it. Never open a second branch in a lane while an old one is still open; that is how two writers end up in one lane.
4. AWS powers follow the lane: `demo` deploys go with infra, and Knowledge Base ingestion goes with agent. The leaving person's personal stage stays untouched until teardown.

Going back to three people reverses the roster PR. The returning person takes a lane back only after the current holder's open PRs in that lane have merged.

**What changes with two people:**

- Each person still runs at most three sessions and two writers, and the two writer slots go one to each lane, so the chore writer disappears. The team total becomes six sessions and four writers.
- Capacity falls from about 80–90 developer-hours to about 55–60, against 45–55 for the core flow (*Judgment*, from the build plan's estimates). Apply the build plan's cut order from the start: lookalikes with their benchmark, and the full follow-up ladder, are out unless Friday's 22:00 gate is green.
- Checkpoints keep the same times and take about 10 minutes.
- The setup in the next section is the same. Skip the absent person's clone and stage, and set the roster before the first commit.

## The first two hours: commit, push, then parallelize

**T+0:00–0:15, every laptop, in parallel.** Check the toolchain, set your identity and authenticate. On Windows, enable long paths. Windows 11 Home has no Group Policy editor, so use the registry.

```powershell
git --version; gh --version; node --version; python --version; uv --version; aws --version; claude --version
claude update
git config --global user.name  "<Your Name>"
git config --global user.email "<the email on your GitHub account>"
git config --global core.longpaths true
git config --global rerere.enabled true
gh auth login
# Windows only, in an Administrator PowerShell:
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name LongPathsEnabled -Value 1 -PropertyType DWord -Force
```

**T+0:15–0:40, on the repo machine (Girish).** `reports/` and `research_notes/` are byte-for-byte copies of `docs/`. Ignore them so agents see one source. Then create the first commit and push.

```powershell
cd C:\Coding\saboot
git config user.name; git config user.email          # must be the person at this keyboard
Add-Content .gitignore "`n# Agents and duplicate research`n.claude/worktrees/`n.claude/settings.local.json`nCLAUDE.local.md`nreports/`nresearch_notes/"
Set-Content .gitattributes "* text=auto eol=lf`n*.ps1 text eol=crlf`n*.pdf binary`n*.png binary`n*.geojson -diff"
Set-Content .worktreeinclude ".env`nfrontend/.env.local`ndata/.env`nbackend/agent/.env`nbackend/firms/.env"
Copy-Item CLAUDE.md AGENTS.md
Set-Content CLAUDE.md "@AGENTS.md`n`n## Claude Code only`nRun /handoff before you end a session. Record cross-task decisions with /decide."
# Then run `claude` here (no worktree exists yet) and ask it to scaffold the folders and files in this report's
# memory-file table: lane folders with stub AGENTS.md + one-line CLAUDE.md, docs/status/*.md, .claude/roster.json, docs/decisions/ with
# the template, docs/features.json, .github/ISSUE_TEMPLATE/task.md, .github/pull_request_template.md. Review the diff.
git add -A
git status                                           # expect: no .env, no rasters, no reports/ or research_notes/
git commit -m "chore: initial skeleton and shared agent memory files"
# Create a free GitHub organization in the browser first, then:
gh repo create <org>/saboot --public --source . --remote origin --push
git remote set-head origin --auto
git symbolic-ref refs/remotes/origin/HEAD            # expect refs/remotes/origin/main
"area:frontend","area:data","area:agent","area:infra","contracts","never-cut","integration-debt" | ForEach-Object { gh label create $_ }
```

Commit before anything else: in a repo with no commits, `claude --worktree` stops with a `Failed to resolve base branch "HEAD"` error ([Common workflows](https://code.claude.com/docs/en/common-workflows)). The `set-head` line is general git, not from the notes. It makes sure `origin/HEAD` exists for the default `"fresh"` base, which otherwise falls back to local `HEAD`. Invite Hemang and Harshit to the organization with write access. In the repo's general settings, allow squash merging only and turn on automatic deletion of head branches. Meanwhile, Hemang starts the Bedrock smoke test from the build plan, and Harshit turns the build plan's Thursday row into draft issues. Right after the push, Girish creates the three AWS identities and the $30 budget.

**T+0:40–0:50, Hemang and Harshit; then everyone.** Clone the repo, run `claude` once to accept workspace trust (interactive `--worktree` sessions require it, per [Worktrees](https://code.claude.com/docs/en/worktrees)), and set your personal stage.

```powershell
gh repo clone <org>/saboot C:\Coding\saboot          # macOS/Linux: any path
cd C:\Coding\saboot
claude                                               # accept trust, then /exit
setx AWS_PROFILE saboot-hem                          # gir / har on the other laptops; bash: export in your shell rc
setx SABOOT_WHO hem
claude -w wt-test                                    # Windows test 1 below; /exit and choose remove
```

**T+0:50–1:35, kickoff contract session, all three on a call.** Hemang drives `claude -w contract-kickoff`, since the agent's API and table shapes are most of the contract. It produces the `contracts/` files, the lanes and commands sections of `AGENTS.md`, five to eight decision files and the day-1 issues. Girish and Harshit approve, and Hemang merges it as PR #1. In parallel, Girish's session 3 builds the guardrails in `claude -w lead-guardrails`: `.claude/settings.json`, both hooks, `roster.json`, the two skills, the reviewer agent, the CI workflow, and `scripts/validate_contracts.py` and `scripts/smoke.py`. Those files don't overlap with the contracts work. Hemang's session 2 can keep the Bedrock smoke test moving.

**T+1:35–2:00, then normal work.** Girish runs the Windows tests below against the guardrails PR, merges it, and turns on the `main` ruleset (PR required, required checks `contracts`, `frontend` and `python`, up-to-date branches, no force-push). Do this after CI has run once, so the check names exist. Harshit starts `claude -w fe-1-scaffold` for the Vite, React and MapLibre skeleton in mock mode. Once it merges, Harshit connects Amplify to `main` with app root `frontend`, PR previews off and `VITE_API_MODE=mock`. Girish deploys the `gir` stage from the IaC skeleton. From here, everyone follows the nine-step lifecycle with at most three sessions each.

## Verified facts, judgment calls, and what Windows must prove

**The plan rests on these verified facts.** `claude --worktree` needs a commit ([Common workflows](https://code.claude.com/docs/en/common-workflows)). Worktrees branch from `origin/HEAD` by default and copy gitignored files listed in `.worktreeinclude`. Claude Code enforces worktree isolation, but not for shell-written files, and only by working directory for PowerShell. On Windows, permission approvals stay per worktree ([Worktrees](https://code.claude.com/docs/en/worktrees)). Auto memory is machine-local; the docs recommend importing `AGENTS.md` rather than symlinking it on Windows; and `CLAUDE.md` should stay under 200 lines ([Claude Code memory](https://code.claude.com/docs/en/memory)). SessionStart output is capped at 10,000 characters and reruns after compaction, while PreToolUse failures other than exit code 2 are non-blocking ([Hooks](https://code.claude.com/docs/en/hooks)). Agent teams are experimental and do not isolate teammates in worktrees ([Run agents in parallel](https://code.claude.com/docs/en/agents)). Quota scales linearly with the number of agents ([Agent view](https://code.claude.com/docs/en/agent-view)). Kiro, Cursor and Codex read `AGENTS.md`. The figures from the merge-conflict study, the Bedrock ingestion limits, Kiro's pricing, the session counts reported for Claude Code's creator and the GitHub plan matrix come from secondary or conflicting sources.

**Where the notes disagreed, this plan picks one option:**

| Question | Options in the notes | Pick (*Judgment*) | Why |
|---|---|---|---|
| Decision log | Single append-only `DECISIONS.md`, or one file per decision | One file per decision | Six writers on separate branches would all append to the same file; `merge=union` is unreliable on GitHub; uniquely named files cannot conflict |
| Sessions per person | 2–4; 3–4; at most 3 with 1 needing attention | 3 sessions, at most 2 writers, 1 needing attention | Review is the bottleneck, quota scales linearly, and the codebase is new |
| Contract format | `contracts/` with OpenAPI, schemas and codegen, or prose in `docs/contracts.md` | `contracts/` with README, JSON Schema and fixtures; no codegen | CI can check it, fixtures double as mocks, and the codegen tools are unverified on Windows |
| Task tracking | Issues; `docs/plans/<area>.md`; `docs/progress.md`; `features.json` | Issues for tasks, per-person status files, single-writer `features.json` | Issues are atomic and visible from every machine; no file is shared by several writers |
| Lane instructions | `.claude/rules/*.md` with `paths:`, or nested `AGENTS.md` | Nested `AGENTS.md` plus a one-line `@AGENTS.md` `CLAUDE.md` in each lane | Works in every tool; doesn't depend on how each tool loads nested files |
| Lane assignment | A research-note example, or the build plan | The build plan's lanes, with the holders the team chose: Harshit frontend, Girish data and infra, Hemang agent | It is the team's existing plan; holders live in the roster, so they can change |
| Integration lead | Rotating, or the backend owner | Infra holder Thu–Fri (Girish), frontend holder Sat–Sun (Harshit) | Checkpoint work sits next to `demo` deploys; the agent holder carries the Bedrock go/no-go |
| `demo` deploys | CI with OIDC, or one named person | The infra holder by hand; CI later if there is time | Setting up OIDC costs day-1 time |
| Stop-hook test gate | Yes, or no blocking Stop hook | None on day 1 | It fires every turn, its loop guard is unverified, and CI covers the same ground |
| Hook language | Node or Python | Python | Already used by three lanes; test the interpreter on Windows |
| Merge queue | Use it if the repo is in an org, or skip it | Skip; use strict required checks instead | Three people merging at checkpoints don't need a queue |
| Amplify `demo` branch | Separate branch, or `main` only | `main` only | Judging is on the video, and the freeze protects the recording |
| Branch naming | `<area>/<issue>`, or Claude's `worktree-<name>` | `claude -w <lane>-<issue>-<slug>` | No setup; the lane prefix drives the scope guard and stays valid when the roster changes |

**Test these on Windows before trusting them.** Girish's machine runs Windows 11 Home; run the same tests on any other Windows laptop.

| # | Test | Pass condition | If it fails |
|---|---|---|---|
| 1 | `claude -w wt-test` after the first push | Creates `.claude\worktrees\wt-test` on `worktree-wt-test` from `origin/main`; exiting removes it cleanly | Check `git symbolic-ref refs/remotes/origin/HEAD`; run `claude` once for trust; run `claude update` |
| 2 | `.worktreeinclude` | `frontend\.env.local` appears in a new worktree | The file must be both gitignored and listed |
| 3 | `npm ci` and `npm run build` inside a worktree | No "Filename too long" error | Check `core.longpaths` and `LongPathsEnabled`; shorten worktree names |
| 4 | SessionStart brief | Appears at start and after `/compact`; under 6,000 characters; Devanagari prints correctly | `python` may resolve to the Microsoft Store alias, so use `py` or a full path; force UTF-8 output in the script (general Windows behavior, not verified in the notes) |
| 5 | Scope guard | With `SABOOT_WHO` set to the `fe` holder, an edit to `backend/agent/` from an `fe-` worktree is denied with a reason, `frontend/` edits work, and backslash paths are handled. With `SABOOT_WHO` set to anyone else, the `fe-` worktree cannot write at all | A crash means the edit is allowed; fix it and retest |
| 6 | Deny rules | Asking the agent to `git push origin main` or `gh pr merge` is refused | Adjust the pattern syntax with `/permissions` |
| 7 | Agent shell | With Git for Windows installed, the agent uses the Bash tool | Install Git for Windows; under PowerShell, isolation is checked only by working directory |
| 8 | Line endings | A fresh clone on Windows shows a clean `git status` | Run `git add --renormalize .` |
| 9 | Prompts in new worktrees | The committed allowlist covers routine commands | Extend the allowlist; "don't ask again" answers stay with one worktree |
| 10 | Desktop app's worktree toggle, if anyone uses it | The worktree name matches a scope prefix | Use the CLI's `claude -w` instead |

## Conclusion

The shared brain this report describes is mostly a discipline about who writes what. Coherence across nine sessions doesn't come from a smarter memory tool. It comes from making every shared fact live in exactly one file with exactly one writer, and from reading those files again at every session start. That is why the decision log fragments into files, the status file is overwritten rather than appended, and contracts change only through their own PRs. Each rule removes a place where two agents could quietly disagree.

The scarce resource over 3.5 days is the three humans' attention at merge time, not agent capacity. When `main` goes red or PRs wait more than a checkpoint for review, cut back to one writer per person before adding more process; the hackathon post-mortem in the notes shows that heavy process can sink a project too. The same artifacts also pay off at the end. Timestamped decision files, per-person status files with an "AI tools used" line, and squash commits from three accounts are the raw material for the writeup, the evidence that history stayed inside 8–11 October, and the proof that all three members committed.
