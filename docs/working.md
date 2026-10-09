# Working agreement: structure, size limits and strict OOP

Every person and every agent follows this file, and CI enforces the limits. To break a rule, first record a decision with `/decide` explaining why.

## 1. Folder structure

```text
saboot/                       repo (product: JunkSnap)
├─ AGENTS.md  CLAUDE.md  README.md
├─ docs/                      handover.md, architecture.md, working.md, features.json
│  ├─ decisions/              one file per decision
│  ├─ status/                 one file per person
│  └─ research/               background, read-only
├─ contracts/                 schemas/, fixtures/, README.md (source of truth)
├─ frontend/
│  ├─ src/
│  │  ├─ app/                 App.tsx, routes, ServiceContainer (composition root)
│  │  ├─ domain/              types mirroring contracts, small domain classes
│  │  ├─ services/            classes: ApiClient, UploadQueue, CameraCapture, GeoLocator,
│  │  │                       CapabilityProbe, ScanController, EdgeDetector
│  │  ├─ features/<name>/     snap, scan, map, site, community, area, letters: components/, hooks/
│  │  ├─ layers/              one MapLibre layer per file
│  │  ├─ ui/                  shared presentational components
│  │  └─ i18n/                en.json, hi.json
│  ├─ public/models/          on-phone model files
│  └─ tests/
├─ backend/
│  ├─ server/                 TypeScript 6.0.3, Node 24: one project, one image (junksnap-server)
│  │  ├─ src/domain/  src/ports/  src/services/  src/adapters/  src/settings/
│  │  ├─ src/handlers/        entry files web.ts (workload api), worker.ts, scores.ts; <topic>Routes.ts
│  │  ├─ src/contracts/       types and validators generated from contracts/schemas (*.gen.ts)
│  │  ├─ scripts/genContracts.ts, tests/
│  │  └─ package.json, package-lock.json, tsconfig.json, eslint.config.js, Dockerfile, README.md
│  ├─ ml/                     Python service `ml` (image junksnap-ml); renamed from backend/agent
│  │  ├─ src/ml/{domain,ports,adapters,services,handlers}/
│  │  ├─ training/            dataset tooling, YOLO, embedding classifier, meta-learner training
│  │  └─ tests/{unit,contract}/, pyproject.toml, uv.lock, Dockerfile
│  └─ pipeline/               retired; deleted once backend/server lands. Add no code here
├─ infra/                     eks/ (eksctl), aws/ (CloudFormation), k8s/ (Kustomize base, overlays)
├─ data/                      boundaries/, representatives/, labels/, wards/, ward_crawler/,
│                             datasets/ (manifests and licences only; small files only)
└─ scripts/                   validate_contracts.py, smoke.py, check_limits.py
```

Only the ML side is Python (decision 20261010-0159). Data tooling (the ward crawler, rule checks) may stay Python; everything else in the backend is TypeScript in `backend/server/`.

Large files (images, models over 5 MB, rasters, Parquet) live in S3, never in git.

## 2. Layers and dependency direction

The same layers apply to both languages: `backend/server` (TypeScript) and `backend/ml` (Python).

| Layer | Contains | May import |
|---|---|---|
| `domain/` | Entities, value objects, domain errors | standard library; generated contract types, type-only |
| `ports/` | Abstract classes (Python) or interfaces (TypeScript) for every outside capability | `domain`; generated contract types, type-only |
| `services/` | Use-case classes; all business logic | `domain`, `ports` |
| `adapters/` | Port implementations: AWS SDK v3 or boto3, Bedrock, OpenAI, OpenRouter, ONNX Runtime, Pillow, turf | `domain`, `ports`, third-party SDKs |
| `handlers/` | Entry points (Fastify route plugins and the `web.ts`, `worker.ts` and `scores.ts` entry files in TypeScript; the FastAPI router in `ml`) that build the object graph and call one service | anything in the same project |

Imports point down this table only. `domain` and `ports` may import the generated contract types (`src/contracts/*.gen.ts`) with `import type` only, never the generated schemas or validators, which are runtime code (decision 20261010-0344). Services never import an AWS SDK or any other SDK. `backend/server` and `backend/ml` never import each other; they exchange contract shapes over HTTP. Inside `backend/server`, the three entry points share `domain`, `ports`, `services` and `adapters`, and a handler never imports another entry point's handlers.

Frontend direction: components → hooks → services → `ApiClient`. Components hold no business logic; hooks only adapt service state to React.

## 3. Strict OOP rules

1. One responsibility per class. If a class name needs "And", split it.
2. Depend on abstractions: services receive ports through their constructor and never create their own dependencies.
3. Constructor injection only. No service locators, no global mutable state, no singletons. One exception: each process (the `api`, `worker` or `scores` entry point, the `ml` app) builds its object graph once at startup and reuses it.
4. Value objects are immutable: `@dataclass(frozen=True)` or frozen pydantic models in Python, `readonly` in TypeScript.
5. Entities protect their own state. Changes go through methods that enforce the rules, for example `site.mark_cleaned(after_photo)` raises `InvalidTransition`; nothing sets `site.status` from outside.
6. Encapsulation: no public mutable attributes. Private members start with `_` in Python or use `private` / `#` in TypeScript.
7. Extend by adding classes, not branches. New report types, LLM providers, verification signals and moderation checks are new classes registered in a factory, never another `if type == ...`.
8. Composition over inheritance. Inherit only from an abstract port or a declared base (`Signal`, `Check`, `LlmProvider`), at most 2 levels deep.
9. Tell, don't ask: call behaviour on the object that owns the data instead of pulling its data out and deciding elsewhere.
10. Free functions are allowed only as entry points (route functions, the `worker` and `scores` mains) and as pure helpers of 10 lines or fewer in a `utils` module.
11. Errors: one exception hierarchy per project, rooted at `JunkSnapError`. Adapters translate SDK errors into domain errors. No bare `except`, no silent fallbacks.
12. Types everywhere: Python hints checked with `mypy --strict` on `src/`; TypeScript with `strict: true` and no `any`.
13. Comments and docstrings are one line, written only when the code can't say it: a why, a gotcha, a unit. Never restate the code; no multi-paragraph docstrings or JSDoc blocks; no filler words.

