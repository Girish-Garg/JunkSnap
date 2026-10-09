# JunkSnap handover: from here to submitted

Read this first in every session. It holds the deadline, the human-only steps, every decision and the full task list. Rules live in `AGENTS.md` and `docs/working.md`; the design lives in `docs/architecture.md`.

## 1. Deadline and people

- Feature freeze: **Saturday 10 Oct 2026, 20:00 IST.** After that, fixes only.
- Submission: **Sunday 11 Oct 2026.** Check the exact hour on https://www.wemakedevs.org/aws/env/schedule; until it is known, aim to submit by 15:00 IST.
- Hemang (coehemang@gmail.com) drives the build with Claude Code. Girish (garggirish2020@gmail.com, repo owner) and Harshit do the field audit, labelling, PR review and the video. All three must appear in the history: each commits their own status file, labels and README or video parts.
- Repo: https://github.com/Girish-Garg/saboot

## 2. Only the humans do these (Claude asks, with exact steps, at the moment it needs them)

- Type passwords, API keys or tokens: AWS sign-in (`aws login --profile junksnap`), the OpenAI and OpenRouter keys (stored in Secrets Manager by the human), GitHub sign-in.
- Billing and account settings: budget alarm, AWS plan upgrade, Bedrock model access.
- Connect Amplify to GitHub (OAuth consent).
- Take field-audit photos; label them in Label Studio.
- Record and upload the YouTube video, publish the optional Builder Center blog, fill the submission form, ask organisers on Discord.

Claude merges PRs itself once CI is green and the reviewer says SHIP: squash through the GitHub API, commit message ending in one alternating co-author line (proposed, 20261010-0135).

## 3. Machine setup

