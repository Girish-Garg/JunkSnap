# backend/agent: LLM layer, stacked verification, brands, rulebook, letters

Python package `agent`, laid out per docs/working.md: `src/agent/{domain,ports,adapters,services,handlers}/`, tests in `tests/unit` and `tests/contract`. It runs as the `agent` workload on EKS: a FastAPI app with one public route, `POST /sites/{id}/letters`, and cluster-internal routes that the `worker` calls over HTTP for verification and brand labels.

## Commands

```
cd backend/agent
uv sync
uv run ruff check .
uv run mypy --strict src
uv run pytest -q
```

`pyproject.toml` and `uv.lock` are committed; CI runs `uv sync --locked`, so `ruff`, `mypy` and `pytest` must be dev dependencies. Python 3.12, FastAPI 0.143, Pydantic 2.14, boto3 1.43.

## What lives here

- LLM layer: `LlmProvider` implementations for the OpenAI API, Bedrock (Claude) and OpenRouter. `ProviderRouter` resolves a `TaskConfig {provider, model, fallback[]}` per task (judge, brands, letters, text moderation). Same prompts and JSON schema for every model; validate each answer and retry on the next provider.
- Stacked verification: `RekognitionSignal`, `YoloSignal` and `EmbeddingSignal`; the `VisionJudge` only on unresolved cases (never trusted for counts or boxes); `MetaLearner` inside `StackedVerifier` gives a calibrated probability. 0.85 or more is auto-verified, 0.5 to 0.85 goes to community check, below 0.5 is rejected; strong disagreement always goes to community check.
- Brands: `BrandLabeller` uses Rekognition DetectText plus the brand-to-parent-company map. A company name appears only when the label is readable and above the confidence threshold.
- Rulebook and letters: `RuleRepository` serves hashed official texts and a hand-checked rules JSON. Code picks the rules and the addressees (`LetterRouter`); the model writes only the prose; `QuoteVerifier` checks every quote word for word; `TemplateLetter` is the fallback.

## Rules

- Every model decision records provider, model and version in the evidence.
- Only blurred images go to OpenAI or OpenRouter. Anything personal goes to Bedrock. OpenRouter requests exclude providers that store or train on data.
- Letters go To the local body head, Cc councillor, MLA and MP "for attention", in neutral wording. Never name an individual. Nothing is filed automatically.
- Quotes stay in the official English or Hindi; letter prose may be regional. Cite the Solid Waste Management Rules, 2026 as S.O. 388(E), 27 January 2026, in force 1 April 2026. Quote no rupee amounts under the 2026 Rules.
- Keep the letters route under about 30 seconds (CloudFront's default origin timeout); fall back to the template letter when a model is slow.
- API keys come from Secrets Manager at startup and AWS access from EKS Pod Identity. Never read keys from files in the repo.
- Output shapes come from `contracts/`. Never import `pipeline`; the two packages exchange contract shapes over HTTP.
- Unit tests stub every model and AWS call. Adapter integration tests run only with `RUN_AWS_TESTS=1`; live model runs are manual checks.

## Never

- Send an unblurred image outside AWS, or log images, keys or personal data.
- Let the model choose a rule, an addressee or a quote. A misquote must fail the verifier test.
- Report a model score that was not measured on the held-out set.
