# Config: one place per stage for every tunable

Every rate limit, radius, threshold, timeout and UI timing JunkSnap has is a variable with a default in code. `config/` is where you change them.

| File | Holds |
|---|---|
| `config/defaults.env` | every tunable with its code default, grouped: server (api, worker, scores, crawler), ml (`ML_*`), frontend (`VITE_*`). It mirrors the code, so edit it only when you change a code default (see Change a code default). |
| `config/dev.env`, `config/demo.env` | only what differs from the defaults for that stage, for example demo's `SNAP_PER_HOUR=100` for field-audit days. To change a value for every stage, set it in both. |

Rules, enforced by `scripts/stage_config.py` before any deploy or build starts. Each problem names the file, line and key.

- Plain `KEY=value` lines in UTF-8 without a byte order mark. Comments go on their own line, starting with `#`. No quotes, no `export`.
- A stage file may only set keys that are in `config/defaults.env`, so a typo stops the deploy.
- A value must look like its default (`scripts/config_values.py`):
  - A whole-number default (`20`) takes whole numbers. A default with a decimal point (`0.85`, `60.0`) takes any plain number. Neither may go below 0.
  - A server or ml value whose default is above 0 must stay above 0, unless its code takes 0 (`ZERO_OK`).
  - A JSON list (`[90,80,70]`) takes a non-empty JSON list of the same kind of numbers. Comma-separated numbers (`73.02,26.27`) take as many numbers.
  - So `SNAP_PER_HOUR=abc`, `0`, `1.5` or `-1` stops the deploy. The api and ml still check their own ranges when they start (see below).
- `VITE_ZONE_RADIUS_M` is fixed at 1000. The server's no-bin zone radius is code, not config, so no stage file may change it.
- Public values only. Server and ml values go into a Kubernetes ConfigMap, and `VITE_*` values are baked into the web and Android bundles. Names that look secret (`SECRET`, `PASSWORD`, `TOKEN`, `KEY`, except ids such as `..._SECRET_ID`) are refused. That is why `config/*.env` may be committed, unlike other `.env` files.
- Endpoints are not here. `VITE_API_URL`, `VITE_COGNITO_*`, `VITE_WEB_URL`, `VITE_SHARE_URL` and `VITE_API_MODE` come from the stack outputs (`deploy_web.py`) or the repository variables (Android), and the build applies them last.
- Infra wiring also stays where it is:
  - table and bucket names and the queue URL: written by `deploy.py`;
  - `AWS_REGION`, `ML_URL`, `CRAWL_MODELS` and `LLM_TASKS`: `infra/k8s/base`;
  - `JUNKSNAP_STAGE`, `CORS_ORIGINS` and `ANDROID_CERT_SHA256`: the overlays and `--origins`.

## Change a value

1. Edit `config/<stage>.env`. To change a value for every stage, set it in both `config/dev.env` and `config/demo.env`. Don't edit `config/defaults.env` for this, because `check_config.py` would fail (see Change a code default).
2. Run `uv run scripts/check_config.py`. CI runs it on every PR, along with the config tests.
3. Merge to `main`. The human deploys `demo` from a clean `main`.
4. Deploy what the value reaches:

| Value | Deploy |
|---|---|
| server or `ML_*` | `uv run scripts/deploy.py <stage>`. This is a full deploy, not a config push. It updates the `junksnap-shared` and `junksnap-<stage>` stacks, builds and pushes all three images (server, ml, crawler), writes every server and ml value into the ConfigMap literals of `infra/k8s/deploy/<stage>/`, applies the manifests, waits for api, worker and ml to roll out, and points CloudFront at the ALB. A changed value changes the ConfigMap's hash name, so the pods roll out with it, and the CronJobs read it on their next run. For demo, see the next section. |
| `VITE_*` on the web | `uv run scripts/deploy_web.py <stage>` rebuilds the web app with every `VITE_*` value. |
| `VITE_*` in the APK | Push a tag `app-v<x.y.z>` for demo, or run `android-release` by hand for dev. `build_android.py` reads `config/<stage>.env` itself, in CI and locally. A phone keeps its old values until it installs the new APK. |

Each script prints a line like `config/demo.env: ... overrides: SNAP_PER_HOUR=100` before it starts, so you can check that the change was picked up.

### Deploying demo

Demo deploys only from a clean `main`, by the human:

```
uv run scripts/deploy.py demo --human-approved --origins <origins>
```

