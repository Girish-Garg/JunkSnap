"""Tests for the stack guards in scripts/deploy.py; no AWS call is made.

Run with: uv run --with pytest pytest scripts/tests -q
"""

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import deploy  # noqa: E402
import deploy_web  # noqa: E402
import stage_config  # noqa: E402


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


def test_layer_carries_the_stage_tunables(
    aws_calls: list[tuple[str, ...]], monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.setattr(deploy, "ROOT", tmp_path)
    deployer = deploy.StageDeployer("demo", "https://web.example", stage_config.load("demo"))
    repos = {output: f"000000000000.dkr.ecr.ap-south-1.amazonaws.com/{name}"
             for name, (_, output) in deploy.IMAGES.items()}
    outputs = {name: f"value-of-{name}" for name in deploy.CONFIG_FROM_OUTPUTS.values()}
    deployer._write_layer(repos, "abc1234", outputs)

    written = (tmp_path / "infra" / "k8s" / "deploy" / "demo" / "kustomization.yaml").read_text()
    literals = json.loads(written.split("\n", 1)[1])["configMapGenerator"][0]["literals"]
    assert "SNAP_PER_HOUR=100" in literals
    assert "VOTE_RADIUS_M=1000" in literals
    assert "ML_AUTO_VERIFY_MIN=0.85" in literals
    assert "CORS_ORIGINS=https://web.example" in literals
    assert "REPORTS_TABLE=value-of-ReportsTableName" in literals
    assert not [line for line in literals if line.startswith("VITE_")]
    keys = [line.split("=", 1)[0] for line in literals]
    assert len(keys) == len(set(keys))
    assert aws_calls == []


def test_web_build_env_has_the_tunables_and_the_stack_endpoints() -> None:
    outputs = {"PublicBaseUrl": "https://api.example", "UserPoolId": "ap-south-1_Example",
               "UserPoolClientId": "client"}
    tunables = {**stage_config.load("dev").vite, "VITE_WEB_URL": "https://config.example"}
    env = deploy_web.build_env(outputs, "https://web.example", tunables)
    assert env["VITE_MIN_VERIFIED_REPORTS"] == "10"
    assert env["VITE_SCAN_MAX_DURATION_MS"] == "60000"
    assert env["VITE_API_URL"] == "https://api.example"
    assert env["VITE_API_MODE"] == "live"
    assert env["VITE_WEB_URL"] == env["VITE_SHARE_URL"] == "https://web.example"
