"""Tests for the stack guards in scripts/deploy.py; no AWS call is made.

Run with: uv run --with pytest pytest scripts/tests -q
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import deploy  # noqa: E402


@pytest.fixture
def aws_calls(monkeypatch: pytest.MonkeyPatch) -> list[tuple[str, ...]]:
    calls: list[tuple[str, ...]] = []

    def record(*args: str, quiet: bool = False) -> str:
        calls.append(args)
        return ""

    monkeypatch.setattr(deploy, "aws", record)
    return calls


def test_protected_stage_gets_termination_protection(aws_calls: list[tuple[str, ...]]) -> None:
    deploy.protect_stack("demo", "junksnap-demo")

    assert aws_calls == [
        (
            "cloudformation",
            "update-termination-protection",
            "--enable-termination-protection",
            "--stack-name",
            "junksnap-demo",
        )
    ]


def test_dev_stays_deletable(aws_calls: list[tuple[str, ...]]) -> None:
    deploy.protect_stack("dev", "junksnap-dev")

    assert aws_calls == []