`<origins>` must be the exact string demo runs with now. `deploy.py` writes it into the api's `CORS_ORIGINS` and the stack's `UploadOrigins` (S3 upload CORS). The api also sends link-preview visitors to the first `https` origin in it that is not localhost. A different string changes which apps can call the api and upload, and where share links land.

Copy the string from the `UploadOrigins` parameter of the `junksnap-demo` stack: the CloudFormation console's Parameters tab, or `aws cloudformation describe-stacks --stack-name junksnap-demo --query "Stacks[0].Parameters"`. Today it:

- starts with `https://junksnap.coehemang.dev`,
- keeps the Amplify URL,
- ends with `https://tauri.localhost` (the Android app's origin).

`uv run scripts/deploy_web.py demo` prints a starting point on its last `CORS:` line: the web app URL, `http://localhost:5173` and `https://tauri.localhost`. That line leaves out any other origin the stack has, such as the Amplify URL, so use it only when you mean to change the list.

### The APK's map host

The Android app has a Content Security Policy (`connect-src` in `apps/android-tauri/src-tauri/tauri.conf.json`). It lets the app reach only `tiles.openfreemap.org`, Cognito, the stage's api and its upload bucket. If `VITE_MAP_STYLE_URL` (or the tiles that style loads) moves to another host, the APK's basemap stays blank until that CSP lists the new host and a new APK is built. The web app has no such policy.

## Mirrors: one edit, both sides

The app repeats some server rules so that it can warn before the api refuses. Each mirror follows its server value unless the stage file sets the `VITE_` one itself. So `VOTE_RADIUS_M=500` in `config/dev.env` also makes the dev app use 500. Deploy both the server and the web app (and build a new APK).

| Server | Frontend |
|---|---|
| `VOTE_RADIUS_M` | `VITE_VOTE_RADIUS_M` |
| `FLAG_RADIUS_M` | `VITE_FLAG_RADIUS_M` |
| `CLEANUP_NEAR_SITE_M` | `VITE_CLEANUP_RADIUS_M` |
| `TARGET_MAX_M` | `VITE_TARGET_MAX_M` |
| `SITE_MERGE_RADIUS_M` | `VITE_SITE_MERGE_RADIUS_M` |
| `MIN_VERIFIED_REPORTS` | `VITE_MIN_VERIFIED_REPORTS` |
| `SCAN_MAX_SECONDS` | `VITE_SCAN_MAX_DURATION_MS` (x 1000) |
| `SCAN_MAX_MB` | `VITE_SCAN_MAX_BYTES` (x 1048576) |

Other values have to be changed together by hand:

- `ML_VERIFY_TIMEOUT_S` (worker) and `ML_WORKER_BUDGET_S` (ml) must be equal. `check_config.py` checks this for each stage.
- `QUEUE_VISIBILITY_SECONDS` and `QUEUE_MAX_RECEIVE_COUNT` repeat the queue's own settings in `infra/aws/stage.yaml`.
- `VITE_PRESIGN_REUSE_MS` must stay under `PRESIGN_TTL_SECONDS` in milliseconds.
- The api and ml check their own ranges and combinations when they start, for example `SITE_SAME_SPOT_M` at most `SITE_MERGE_RADIUS_M`. A value the loader lets through but the code refuses stops the new pods, so the rollout in `deploy.py` fails. The old api and ml pods keep serving. The worker (`Recreate`, so its old pod is already gone) and the CronJobs stay down until the value is fixed. The app instead warns and uses its own default.

## Change a code default

`config/defaults.env` repeats the code's defaults, and `check_config.py` checks it against their documentation. Edit it only when you change a default in the code itself. Do it in the same PR as:

- the code default;
- its documentation: the row in the Environment variables table of `contracts/README.md` (server and ml), or the line in `frontend/.env.example` (frontend).

The new default then reaches every stage that does not override it, on that stage's next deploy.

## Add a tunable

Give it a default in code, document it (server and ml: the Environment variables table in `contracts/README.md`; frontend: `frontend/.env.example`), and add it to `config/defaults.env` with the same default. Write the default with a decimal point if the code takes fractions. If the code takes 0 for a default above 0, add the key to `ZERO_OK` in `scripts/config_values.py`. `scripts/check_config.py` fails until the code's documentation and `config/` agree. It also fails when a committed kustomization under `infra/k8s` sets a tunable, because `config/` is the only place to set one.
