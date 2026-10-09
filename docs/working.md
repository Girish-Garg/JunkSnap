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
│  ├─ pipeline/               Python package `pipeline`
│  └─ agent/                  Python package `agent`
│                             each: pyproject.toml, uv.lock,
│                             src/<pkg>/{domain,ports,adapters,services,handlers}/, tests/{unit,contract}/
├─ infra/                     IaC template, stubs/
├─ data/                      boundaries/, representatives/, labels/ (small files only)
└─ scripts/                   validate_contracts.py, smoke.py, check_limits.py
```

Large files (images, models over 5 MB, rasters, Parquet) live in S3, never in git.

## 2. Layers and dependency direction

| Layer | Contains | May import |
|---|---|---|
| `domain/` | Entities, value objects, domain errors | standard library only |
| `ports/` | Abstract base classes for every outside capability | `domain` |
| `services/` | Use-case classes; all business logic | `domain`, `ports` |
| `adapters/` | Port implementations: boto3, Bedrock, OpenRouter, shapely, Pillow | `domain`, `ports`, third-party SDKs |
| `handlers/` | Lambda entry points that build the object graph and call one service | anything in the same package |

Imports point down this table only. Services never import boto3 or any SDK. `pipeline` and `agent` never import each other; they exchange contract shapes.

Frontend direction: components → hooks → services → `ApiClient`. Components hold no business logic; hooks only adapt service state to React.

## 3. Strict OOP rules

1. One responsibility per class. If a class name needs "And", split it.
2. Depend on abstractions: services receive ports through their constructor and never create their own dependencies.
3. Constructor injection only. No service locators, no global mutable state, no singletons. One exception: a Lambda handler may cache its composed object graph at module level for warm starts.
4. Value objects are immutable: `@dataclass(frozen=True)` or frozen pydantic models in Python, `readonly` in TypeScript.
5. Entities protect their own state. Changes go through methods that enforce the rules, for example `site.mark_cleaned(after_photo)` raises `InvalidTransition`; nothing sets `site.status` from outside.
6. Encapsulation: no public mutable attributes. Private members start with `_` in Python or use `private` / `#` in TypeScript.
7. Extend by adding classes, not branches. New report types, LLM providers, verification signals and moderation checks are new classes registered in a factory, never another `if type == ...`.
8. Composition over inheritance. Inherit only from an abstract port or a declared base (`Signal`, `Check`, `LlmProvider`), at most 2 levels deep.
9. Tell, don't ask: call behaviour on the object that owns the data instead of pulling its data out and deciding elsewhere.
10. Free functions are allowed only as Lambda handler entry points and as pure helpers of 10 lines or fewer in a `utils` module.
11. Errors: one exception hierarchy per package, rooted at `JunkSnapError`. Adapters translate SDK errors into domain errors. No bare `except`, no silent fallbacks.
12. Types everywhere: Python hints checked with `mypy --strict` on `src/`; TypeScript with `strict: true` and no `any`.

| Pattern | Where |
|---|---|
| Strategy | `LlmProvider` (Bedrock, OpenRouter); `Signal` (Rekognition, YOLO, embedding) |
| Factory | `ProviderFactory` builds providers from `TaskConfig`; `CheckFactory` builds moderation checks |
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

## 5. Naming

- Python: modules in `snake_case`, classes in `PascalCase`. Ports are named for the capability (`ImageModerator`, `Geocoder`); adapters for the technology plus the port (`RekognitionImageModerator`, `AmazonLocationGeocoder`); test fakes start with `Fake`.
- TypeScript: classes and components in `PascalCase`, one per file, with the file named after it. Hooks are `useX`; functions and variables are `camelCase`.
- Branches: `<area>-<issue>-<slug>`, for example `fe-12-snap` or `agent-7-judge`.

## 6. Testing

- Every service class has unit tests that use in-memory fakes of its ports. Unit tests never touch the network.
- Contract tests: every domain model round-trips the fixtures in `contracts/fixtures/`.
- Each adapter gets a thin integration test that runs only with `RUN_AWS_TESTS=1`.
- A bug fix starts with a failing test.

## 7. Config, logging and secrets

- Config comes from the environment variables listed in `contracts/README.md`, loaded once into a typed `Settings` object and passed by constructor.
- Logs are structured JSON with a request id. Never log images, tokens, phone numbers or names.
- Secrets live in Secrets Manager. Nothing secret goes in git or in a committed `.env` file.

## 8. Definition of done

- Lint, type check, tests and `scripts/check_limits.py` pass locally and in CI.
- Contract fixtures still validate.
- The PR shows evidence from the verify command, `/handoff` has been run and decisions are recorded.
