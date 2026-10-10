# backend/agent → backend/ml: the Python ML service

This package is moving to `backend/ml` (another PR renames it); these notes move with it. Only the ML side is Python (decision 20261010-0159). Layout per docs/working.md: `src/<pkg>/{domain,ports,adapters,services,handlers}/`, tests in `tests/unit` and `tests/contract`, training and dataset tooling in `training/`.

It runs as the `ml` workload on EKS (image `junksnap-ml`): a FastAPI app with one cluster-internal route, `POST /internal/verify`, plus `/healthz`. The `worker` calls it at `ML_URL`. Letters, brands and the rulebook moved to `backend/server`; `/internal/brands` is gone.

## Commands

```
cd backend/agent   # backend/ml after the rename
uv sync
uv run ruff check .
uv run mypy --strict src
uv run pytest -q
```

`pyproject.toml` and `uv.lock` are committed; CI runs `uv sync --locked`, so `ruff`, `mypy` and `pytest` must be dev dependencies. Python 3.12, FastAPI 0.143, Pydantic 2.14, boto3 1.43.

## What lives here

- Stacked verification: `RekognitionSignal`, `YoloSignal` and `EmbeddingSignal` (SigLIP 2 image embeddings plus our logistic heads), then the LLM judge (`VisionJudge`) on every report, scan frame and cleanup (decision 20261011-0005). The judge is one input the combiner weighs with the detectors; it never sets counts or boxes. Nova Lite answers first: about $0.17 per 1,000 photos ($0.00017 a report) at list prices, median 1.5 s, p90 2.0 s; Nova Pro, next in line, $2.24 per 1,000 (docs/ml/eval.md). A signal not trained on the claimed type is neutral and counts as absent, never as a no. When the meta-learner has no training rows for the type, or one of its signals is neutral, the judge decides on the fixed weights (`JudgeDecidesCombiner`); meta-v2 covers `waste_dump` and `no_bin` only. A judge outage leaves the detectors to decide, capped at community check: nothing is auto-verified without the judge, and an untrained type goes to community check unless the detectors veto fires. `MetaLearner` inside `StackedVerifier` gives a calibrated probability: 0.85 or more is auto-verified, 0.5 to 0.85 community check, below 0.5 rejected; strong disagreement goes to community check. A veto rejects whatever the combiner says (issue 103): the judge answers `not_waste` with claim support under 0.2, or every detector is under 0.2 and the judge is under 0.5 or could not run. `combiner.version` records the veto with the models behind it.
- Insights (decision 20261010-0202): `InsightExtractor` fills `verification_result.insights`: composition shares by material, size class (never tonnage), hazards, each with its model as the source. The judge runs last, so its composition shares and size class win over the detectors' (`Insights.merged_with`); YOLO and the classifier fill only what it did not measure, and its burning verdict replaces theirs. Null for cleanups.
- LLM layer for the judge: `ProviderRouter` with `TaskConfig {provider, model, fallback[]}`; Bedrock Nova Lite, then Nova Pro, then OpenAI (decisions 20261010-0133 and 20261011-0005). Bedrock refuses Claude on this account, so Claude is reachable only by setting `LLM_TASKS`. Validate each answer and retry on the next provider. Each Bedrock call (judge and Titan) reads for at most 8 s and is resent once, and OpenAI reads for 8 s (`JudgeTimeouts`): with all three judge models hung, 16 + 16 + 8 = 40 s fits the worker's 60 s with 10 s left for the detectors.
- Training (`training/`): dataset manifests, YOLO, the embedding classifier and the meta-learner. Data: openly licensed public datasets only, with fixed hash splits; numbers come from the public test split (decision 20261010-1245-hem-ml-public-data-only).

## Rules

- Every model decision records provider, model and version.
- Read only the blurred copy (`media/` in the public bucket); write only `embeddings/` in the private bucket. Never read originals or scan videos.
- Output shapes come from `contracts/`. Never import `backend/server`; the two exchange contract shapes over HTTP.
- Datasets and model files over 5 MB live in S3, never in git. Check each dataset's licence before use.
- Training and evaluation use public data only; field photos are never imported or labelled for training. Local tooling uses `JUNKSNAP_DATA_CACHE` and `JUNKSNAP_REPO`.
- Unit tests stub every model and AWS call. Adapter integration tests run only with `RUN_AWS_TESTS=1`.

## Never

- Send an unblurred image to any model, or log images, keys or personal data.
- Train on a test-split photo, or report a number not measured on the test split.
