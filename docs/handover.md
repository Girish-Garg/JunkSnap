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
- Take field-audit photos as real reports through the app (not used for training).
- Record and upload the YouTube video, publish the optional Builder Center blog, fill the submission form, ask organisers on Discord.

Claude merges PRs itself once CI is green and the reviewer says SHIP: squash through the GitHub API, commit message ending in one alternating co-author line (proposed, 20261010-0135).

## 3. Machine setup

- Tools: git, gh (logged in, write access to the repo), uv, Node 24, Python 3.12+ (the session hook runs `python`; if `python` opens the Microsoft Store, disable that alias in Windows settings), AWS CLI v2 (`winget install --id Amazon.AWSCLI -e`, with the human's OK).
- AWS: the human runs `aws login --profile junksnap` himself, region `ap-south-1`. It is a root session with short-lived credentials that refresh automatically; no long-lived key is saved (proposed, 20261010-0132). Check with `aws sts get-caller-identity --profile junksnap`. Agents never run commands that change billing or account settings; read-only checks by the lead session are fine.
- The account finished card verification on 10 Oct and all services are active. Read-only plan check run by the lead session on 10 Oct 2026 (`aws freetier get-account-plan-state`): FREE plan, 100.0 USD credits, expires 2027-04-09. Upgrading keeps the credits. Bedrock Claude Sonnet 4.6, Haiku 4.5 and Nova work from ap-south-1; the Claude 5 family does not (proposed, 20261010-0133).
- Windows: `git config --global core.longpaths true`.
- Tear down the EKS cluster and the stacks after judging.

## 4. Decisions (all accepted except the changes marked proposed; they replace the earlier satellite-only "Saboot" plan)

Decisions 6, 7 and 14 include the changes of the night of 10 Oct, recorded in `docs/decisions/20261010-0130` to `-0137` and marked "(proposed, <file>)" until Hemang confirms. Proposed, 20261010-0137: LLMs are the last step in detection, and their main use is the ward-data crawler (task W1). Decisions 16 to 21 were confirmed in chat on 10 Oct and are accepted (`20261010-0159` to `-0203`, and `-0227`); they also change decisions 4 to 10 and 14 where marked.

1. **Product:** JunkSnap, community-reported, ML-verified civic waste reporting for all of India, Jodhpur as the pilot. Pitch: dumps are not only the authorities' failure; people dump on empty plots, often because there is nowhere legal to put waste. JunkSnap measures all three causes.
2. **Report types:** (a) waste dump, tagged vacant plot, roadside, drain or other; (b) no bin / no pickup; (c) contaminated water: stagnant, sewage, foam, choked drain; (d) open construction: uncovered debris, dusty site. (a) and (b) must ship; (c) and (d) should ship. Potholes are a roadmap line only.
3. **Capture:** in-app camera only, as Snap or live Scan (phone on a scooter). No drone, no Watch mode; drones and CCTV are roadmap.
4. **Edge first, cloud fallback:** the phone runs a tiny YOLO only if a startup probe passes (WebGPU or WASM, under ~300 ms per frame), for live boxes and frame hints; otherwise cloud mode runs without hints. Scan records video (at most 60 s, 720p, 40 MB) with a GPS track in sync; the worker cuts one frame per second, maps it onto the track, drops frames without a fix within 3 s and 50 m, and runs each kept frame as a normal report (accepted, 20261010-0203; replaces the frame-per-second upload). Offline queue in IndexedDB. The server always re-verifies.
5. **Moderation and authenticity:** client SHA-256 of the original; Rekognition moderation gate; blur faces and number plates before any public copy; originals and scan videos private under KMS; no photos of people dumping; inside-India check, fresh timestamp, perceptual-hash duplicate check, per-device token, rate limits, reporter reputation; free text moderated for toxicity and personal data on Bedrock (Claude Haiku 4.5, India profile), because Amazon Comprehend is not enabled on this account.
6. **Stacked verification** (run by the `worker` reading SQS, which calls the Python `ml` service's `POST /internal/verify`; proposed, 20261010-0131; accepted, 20261010-0159): Rekognition labels, a YOLO detector (ONNX in the `junksnap-ml` image) and an embedding model with a small type classifier (Titan image embeddings `amazon.titan-embed-image-v1`, on-demand in ap-south-1) run in parallel; a vision judge runs on every report, scan frame and cleanup and decides types the detectors were not trained on (decision 20261011-0005; type, burning, context, readable brands, rationale; never trusted for counts or boxes); a logistic-regression meta-learner, also fed GPS accuracy, reputation and corroborations, gives a calibrated probability: ≥0.85 auto-verified, 0.5–0.85 community check, <0.5 rejected. Strong disagreement always goes to community check. Build order: fixed weights over Rekognition + judge, then embeddings + meta-learner, then YOLO. The same call returns insights (decision 19).
7. **Model-agnostic LLM layer:** one shape in two implementations: TypeScript in `backend/server` for letters and note moderation, Python in `backend/ml` for the judge (accepted, 20261010-0159). `TaskConfig {provider, model, fallback[]}` per task. Bedrock is the default. Judge: Amazon Nova Lite, then Nova Pro, then the OpenAI API; Bedrock refuses Claude on this account, so Claude reaches the judge only through `LLM_TASKS` (decision 20261011-0005). Letters: Claude Sonnet 4.6 (global profile), then Claude Haiku 4.5 (India profile), then Amazon Nova Pro, then the OpenAI API, then OpenRouter (https://openrouter.ai/api/v1), which is also the benchmark (proposed, 20261010-0133). Same prompts and JSON schema for all models; validate and retry on the next provider; log provider, model and version on every decision. Only blurred images go to any model; OpenRouter excludes providers that store or train on data, and has a credit limit.
8. **Sites:** reports of the same type within 20 m always merge into one site, and up to 40 m when similar in embedding space (decision 20261011-1610); open → cleaned (ML-checked after-photo only) → reopened. Company labels only when readable and above the confidence threshold (Rekognition DetectText + brand-to-parent-company map with sources, run in the worker).
9. **Location:** Amazon Location Places v2 reverse geocoding (state, district, town; no place index) plus point-in-polygon for assembly (MLA) and Lok Sabha (MP) seats (2008 delimitation boundaries; check the licence). Assembly seats only in Rajasthan for now, null elsewhere, so letters Cc the MP only; Lok Sabha seats whose boundary predates re-delimitation (Assam, Jammu and Kashmir, Ladakh) are `outdated` and never Cc'd. Wards only where open ward maps exist (none in the fixtures). Jodhpur and Jaipur are single corporations since November 2025 (`jodhpur-mc`, `jaipur-mc`). Representatives: all MPs, Rajasthan MLAs first; each with an as-of date and source; no party field.
10. **Community:** neighbour confirm/reject votes with reputation, one counted vote per user per site (decision 21); "me too" photos; cleanup closes a site only with an after-photo; a human moderator settles disputes.
11. **Area scores**, formulas versioned in `docs/decisions/`: City (median days to clear, % cleared within 7 days, % re-dumped, response to no-bin reports); Citizen (new verified dumps per km² per month, share on vacant plots, drains and roadsides, re-dumping; adjusted for bin access); Bin access (confirmed no-bin reports, distance to the nearest legal disposal point). Diagnosis: dumping + no bins = infrastructure gap; dumping + bins = behaviour; slow clearing = city response; re-dumping = repeat spot. Guardrails: area level only, ≥10 verified reports, counts shown, pilot flag, first-48-hours data only for the pilot, never invented history.
12. **Letters:** To the local body head (legally responsible, 74th Amendment); Cc councillor, MLA and MP "for attention"; neutral. Routing: city body for every type; state pollution board for burning, water and construction dust; Swachhata and CPGRAMS nationwide; District Collector; Rajasthan Sampark in Rajasthan. Code picks rules and addressees, the model writes prose, a verifier checks every quote word for word, with a template fallback. Texts: SWM Rules 2026 (S.O. 388(E)) rules 5(1)(f), 39(2)(vii) and (xi), 15(1) and the collection-duty clause; plastic EPR rules (2026 amendment G.S.R. 237(E)); Water Act 1974; current construction and demolition waste rules; CPCB dust guidelines. Quotes stay in official English or Hindi.
13. **Should ship:** satellite history for large sites (for example Keru, Jodhpur); packaging-type split per area.
14. **Engineering:** strict OOP, layers and size limits (`docs/working.md`), the same in TypeScript and Python. Services run on Kubernetes: one EKS Auto Mode cluster `junksnap` in ap-south-1, namespaces `junksnap-dev` and `junksnap-demo` (proposed, 20261010-0130); workloads `api`, `worker` and the `scores` CronJob from image `junksnap-server`, and `ml` from image `junksnap-ml` (accepted, 20261010-0159). Per-stage CloudFormation stacks `junksnap-dev` and `junksnap-demo`, tags `project=junksnap`.
15. **Process:** no lane guard and no roster; one person drives the build; every writing agent gets its own branch and worktree. Commit trailers rotate between Hemang and Girish, never an AI trailer (see AGENTS.md).
16. **Language split** (accepted, 20261010-0159): only the ML side is Python, in `backend/ml` (service `ml`, cluster-internal `POST /internal/verify` only; training and dataset tooling in `backend/ml/training/`). Everything else is TypeScript 6.0.3 on Node 24 in one project, `backend/server`, one image running the workloads `api` (all public routes, letters included), `worker` and `scores`. TypeScript stays below 7 because typescript-eslint supports only `typescript <6.1`. Data tooling (ward crawler, rule checks) may stay Python. `backend/agent` becomes `backend/ml`; `backend/pipeline` is deleted once the TS server lands.
17. **ML data** (accepted, 20261010-1245, which supersedes 0200): openly licensed public waste datasets only (licence checked per set; images in S3, never git), split 80/10/10 with a fixed seed. Results tables use the public test split and name teacher-made boxes.
18. **UI style** (accepted, 20261010-0201): minimal custom components; map-app patterns (full-bleed map, floating search bar, filter chips, draggable bottom sheet with peek, half and full and an action row, one camera button in the thumb zone); no gradients, glassmorphism, emoji or purple; Noto Sans and Noto Sans Devanagari; 48 px targets; WCAG AA. Details in `frontend/DESIGN.md`.
19. **ML insights** (accepted, 20261010-0202): per report, composition by material, a size class (never tonnage) and hazards; per site, those merged plus schools, hospitals, water bodies and open drains within 100 m from OpenStreetMap; per area, composition, hazardous share, top brands, repeat spots, hour and day pattern, sites near schools or water. Only measured numbers, each with its source.
20. **Scan video** (accepted, 20261010-0203): see decision 4. Routes `POST /scans/presign`, `POST /scans`, `GET /scans/{id}`; the video stays private and never goes to a model.
21. **Accounts** (accepted, 20261010-0227): an Amazon Cognito user pool per stage, email and password with an emailed code, forgot-password by code. Browsing is open; reports, scans, votes, cleanups and letters need a signed-in user (Cognito ID token as `Authorization: Bearer`, checked against the pool's JWKS). `user_id` is the opaque `sub`; `device_token` stays; reputation and rate limits count per user and per device. No user's name or email in any shape, table or log.

## 5. Task list (one GitHub issue, branch and PR per task)

Done: T0 tooling (PR 6), C1 contracts v1 (PR 14), S1 Python skeletons (PR 15; `backend/pipeline` is now retired), the comment rule (PR 17), S2 server skeleton (PR 28: TypeScript 6.0.3, Fastify 5, entry files `web.ts`, `worker.ts`, `scores.ts`, generated contract types), C2 contracts v1.1 for insights, scans, accounts and ward records (issue 25).

Order: P1, AU1, SC1, D1, L1, A1, I1 and F1 in parallel, and the rest as their inputs merge. A2 and A5 train and evaluate on public data only (decision 1245). After any schema change, regenerate `backend/server/src/contracts/*.gen.ts` in the same PR.

**TypeScript, `backend/server`**
- P1 intake and worker (issue 11): presign (regional S3 endpoint), `POST /reports`, `GET /reports/{id}`, the SQS consumer and `ReportPipeline` with `needs_review` on the last receive; calls `ml` at `ML_URL`.
- AU1 accounts (issue 34): Cognito ID token check against the pool's JWKS in the api, `user_id` from `sub`, 401 `unauthorized` and 403 `forbidden`, the `users` table, per-user and per-device rate limits and reputation (decision 20261010-0227).
- SC1 scan intake (issue 35): `POST /scans/presign`, `POST /scans`, `GET /scans/{id}`, frame sampling with GPS interpolation, frame reports with derived ids (decision 20261010-0203).
- D1 moderation (issue 13): moderation gate, face and plate blur, authenticity checks, note moderation on Bedrock → `moderation_result`; tests with stubbed Rekognition; a real run on 5 photos on `dev`.
- D2 location (issue 18): Amazon Location Places v2 (no place index), assembly seats (Rajasthan only, else null) and Lok Sabha seats (`status: outdated` for Assam, Jammu and Kashmir, Ladakh), wards only with an open map, local body (`jodhpur-mc`, `jaipur-mc`), representatives, nearby places within 100 m from the crawler's map layers → `location_lookup` and `site.insights.near`; tests with known points.
- D3 sites and votes (issue 19): merging, lifecycle, votes and the community check, cleanup, site routes, insight merge → `site`.
- D4 scores (issue 20): city, citizen and bin-access scores with guardrails, diagnosis, area insights, the CronJob and the route → `ward_scores`.
- A3 brands (issue 21): in the worker, Rekognition DetectText plus the parent-company map with sources → `brand_label`; precision on 10 close-up packet photos.
- A4 rulebook and letters (issue 22): in the api, hashed official texts, hand-checked rules JSON, routing table (Cc only seats that exist, never the MP of an `outdated` seat), letters service and quote verifier → `letter_draft`; a test that a misquote fails.
- L1 TS LLM layer (issue 29): `LlmProvider` for Bedrock, OpenAI and OpenRouter, `ProviderRouter`, `TaskConfig` defaults per decision 20261010-0133, validation and fallback; used by A4 and D1.

**Python, `backend/ml` and data tooling**
- M0 rename `backend/agent` to `backend/ml` (in flight in another PR).
- A1 ml verify (issue 12): `POST /internal/verify`, the Python LLM layer for the judge, Rekognition signal, judge v0, fixed-weight combiner → `verification_result`; tests with stubs; a printed run on 10 real photos.
- DS1 dataset (issue 26): openly licensed public waste datasets with licences checked, manifests in `data/datasets/`, images in S3 under `datasets/`; a fixed 80/10/10 split of the public data (no field photos).
- A2 YOLO, embeddings and meta-learner: embeddings and type classifier, YOLO, meta-learner, thresholds; evaluation table on the public test split (each model alone vs the stack, precision and recall; `docs/ml/eval.md`); OpenRouter benchmark of 4–5 vision models with cost per 100 photos. Only measured numbers.
- A5 insights (issue to create): composition, size class and hazards in `verification_result.insights`, each with its model; evaluated on the public test split.
- W1 ward-data crawler (issue 9, proposed 20261010-0137): offline Python job over official pages and OpenStreetMap → `data/wards/<city>.json` with `records` (each a `ward_record`, the contract shape taken from this task's branch) and `map_layers` (disposal, school, hospital, water, drain); source URL, `fetched_at` and page SHA-256 on every value; offices and seats only; reviewed before use. Jodhpur first. Feeds D2 and D4.

**Infra**
- I1 infra (issue 10): eksctl `infra/eks/cluster.yaml` for the EKS Auto Mode cluster `junksnap`. CloudFormation `infra/aws/stage.yaml` with a `Stage` parameter: private uploads bucket (KMS, presigned PUT, `scans/` prefix), public blurred bucket, DynamoDB tables including `scans` and `users`, SQS + dead-letter queue, a Pod Identity role per workload (the worker's with `geo-places:ReverseGeocode`; Places v2 needs no place index), the Cognito user pool and app client, Secrets Manager placeholders. ECR repositories `junksnap-server` and `junksnap-ml`. Kustomize `infra/k8s/` (base, overlays/dev, overlays/demo): `api`, `worker`, `ml`, the `scores` CronJob, an ALB ingress with CORS behind CloudFront. Deploy `dev` only. Done when curl presign → PUT → POST /reports through CloudFront lands in DynamoDB.

**Frontend**
- F1 frontend scaffold (issue 8): Vite + React + TypeScript + MapLibre, mobile-first; mock mode reads `contracts/fixtures/`; India map opening on Jodhpur; site markers by type; site panel; Hindi/English with Noto Sans Devanagari. ESLint: max-lines 250 (.tsx 150), max-lines-per-function 30, complexity 8, max-params 4, max-depth 3, no-explicit-any; tsconfig strict; services as classes in a ServiceContainer; `amplify.yml`.
- F2 Snap: in-app camera, GPS, client hash, type and context pickers, presign → PUT → submit, status polling, offline queue; mock first, then live on `dev`. Sign-in (Cognito) before the first Snap (decision 20261010-0227).
- F4 community + area pages: verify, me-too, cleanup after-photo, reputation; area page with scores, diagnosis and counts; letter preview with citation cards and print-to-PDF.
- F3 Scan: cloud mode first; edge mode only if a model is ready. Scan records video with a synced GPS track (decision 20261010-0203).
- F5 judge-facing README (Sunday): pitch and persona, "try it in 2 minutes", architecture diagram, "Where AWS fits" table (service → file), safety model, measured results only, known limits, data sources and freshness, every AI tool used. `docs/video-script.md`: 3 minutes, AWS console visible.

**Saturday 07:30–10:00: field data**
- D0 labelling: dropped (decision 20261010-1245); field photos are not labelled for training.
- Field audit: all three humans take 50+ real Jodhpur reports across 3–4 wards (dumps and no-bin spots); friends in other cities send a few each.

**Saturday afternoon and Sunday**
- A2 and A5 on the public data; F3 Scan.
- Deploy `demo` (human's OK, clean `main`); connect Amplify (human).
- Satellite history for Keru, if time allows.
- Humans record, upload and submit.

## 6. Running agents in parallel

For each task: create the issue with `gh`, then give one writing agent its own worktree and branch (`isolation: worktree`, or `claude -w <area>-<issue>-<slug>`). At most about 5 writing agents at once, never two on the same files. Each agent plans, builds, verifies, runs the reviewer subagent, pushes its branch and opens a PR. Claude merges after green CI and SHIP (proposed, 20261010-0135). Task agents skip `/handoff` and never commit `docs/status/*.md`; the lead session runs `/handoff` at checkpoints, which updates `docs/status/hem.md` (proposed, 20261010-0136).

## 7. Checks

- Every PR: CI green (contracts, frontend, server, python, limits), reviewer verdict SHIP, verify evidence in the PR body.
- Integration checkpoints Saturday 10:00, 14:00 and 18:00: `uv run scripts/smoke.py` against `dev`, then the end-to-end path: Snap → moderated and blurred → verified → site on the map with ward/MLA/MP → letter with verifier N/N → area score (or "not enough reports"). The lead session notes results in `docs/status/hem.md`.
- Model evaluation: the table and benchmark from A2, and the insight table from A5, on the public test split (`docs/ml/eval.md`).
- Sunday: one full dry run of the video script on the deployed URL before recording.

## 8. Cut order if behind (paused)

Paused (proposed, 20261010-0134): no cuts, every task is planned. If a task slips, ask Hemang. The cut order stays paused after the language split: the new tasks SC1, AU1, L1 and A5 are planned too. The old order, for reference only:
YOLO and the on-phone model (cloud mode only) → trained meta-learner (keep fixed weights) → benchmark → water and construction types (labels only) → Scan mode (keep Snap) → brand labels → satellite history.
Never cut: Snap, moderation and blur, verification, the map with location, verified letters, area report on real data, the deployed URL.

## 9. Done means

- Public repo; every commit dated 8–11 Oct; all three members appear; CI green on `main`.
- `demo` deployed and the Amplify URL works.
- README written for judges; writeup sections: problem, who it is for, what changes, build, where AWS fits, data sources and freshness, limits, every AI tool used, what we learned.
- YouTube video of 3 minutes or less, public or unlisted, opens in a signed-out browser, AWS visible.
- Optional AWS Builder Center blog (top 5 win AirPods).
- Submitted before the deadline. After judging: tear down the EKS cluster and the stacks.
