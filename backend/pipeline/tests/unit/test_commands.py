import json
from collections.abc import Callable

import pytest

from pipeline.handlers import scores, worker


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
    # Demo stage without CORS_ORIGINS: the worker and scores job never need it.
    monkeypatch.setenv("JUNKSNAP_STAGE", "demo")

    main()

    line = json.loads(capsys.readouterr().out.strip())
    assert line["message"] == f"{service} started"
    assert line["service"] == service
    assert line["stage"] == "demo"
    assert line["level"] == "INFO"
