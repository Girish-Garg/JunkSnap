# JunkSnap: rules for every agent and every tool

JunkSnap is community-reported, ML-verified civic waste reporting for all of India, with Jodhpur as the pilot city where data goes deepest. Anyone snaps waste with the in-app camera. The server moderates and blurs the photo, verifies it with a stacked ensemble of models, merges reports into sites, locates them to ward, assembly seat and Lok Sabha seat, scores each area and drafts cited letters to the bodies that must act.

Pitch: dumps are not only the authorities' failure. People dump on empty plots, often because there is nowhere legal to put waste. JunkSnap measures all three causes.

Built for Environmental Hacks (Bharat Builds Tour, WeMakeDevs + AWS), 8 to 11 October 2026, Waste and Energy track. Team: Hemang, Girish, Harshit.
Plan and task list: `docs/handover.md`. Architecture: `docs/architecture.md`. Code rules: `docs/working.md`.

**Never-cut path:** snap → moderation and blur → stacked verification → site on the map with ward, MLA and MP → cited letter with verifier → area report, working on the deployed URL with real Jodhpur field-audit reports. Checklist: `docs/features.json`.

## Event rules that constrain the work

- No code written before kickoff (8 Oct 2026). Repo history must match the event dates, or the whole team is disqualified. All three members should commit.
- Judging is on the submission only: a public repo, a YouTube video of 3 minutes or less, and a short writeup. There is no live demo, and anything not shown in the video does not count.
- AWS must be visible in the video. Built on AWS is required to win a prize.
- Every AI tool used must be listed in the writeup.
- Submissions close 11 Oct 2026; check the exact hour on the event schedule page.
- Criteria: idea and impact, built on AWS, design and usability, execution, demo video. "A working feature beats several unfinished ones."

## Product rules

- Capture is in-app camera only. The server always re-verifies; scores from the phone are hints for live boxes and frame selection only.
- Privacy: blur faces and number plates before any public copy exists; originals stay private (KMS); no photos of people dumping; never name an individual in any text.
- Only blurred images go to any model (Bedrock, OpenAI, OpenRouter). Bedrock is the default; OpenAI and OpenRouter are fallbacks.
- Company names appear only when a label is readable and above the confidence threshold.
- Letters go To the local body head, Cc councillor, MLA and MP "for attention", in neutral wording with no party colours. Nothing is filed automatically; the resident files.
- Every quoted rule comes from a hashed official text and passes the word-for-word verifier. Quotes stay in the official English or Hindi; letter prose may be regional. Cite the Solid Waste Management Rules, 2026 as S.O. 388(E), 27 January 2026, in force 1 April 2026.
- Area scores: area level only, at least 10 verified reports before a score shows, counts always shown, pilot flag, never invent history.
- Every model decision records provider, model and version in the evidence.

## Code rules (full version: docs/working.md)

- Strict OOP: one responsibility per class, ports injected through constructors, no globals, immutable value objects, extend with new classes not branches.
- Layers: domain ← ports ← services ← adapters/handlers. Services never import SDKs. Packages never import each other; they exchange contract shapes.
- Limits: file 250 lines (.tsx 150), class 150, function 30, params 4, complexity 8, nesting 3. CI enforces them.
- Comments and docstrings: one line, only when the code can't say it (a why, a gotcha, a unit). Never restate the code; no long docstrings, no filler.
- Done = lint + types + tests + limits green, fixtures valid, evidence in the PR.

## Folders

| Folder | Holds |
|---|---|
| `frontend/` | React + MapLibre web app |
| `backend/pipeline/` | Moderation, authenticity, location, sites, scores |
| `backend/agent/` | LLM layer, stacked verification, brands, rulebook, letters |
| `infra/` | Infrastructure as code (`junksnap-<stage>` stacks) |
| `contracts/` | Schemas, fixtures, README: source of truth for shapes and routes |
| `data/` | Boundaries, representatives, labels (small files only) |
| `docs/` | Handover, architecture, working agreement, decisions, status |
| `scripts/` | `validate_contracts.py`, `smoke.py`, `check_limits.py` |

## Session protocol

1. Read the session brief, `docs/handover.md` and the task's GitHub issue. Read `contracts/README.md` before touching an API, table, S3 key or shape.
2. One task per branch and worktree. Plan first, unless the change fits in one sentence.
3. Run the verify command and paste the evidence (test output or a screenshot).
4. Record cross-task decisions with `/decide`. Never keep team decisions only in auto memory.
5. Push the branch and open a PR. Task agents skip `/handoff` and never commit `docs/status/*.md`; the lead session runs `/handoff` at checkpoints (proposed, 20261010-0136).

Decision status: `accepted` binds, `proposed` is context only, `superseded` is history. If your task conflicts with an accepted decision, stop and ask.

## Stop and ask before you

- change a contract, a table key or the S3 layout
- add a paid AWS resource, or change billing or account settings
- delete, skip or weaken a test
- try a third approach after two failed ones

## Never

Push to `main` · force-push or rewrite history · commit secrets or `.env` files · use `--no-verify` · type passwords, keys or tokens · name a person in any text

## Git

- One branch and worktree per task; PRs under about 400 changed lines. PR body: `Closes #n`, evidence, decisions, integration debt.
- Commit trailers: no AI co-author trailer. Every commit ends with exactly one trailer, alternating commit by commit between `Co-authored-by: Hemang <coehemang@gmail.com>` and `Co-authored-by: Girish Garg <garggirish2020@gmail.com>`. The writeup still lists every AI tool used.
- Before the first push: `git fetch`, then `git rebase origin/main`. After pushing, merge `origin/main` instead of force-pushing.
- Claude merges a PR once CI is green and the reviewer says SHIP: squash through the GitHub API, with the commit message ending in exactly one co-author line, alternating as above (proposed, 20261010-0135).
- Never hand-merge a lockfile; fix the manifest and regenerate it.

## Commands

- frontend: `cd frontend; npm ci; npm run dev; npm run lint; npm test -- --run; npm run build`
- Python packages: `cd backend/<pkg>; uv sync; uv run ruff check .; uv run mypy --strict src; uv run pytest -q`
- contracts: `uv run scripts/validate_contracts.py`
- size limits: `uv run scripts/check_limits.py`
- smoke test: `uv run scripts/smoke.py <url> [<url> ...]`

## AWS

- Region `ap-south-1`, CLI profile `junksnap` (the human signs in with `aws login`), tags `project=junksnap` and `stage` (proposed, 20261010-0130, -0132).
- Kubernetes: one EKS Auto Mode cluster `junksnap` (eksctl `infra/eks/cluster.yaml`), namespaces `junksnap-dev` and `junksnap-demo`. Workloads `api`, `agent`, `worker` and the `scores` CronJob, manifests in Kustomize `infra/k8s/`, images in ECR, AWS access through EKS Pod Identity, CloudFront over the ALB (proposed, 20261010-0130, -0132).
- Per-stage AWS resources: CloudFormation `infra/aws/stage.yaml`, stacks `junksnap-dev` and `junksnap-demo` (proposed, 20261010-0130).
- Deploy `demo` only from a clean `main`, and only when the human says so. Never run commands that change billing or account settings; read-only checks by the lead session are fine. Tests stub AWS and model calls.