| Pattern | Where |
|---|---|
| Strategy | `LlmProvider` (Bedrock, OpenAI, OpenRouter; in both projects); `Signal` (Rekognition, YOLO, embedding; in `ml`) |
| Factory | `ProviderFactory` builds providers from `TaskConfig`; `CheckFactory` builds moderation checks; a router registry and a settings registry wire the `api` routes |
| Chain of responsibility | Moderation and authenticity `Check`s run in order; the first failure stops the chain |
| Composite | `StackedVerifier` combines signals and the meta-learner |
| Repository | DynamoDB access: `SiteRepository`, `ReportRepository` |
| Adapter | Every AWS or third-party SDK call |

## 4. Size limits (enforced in CI)

| Unit | Limit | Checked by |
|---|---|---|
| Source file (`.py`, `.ts`) | 250 lines | `scripts/check_limits.py` |
| React component file (`.tsx`) | 150 lines | ESLint `max-lines` and `check_limits.py` |
| Class | 150 lines | `check_limits.py` (Python AST); the file limit covers TypeScript |
| Function or method | 30 lines | `check_limits.py` (Python AST), ESLint `max-lines-per-function`; ruff `max-statements = 25` as a second guard |
| Parameters | 4, otherwise pass a parameter object | ruff `max-args`, ESLint `max-params` |
| Cyclomatic complexity | 8 | ruff `C901`, ESLint `complexity` |
| Nesting depth | 3 | ESLint `max-depth`; code review for Python |
| Test file | 400 lines | `check_limits.py` |
| `AGENTS.md`, other `AGENTS.md`, status file, decision file | 120, 60, 30, 25 lines | `check_limits.py` |

File limits skip blank lines and comments; class and function limits measure the span. Lockfiles, `contracts/fixtures/` and generated or minified files are exempt.

TypeScript in `backend/server` has the same limits as any `.ts` file: 250 lines per file, checked by `check_limits.py`. Its ESLint config uses the frontend's rules: `max-lines` 250, `max-lines-per-function` 30, `complexity` 8, `max-params` 4, `max-depth` 3, `no-explicit-any`. One class per file, so the file limit also bounds each class. Tests may exceed the 30-line function limit: the `backend/server` ESLint config turns `max-lines-per-function` off for `tests/**` and allows 400 lines per test file. Generated `src/contracts/*.gen.ts` files are exempt.

## 5. Naming

- Python: modules in `snake_case`, classes in `PascalCase`. Ports are named for the capability (`ImageModerator`, `Geocoder`); adapters for the technology plus the port (`RekognitionImageModerator`, `AmazonLocationGeocoder`); test fakes start with `Fake`.
- TypeScript: classes and components in `PascalCase`, one per file, with the file named after it. Hooks are `useX`; functions and variables are `camelCase`. In `backend/server`, ports and adapters follow the Python naming above.
- Branches: `<area>-<issue>-<slug>`, for example `fe-12-snap`, `server-24-skeleton` or `ml-12-judge`.

## 6. Testing

- Every service class has unit tests that use in-memory fakes of its ports. Unit tests never touch the network. Vitest in `backend/server` and `frontend`, pytest in `backend/ml`.
- Contract tests: every domain model round-trips the fixtures in `contracts/fixtures/`.
- Each adapter gets a thin integration test that runs only with `RUN_AWS_TESTS=1`.
- A bug fix starts with a failing test.

## 7. Config, logging and secrets

- Config comes from the environment variables listed in `contracts/README.md`, loaded once into a typed `Settings` object (zod in `backend/server`, pydantic in `backend/ml`) and passed by constructor.
- Logs are structured JSON with a request id. Never log images, tokens, phone numbers, emails or names.
- Secrets live in Secrets Manager. Nothing secret goes in git or in a committed `.env` file.

## 8. Definition of done

- Lint, type check, tests and `scripts/check_limits.py` pass locally and in CI.
- Contract fixtures still validate.
- The PR shows evidence from the verify command and decisions are recorded. Task agents skip `/handoff` and never commit `docs/status/` (proposed, 20261010-0136).

## 9. Commands

| Folder | Verify |
|---|---|
| `backend/server` | `cd backend/server; npm ci; npm run lint; npm run typecheck; npm test; npm run build` |
| `backend/ml` | `cd backend/ml; uv sync; uv run ruff check .; uv run mypy --strict src; uv run pytest -q` |
| `frontend` | `cd frontend; npm ci; npm run lint; npm test -- --run; npm run build` |
| Python data tooling | `uv run <script>` (PEP 723 header) |
| Repo | `uv run scripts/validate_contracts.py; uv run scripts/check_limits.py` |
| After any schema change | `cd backend/server; npm ci; npm run gen:contracts`, then commit `src/contracts/*.gen.ts` in the same PR; the server CI job fails on stale files |
