import json
from pathlib import Path

from fakes import (
    JUDGE_JSON,
    FakeBuilder,
    FakeFitter,
    FakeImages,
    FakeProvider,
    FakeSignal,
)

from ml.domain.errors import ExternalServiceError
from ml.domain.llm import TaskConfig
from ml.domain.pricing import PriceTable
from ml.handlers.score_cli import ScoreRun
from ml.ports.signal import Signal
from ml.services.case_scorer import CaseScorer, LabelledPhoto, UsageCost
from ml.services.metered_provider import MeteredBuilder, UsageLog
from ml.services.provider_factory import ProviderFactory
from ml.services.provider_router import ProviderRouter
from ml.services.vision_judge import VisionJudge

PHOTO = LabelledPhoto("qr4change/a", "media/local-test/00_a.jpg", {"waste": True})
NOVA = "apac.amazon.nova-pro-v1:0"


class BrokenSignal(Signal):
    def measure(self, case: object) -> object:  # type: ignore[override]
        raise ExternalServiceError("throttled")


def judge_and_usage() -> tuple[VisionJudge, UsageLog]:
    usage = UsageLog()
    provider = FakeProvider(NOVA, [JUDGE_JSON])
    builder = MeteredBuilder(FakeBuilder({NOVA: provider}), usage)
    router = ProviderRouter({"judge": TaskConfig("bedrock", NOVA)},
                            ProviderFactory({"bedrock": builder}), PriceTable())
    return VisionJudge(router, "system"), usage


def test_each_signal_is_scored_alone_and_failures_are_recorded() -> None:
    signals = {"yolo": FakeSignal("yolo", 0.7), "rekognition_labels": BrokenSignal()}
    row = CaseScorer(FakeImages(), FakeFitter(), signals).score(PHOTO, None)
    assert row["signals"] == {"yolo": 0.7}
    assert row["errors"] == {"rekognition_labels": "throttled"}
    assert "judge" not in row


def test_the_judge_answer_and_its_cost_are_recorded() -> None:
    judge, usage = judge_and_usage()
    row = CaseScorer(FakeImages(), FakeFitter(), {}).score(PHOTO, judge)
    assert row["judge"]["report_type"] == "waste_dump"  # type: ignore[index]
    cost = UsageCost(usage, PriceTable()).take()
    assert cost["input_tokens"] == 1000 and cost["usd"] > 0


def test_score_run_appends_and_skips_photos_already_scored(tmp_path: Path) -> None:
    out = tmp_path / "scores.jsonl"
    scorer = CaseScorer(FakeImages(), FakeFitter(), {"yolo": FakeSignal("yolo", 0.7)})
    run = ScoreRun(scorer, None, UsageCost(UsageLog(), PriceTable()))
    assert run.run([PHOTO], out) == 0
    assert run.run([PHOTO], out) == 0
    lines = out.read_text().splitlines()
    assert len(lines) == 1 and json.loads(lines[0])["judge_cost"]["usd"] == 0