- Tools: git, gh (logged in, write access to the repo), uv, Node 22+, Python 3.12+ (the session hook runs `python`; if `python` opens the Microsoft Store, disable that alias in Windows settings), AWS CLI v2 (`winget install --id Amazon.AWSCLI -e`, with the human's OK).
- AWS: the human runs `aws login --profile junksnap` himself, region `ap-south-1`. It is a root session with short-lived credentials that refresh automatically; no long-lived key is saved (proposed, 20261010-0132). Check with `aws sts get-caller-identity --profile junksnap`. Agents never run billing or account commands.
- The account finished card verification on 10 Oct and all services are active. It is on the Free plan with $100 credits: `aws freetier get-account-plan-state` on 10 Oct 2026 returned accountPlanType FREE, remaining credits 100.0 USD, expiry 2027-04-09. Upgrading keeps the credits. Bedrock Claude Sonnet 4.6, Haiku 4.5 and Nova work from ap-south-1; the Claude 5 family does not (proposed, 20261010-0133).
- Windows: `git config --global core.longpaths true`.
- Tear down the EKS cluster and the stacks after judging.

## 4. Decisions (all accepted except the changes marked proposed; they replace the earlier satellite-only "Saboot" plan)

Decisions 6, 7 and 14 include the changes of the night of 10 Oct, recorded in `docs/decisions/20261010-0130` to `-0137` and marked "(proposed, <file>)" until Hemang confirms. Proposed, 20261010-0137: LLMs are the last step in detection, and their main use is the ward-data crawler (task W1).

1. **Product:** JunkSnap, community-reported, ML-verified civic waste reporting for all of India, Jodhpur as the pilot. Pitch: dumps are not only the authorities' failure; people dump on empty plots, often because there is nowhere legal to put waste. JunkSnap measures all three causes.
2. **Report types:** (a) waste dump, tagged vacant plot, roadside, drain or other; (b) no bin / no pickup; (c) contaminated water: stagnant, sewage, foam, choked drain; (d) open construction: uncovered debris, dusty site. (a) and (b) must ship; (c) and (d) should ship. Potholes are a roadmap line only.
3. **Capture:** in-app camera only, as Snap or live Scan (phone on a scooter). No drone, no Watch mode; drones and CCTV are roadmap.
4. **Edge first, cloud fallback:** the phone runs a tiny YOLO only if a startup probe passes (WebGPU or WASM, under ~300 ms per frame); otherwise cloud mode uploads one downscaled frame per second. Confident-empty frames are skipped except 1 in 20 (recall audit). Offline queue in IndexedDB. The server always re-verifies.
5. **Moderation and authenticity:** client SHA-256 of the original; Rekognition moderation gate; blur faces and number plates before any public copy; originals private under KMS; no photos of people dumping; inside-India check, fresh timestamp, perceptual-hash duplicate check, per-device token, rate limits, reporter reputation; free text moderated for toxicity and personal data.
6. **Stacked verification** (run by the `worker` reading SQS, through the `agent` service; proposed, 20261010-0131): Rekognition labels, a YOLO detector (ONNX in the `agent` image) and an embedding model with a small type classifier (Titan image embeddings `amazon.titan-embed-image-v1`, on-demand in ap-south-1) run in parallel; a vision judge runs only on unresolved cases (type, burning, context, readable brands, rationale; never trusted for counts or boxes); a logistic-regression meta-learner, also fed GPS accuracy, reputation and corroborations, gives a calibrated probability: ≥0.85 auto-verified, 0.5–0.85 community check, <0.5 rejected. Strong disagreement always goes to community check. Build order: fixed weights over Rekognition + judge, then embeddings + meta-learner, then YOLO.
7. **Model-agnostic LLM layer:** one module, `TaskConfig {provider, model, fallback[]}` per task. Bedrock is the default. Judge and letters: Claude Sonnet 4.6 (global profile), then Claude Haiku 4.5 (India profile), then Amazon Nova Pro, then the OpenAI API, then OpenRouter (https://openrouter.ai/api/v1), which is also the benchmark (proposed, 20261010-0133). Same prompts and JSON schema for all models; validate and retry on the next provider; log provider, model and version on every decision. Only blurred images go to any model; OpenRouter excludes providers that store or train on data, and has a credit limit.
8. **Sites:** reports within ~40 m, same type and similar in embedding space merge into one site; open → cleaned (ML-checked after-photo only) → reopened. Company labels only when readable and above the confidence threshold (Rekognition DetectText + brand-to-parent-company map with sources).
9. **Location:** Amazon Location reverse geocoding (state, district, town) plus point-in-polygon for assembly (MLA) and Lok Sabha (MP) seats across India (2008 delimitation boundaries; check the licence). Wards only where open ward maps exist. Representatives: all MPs, Rajasthan MLAs first; each with an as-of date and source; no party field.
10. **Community:** neighbour confirm/reject votes with reputation; "me too" photos; cleanup closes a site only with an after-photo; a human moderator settles disputes.
11. **Area scores**, formulas versioned in `docs/decisions/`: City (median days to clear, % cleared within 7 days, % re-dumped, response to no-bin reports); Citizen (new verified dumps per km² per month, share on vacant plots, drains and roadsides, re-dumping; adjusted for bin access); Bin access (confirmed no-bin reports, distance to the nearest legal disposal point). Diagnosis: dumping + no bins = infrastructure gap; dumping + bins = behaviour; slow clearing = city response; re-dumping = repeat spot. Guardrails: area level only, ≥10 verified reports, counts shown, pilot flag, first-48-hours data only for the pilot, never invented history.
12. **Letters:** To the local body head (legally responsible, 74th Amendment); Cc councillor, MLA and MP "for attention"; neutral. Routing: city body for every type; state pollution board for burning, water and construction dust; Swachhata and CPGRAMS nationwide; District Collector; Rajasthan Sampark in Rajasthan. Code picks rules and addressees, the model writes prose, a verifier checks every quote word for word, with a template fallback. Texts: SWM Rules 2026 (S.O. 388(E)) rules 5(1)(f), 39(2)(vii) and (xi), 15(1) and the collection-duty clause; plastic EPR rules (2026 amendment G.S.R. 237(E)); Water Act 1974; current construction and demolition waste rules; CPCB dust guidelines. Quotes stay in official English or Hindi.
13. **Should ship:** satellite history for large sites (for example Keru, Jodhpur); packaging-type split per area.
14. **Engineering:** strict OOP, layers and size limits (`docs/working.md`). Services run on Kubernetes: one EKS Auto Mode cluster `junksnap` in ap-south-1, namespaces `junksnap-dev` and `junksnap-demo`, workloads `api`, `agent`, `worker` and the `scores` CronJob (proposed, 20261010-0130). Per-stage CloudFormation stacks `junksnap-dev` and `junksnap-demo`, tags `project=junksnap`.
15. **Process:** no lane guard and no roster; one person drives the build; every writing agent gets its own branch and worktree. Commit trailers rotate between Hemang and Girish, never an AI trailer (see AGENTS.md).

## 5. Task list (one GitHub issue, branch and PR per task)

**Wave 0: foundation (first, about 1 hour)**
- T0 tooling: root `ruff.toml` (line-length 100; select E,F,I,B,C90,PL,N,UP,SIM,RET,ARG; max-complexity 8; max-args 4; max-statements 25; max-branches 8). `scripts/check_limits.py` (PEP 723 header so `uv run` works) enforcing the table in `docs/working.md` §4 over `git ls-files`, printing `path:line: rule (actual > limit)`, exit 1 on violation, passing its own check. In `.github/workflows/ci.yml`: the Python job loops over `backend/pipeline` and `backend/agent` and also runs `uv run mypy --strict src`; add a `limits` job. Refresh the stub `AGENTS.md` files in `frontend/`, `data/`, `infra/`, `backend/agent/`; replace `backend/firms/` with `backend/pipeline/` (and update `.worktreeinclude`).
- C1 contracts (issue #1): JSON Schemas 2020-12 plus one fixture each (3 Jodhpur sites, 1 other city) for `report_upload`, `moderation_result`, `verification_result`, `site` (GeoJSON Feature), `brand_label`, `location_lookup`, `ward_scores`, `letter_draft`. `contracts/README.md`: routes (POST /uploads/presign, POST /reports, GET /reports/{id}, GET /sites?bbox, GET /sites/{id}, POST /sites/{id}/votes, POST /sites/{id}/cleanup, GET /areas/{kind}/{id}/scores, POST /sites/{id}/letters), DynamoDB tables and keys, S3 layout, environment variables. Done when `uv run scripts/validate_contracts.py` passes.

**Wave 1 (parallel, after C1 merges)**
- I1 infra (proposed, 20261010-0130): eksctl `infra/eks/cluster.yaml` for the EKS Auto Mode cluster `junksnap`. CloudFormation `infra/aws/stage.yaml` with a `Stage` parameter: private uploads bucket (KMS, presigned PUT), public blurred bucket, DynamoDB tables, SQS + dead-letter queue, Pod Identity roles, an Amazon Location place index, Secrets Manager placeholders. ECR repositories for the images. Kustomize `infra/k8s/` (base, overlays/dev, overlays/demo): `api`, `agent`, `worker` with stub steps, the `scores` CronJob, an ALB ingress with CORS behind CloudFront. Deploy `dev` only. Done when curl presign → PUT → POST /reports through CloudFront lands in DynamoDB through the stubs.
- F1 frontend scaffold: Vite + React + TypeScript + MapLibre, mobile-first; mock mode reads `contracts/fixtures/`; India map opening on Jodhpur; site markers by type; site panel; Hindi/English with Noto Sans Devanagari. ESLint: max-lines 250 (.tsx 150), max-lines-per-function 30, complexity 8, max-params 4, max-depth 3, no-explicit-any; tsconfig strict; services as classes in a ServiceContainer; `amplify.yml`.
- A1 LLM layer + judge v0: providers per proposed decision 20261010-0133 (Bedrock Claude Sonnet 4.6 first, then Haiku 4.5, Nova Pro, OpenAI, OpenRouter); provider layer with validation and fallback; judge prompt; Rekognition label features; fixed-weight combiner → `verification_result`; tests with stubs; a printed run on 10 real photos.
- D1 moderation: moderation gate, face and plate blur, authenticity checks → `moderation_result`; tests with stubbed Rekognition; a real run on 5 photos on `dev`.

**Wave 2 (as wave 1 merges)**
- W1 ward-data crawler (proposed, 20261010-0137): offline job that reads official public pages (municipal corporation and ward lists, census tables, state election and assembly sites, Lok Sabha, Swachh Survekshan) and extracts ward records (ward number and name, municipal body, zone, area km², population, councillor seat, sanitation office contact, legal disposal and collection points, assembly and Lok Sabha seat). Every field has source URL, `fetched_at` and page SHA-256. Validated JSON in `data/wards/`, reviewed before use; offices and seats only, no personal names. Jodhpur first. Feeds D2 and the area scores in D3.
- D2 location: boundaries, Amazon Location, representatives tables, W1 ward records → `location_lookup`; tests with known points.
- A4 rulebook + letters: hashed official texts, hand-checked rules JSON, routing table, letters agent and verifier → `letter_draft`; a test that a misquote fails.
- A3 brands → `brand_label`; precision on 10 close-up packet photos.
- F2 Snap: in-app camera, GPS, client hash, type and context pickers, presign → PUT → submit, status polling, offline queue; mock first, then live on `dev`.
- D3 sites + scores: merging, lifecycle, aggregation, the three scores with guardrails (ward area, population and disposal points from W1) → `ward_scores`.
- F4 community + area pages: verify, me-too, cleanup after-photo, reputation; area page with scores, diagnosis and counts; letter preview with citation cards and print-to-PDF.

**Saturday 07:30–10:00: field data**
- D0 labelling: Label Studio in `data/labels/` (report_type, context, burning, brands); CSV export plus a fixed train / held-out test split (~30% test); photos never in git.
- Field audit: all three humans take 50+ real Jodhpur reports across 3–4 wards (dumps and no-bin spots); friends in other cities send a few each.

**Wave 3 (Saturday afternoon)**
- A2 stacked verification v1: embeddings + type classifier, meta-learner, thresholds; evaluation table on the held-out set (each model alone vs the stack, precision and recall); OpenRouter benchmark of 4–5 vision models with cost per 100 photos. Only measured numbers.
- F3 Scan: cloud mode first; edge mode only if a model is ready.
- Deploy `demo` (human's OK, clean `main`); connect Amplify (human).
- Satellite history for Keru, if time allows.

**Sunday**
- F5 judge-facing README: pitch and persona, "try it in 2 minutes", architecture diagram, "Where AWS fits" table (service → file), safety model, measured results only, known limits, data sources and freshness, every AI tool used. `docs/video-script.md`: 3 minutes, AWS console visible.
- Humans record, upload and submit.

## 6. Running agents in parallel

For each task: create the issue with `gh`, then give one writing agent its own worktree and branch (`isolation: worktree`, or `claude -w <area>-<issue>-<slug>`). At most about 5 writing agents at once, never two on the same files. Each agent plans, builds, verifies, runs the reviewer subagent, pushes its branch and opens a PR. Claude merges after green CI and SHIP (proposed, 20261010-0135). Task agents skip `/handoff` and never commit `docs/status/*.md`; the lead session runs `/handoff` at checkpoints, which updates `docs/status/hem.md` (proposed, 20261010-0136).

## 7. Checks

- Every PR: CI green (contracts, frontend, python, limits), reviewer verdict SHIP, verify evidence in the PR body.
- Integration checkpoints Saturday 10:00, 14:00 and 18:00: `uv run scripts/smoke.py` against `dev`, then the end-to-end path: Snap → moderated and blurred → verified → site on the map with ward/MLA/MP → letter with verifier N/N → area score (or "not enough reports"). The lead session notes results in `docs/status/hem.md`.
- Model evaluation: the held-out table and benchmark from A2.
- Sunday: one full dry run of the video script on the deployed URL before recording.

## 8. Cut order if behind (paused)

Paused (proposed, 20261010-0134): no cuts, every task is planned. If a task slips, ask Hemang. The old order, for reference only:
YOLO and the on-phone model (cloud mode only) → trained meta-learner (keep fixed weights) → benchmark → water and construction types (labels only) → Scan mode (keep Snap) → brand labels → satellite history.
Never cut: Snap, moderation and blur, verification, the map with location, verified letters, area report on real data, the deployed URL.

## 9. Done means

- Public repo; every commit dated 8–11 Oct; all three members appear; CI green on `main`.
- `demo` deployed and the Amplify URL works.
- README written for judges; writeup sections: problem, who it is for, what changes, build, where AWS fits, data sources and freshness, limits, every AI tool used, what we learned.
- YouTube video of 3 minutes or less, public or unlisted, opens in a signed-out browser, AWS visible.
- Optional AWS Builder Center blog (top 5 win AirPods).
- Submitted before the deadline. After judging: tear down the EKS cluster and the stacks.
