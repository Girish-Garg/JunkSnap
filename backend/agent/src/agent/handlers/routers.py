"""Registry of the routers the agent web app serves.

To add routes, a task writes `handlers/<topic>_routes.py` with `build_<topic>_router()`,
which loads its own settings class, builds its services and adapters, and returns an
APIRouter. Then it adds that function to ROUTER_BUILDERS below: one import and one line.
"""

from collections.abc import Callable

from fastapi import APIRouter

ROUTER_BUILDERS: tuple[Callable[[], APIRouter], ...] = ()
