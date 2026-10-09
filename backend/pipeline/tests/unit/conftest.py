import logging
from collections.abc import Iterator

import pytest

CORE_VARIABLES = ("JUNKSNAP_STAGE", "AWS_REGION", "CORS_ORIGINS")


@pytest.fixture(autouse=True)
def clean_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    """Tests start from defaults, whatever the machine running them has set."""
    for name in CORE_VARIABLES:
        monkeypatch.delenv(name, raising=False)


@pytest.fixture(autouse=True)
def restore_root_logger() -> Iterator[None]:
    """Entry points reconfigure the root logger; put it back after each test."""
    root = logging.getLogger()
    saved_handlers, saved_level = root.handlers[:], root.level
    yield
    root.handlers[:] = saved_handlers
    root.setLevel(saved_level)
