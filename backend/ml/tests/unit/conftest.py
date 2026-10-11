import logging
import os
from collections.abc import Iterator

import pytest

CORE_VARIABLES = ("JUNKSNAP_STAGE", "AWS_REGION")
TUNING_PREFIX = "ML_"  # every tuning variable (settings/tuning.py), and ML_MODEL_DIR


@pytest.fixture(autouse=True)
def clean_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    """Tests start from defaults, whatever the machine running them has set."""
    for name in CORE_VARIABLES:
        monkeypatch.delenv(name, raising=False)
    for name in [n for n in os.environ if n.upper().startswith(TUNING_PREFIX)]:
        monkeypatch.delenv(name)


@pytest.fixture(autouse=True)
def restore_root_logger() -> Iterator[None]:
    """Entry points reconfigure the root logger; put it back after each test."""
    root = logging.getLogger()
    saved_handlers, saved_level = root.handlers[:], root.level
    yield
    root.handlers[:] = saved_handlers
    root.setLevel(saved_level)
