# junksnap-ml

One image, one workload: `ml` (default command, uvicorn on port 8000). It serves only `POST /internal/verify`; run the verifier on local photos with `uv run python -m ml.handlers.verify_cli <photos>`.

How a task adds to it without editing shared files:

1. Routes: write `handlers/<topic>_routes.py` with `build_<topic>_router() -> APIRouter`, then add one import and one line to `ROUTER_BUILDERS` in `handlers/routers.py`.
2. Settings: write `settings/<topic>.py` with `class <Topic>Settings(EnvSettings)`, one field per variable from `contracts/README.md` as `Field(alias="EXACT_NAME")`; the builder calls `<Topic>Settings.load()`.
3. The builder composes the object graph: settings, then adapters, then services, then the router.
4. Never add task fields to `CoreSettings` (stage, region) or routes to `handlers/web.py`.
5. Entry points install logging once with `JsonLogging({...}).install()`; code logs with `logging.getLogger(__name__)`.

## Trained models (issue 50)

- Signals: `rekognition_labels`, `yolo` (our YOLO26 ONNX, CPU) and `embedding_classifier` (an image embedding plus our logistic heads). The `meta_learner` combiner, fitted on the val split, replaces the fixed weights; the judge still runs only when it is unsure or the signals split. Numbers: `docs/ml/eval.md`.
- Model files live in the private bucket under `models/`. `src/ml/settings/models.json` pins each one by key, SHA-256, size and version; the app downloads them to `ML_MODEL_DIR` at start and refuses a file whose hash differs. Without `ORIGINALS_BUCKET` (tests, a laptop) the app logs `trained_models_off` and runs the v0 graph.
- `backend/ml/training` (`learn` command) trains the models and writes the pins with `learn publish`.
- Offline scoring of openly licensed dataset photos (never user photos): `uv run python -m ml.handlers.score_cli <cases.jsonl> --out <scores.jsonl> --yolo <onnx> --heads <json> --public-dataset-photos`; add `--judge <bedrock model id>` for the judge benchmark.
