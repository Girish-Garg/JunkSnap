# junksnap-pipeline

One image, three workloads: `api` (default command, uvicorn on port 8000), `worker` (`python -m pipeline.handlers.worker`) and `scores` (`python -m pipeline.handlers.scores`).

How a task adds to it without editing shared files:

1. Routes: write `handlers/<topic>_routes.py` with `build_<topic>_router() -> APIRouter`, then add one import and one line to `ROUTER_BUILDERS` in `handlers/routers.py`.
2. Settings: write `settings/<topic>.py` with `class <Topic>Settings(EnvSettings)`, one field per variable from `contracts/README.md` as `Field(alias="EXACT_NAME")`; the builder calls `<Topic>Settings.load()`.
3. The builder composes the object graph: settings, then adapters, then services, then the router.
4. Never add task fields to `CoreSettings` (stage, region, CORS) or routes to `handlers/web.py`.
5. Entry points install logging once with `JsonLogging({...}).install()`; code logs with `logging.getLogger(__name__)`.
