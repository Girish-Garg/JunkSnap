"""Registry of routers: add `handlers/<topic>_routes.py` and one line to ROUTER_BUILDERS."""

from collections.abc import Callable

from fastapi import APIRouter

from ml.handlers.verify_routes import build_verify_router

ROUTER_BUILDERS: tuple[Callable[[], APIRouter], ...] = (build_verify_router,)
