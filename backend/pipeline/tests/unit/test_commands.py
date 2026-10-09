import json
import logging
from collections.abc import Callable, Iterator

import pytest

from pipeline.handlers import scores, worker


@pytest.fixture(autouse=True)
def restore_root_logger() -> Iterator[None]:
    root = logging.getLogger()
    saved_handlers, saved_level = root.handlers[:], root.level
    yield
    root.handlers[:] = saved_handlers
    root.setLevel(saved_level)


@pytest.mark.parametrize(
    ("main", "service"),
    [(worker.main, "worker"), (scores.main, "scores")],
)
def test_main_logs_start_as_json(
    main: Callable[[], None],
    service: str,
    capsys: pytest.CaptureFixture[str],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("JUNKSNAP_STAGE", "test")

    main()

    line = json.loads(capsys.readouterr().out.strip())
    assert line["message"] == f"{service} started"
    assert line["service"] == service
    assert line["stage"] == "test"
    assert line["level"] == "INFO"
