# Saboot: rules for every agent and every tool

Saboot (सबूत, "proof") turns a map pin on an illegal dump or waste-burning site in Jodhpur into dated satellite evidence and a complaint that cites the exact rule. Built for Environmental Hacks (Bharat Builds Tour, WeMakeDevs + AWS), 8 to 11 October 2026, Waste and Energy track. Team: Hemang, Girish, Harshit.

**Never-cut path** (protect it above everything else): pin → dated Sentinel-2 timeline → FIRMS thermal anomalies → cited Hindi complaint draft with verifier → hashed photo, working for three seed sites on the deployed URL. The checklist is `docs/features.json`.

## Event rules that constrain the work

- No code written before kickoff (8 Oct 2026). Repo history must match the event dates, or the whole team is disqualified. All three members should commit.
- Judging is on the submission only: a public repo, a YouTube video of 3 minutes or less, and a short writeup. There is no live demo, and anything not shown in the video does not count.
- AWS must be visible in the video. Built on AWS is required to win a prize.
- Every AI tool used must be listed in the writeup.
- Submissions close 11 Oct 2026; the exact hour was not yet published when work began.
- Criteria: idea and impact, built on AWS, design and usability, execution, demo video. "A working feature beats several unfinished ones."

## Product rules

- Every rule cited in a complaint draft must come from a retrieved document shown beside it, never from model memory. Cite the Solid Waste Management Rules, 2026 as S.O. 388(E), 27 January 2026, in force 1 April 2026.
- Drafts describe a location, never name a person.
- FIRMS hits are "thermal anomalies recorded near this location", not proof of burning.
- Lookalike results are "candidates", shown with imagery, never as confirmed dumps.
- Nothing is filed automatically. The resident files the complaint.

## Lanes

Lanes own folders. People hold lanes, and `.claude/roster.json` says who holds which (the session brief prints it).

| Lane | Folders its agents may write |
|---|---|
| `fe` | `frontend/`, `amplify.yml` |
| `data` | `data/`, `backend/firms/` |
| `agent` | `backend/agent/` |
| `infra` | `infra/` |
| `contract` | `contracts/` (contract-only PRs, approved by every affected holder) |
| `lead` | `AGENTS.md`, `CLAUDE.md`, `.claude/`, `.github/`, `.gitattributes`, `.gitignore`, `.worktreeinclude`, `docs/features.json`, `scripts/` |

Anyone may add a new file in `docs/decisions/`. Each person edits only their own `docs/status/<code>.md`.

Your worktree name starts with your lane, for example `fe-12-legend`. Write only inside that lane's folders. For another lane, open an issue or comment on the PR. Lanes never import each other's code; they validate against `contracts/`.

## Session protocol

1. Start by reading the session brief. Kiro, Cursor, Codex and other tools: read `.claude/roster.json`, `docs/status/*.md` and the 10 newest files in `docs/decisions/` yourself.
2. Run `gh issue view <n>` for your task. Read `contracts/README.md` before touching an API, table, S3 key or GeoJSON shape.
3. One issue per session. Plan first, unless the change fits in one sentence.
4. Run the issue's verify command and paste the evidence (test output or a screenshot).
5. Record any decision that reaches beyond this task with `/decide` (other tools: copy `docs/decisions/_template.md`). Never keep team decisions in auto memory.
6. Finish with `/handoff` (other tools: overwrite your `docs/status/<code>.md` by hand).

Decision status: `accepted` binds, `proposed` is context only, `superseded` is history. If your task conflicts with an accepted decision, stop and ask.

## Stop and ask before you

- change anything in `contracts/`
- add a dependency or an AWS resource
- delete, skip or weaken a test
- change a table key, an S3 layout or a schema
- try a third approach after two failed ones
- touch another lane

## Never

Push to `main` · force-push · merge a PR · deploy to or write the `demo` stage · start a Knowledge Base ingestion job · commit secrets or `.env` files · use `--no-verify` · name a person in a complaint draft

## Git

- Every writing session runs in its own worktree: `claude -w <lane>-<issue>-<slug>`. The main checkout stays on `main`, clean and read-only.
- Before the first push: `git fetch`, then `git rebase origin/main`. After pushing: `git merge origin/main`. Never force-push.
- One issue, one lane, under about 400 changed lines, open for under about 6 hours.
- PR body: `Closes #n`, evidence, decisions, conflicts resolved and which side was kept, integration debt.
- Every mock left in place gets an `integration-debt` issue with an owner.
- Never hand-merge a lockfile. Fix the manifest, then regenerate (`npm install --package-lock-only`, `uv lock`).
- Conflicts: resolve only mechanical ones (lockfiles, imports, formatting, two independent additions, your own lane). Anything touching contracts, a cross-lane signature or data shape, `infra/`, IAM, CORS, table keys or the S3 layout goes to its holder.

## Commands

- frontend: `cd frontend; npm ci; npm run dev -- --port <your port>; npm run lint; npm test -- --run; npm run build`
- Python lanes: `cd <lane folder>; uv sync; uv run ruff check .; uv run pytest -q`
- contracts: `uv run scripts/validate_contracts.py`
- smoke test: `uv run scripts/smoke.py <url> [<url> ...]`
- Dev ports: Hemang 5173–5176, Girish 5180–5183, Harshit 5190–5193.
- Run linters and tests from inside a lane folder, never from the repo root (the root also contains `.claude/worktrees/`).

## AWS

Region `ap-south-1`. Your AWS profile is `saboot-<code>` and your personal stage is your `SABOOT_WHO` code. Resource names follow `saboot-<stage>-*`, and everything is tagged `project=saboot`, `stage=<stage>`, `owner=<name>`. Only the `infra` holder deploys `demo`. Only the `agent` holder starts Knowledge Base ingestion. Tests stub Bedrock and AWS calls.

## Read only when needed

- `docs/Saboot hackathon idea evaluation.md`: build plan, rule citations, gates, cut order, video script
- `docs/Parallel coding agents team workflow.md`: why this setup works the way it does
- `docs/research/`: source notes behind both
