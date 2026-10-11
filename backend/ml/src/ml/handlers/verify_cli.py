"""Verify local photos: python -m ml.handlers.verify_cli --photos-are-blurred <image>[@claim]."""

import argparse
import logging
import sys
from collections.abc import Sequence
from pathlib import Path

from ml.adapters.local_images import LocalBlurredImageStore
from ml.domain.auto_claims import claim_for
from ml.domain.case import VerificationResult, VerifyInput
from ml.domain.errors import JunkSnapError
from ml.domain.purposes import Purpose
from ml.domain.verification import CaseFeatures
from ml.handlers.verify_graph import VerifierBuilder
from ml.logging_setup import JsonLogging
from ml.settings.core import CoreSettings
from ml.settings.llm import LlmSettings
from ml.settings.models import ModelSettings
from ml.settings.tuning import Tuning

# Neutral non-model inputs: a new device, a typical phone GPS fix, no verified neighbours.
CLI_FEATURES = CaseFeatures(gps_accuracy_m=10.0, reputation=0.5, nearby_verified_reports=0)
HEADER = (
    "| photo | claim | signals | judge | probability | decision | insights |\n"
    "|---|---|---|---|---|---|---|"
)


class ResultRow:
    @staticmethod
    def render(photo: str, result: VerificationResult) -> str:
        claim = f"{result.case.claim.report_type}/{result.case.claim.context}"
        outcome = result.outcome
        split = " (disagreement)" if outcome.disagreement else ""
        return (
            f"| {photo} | {claim} | {ResultRow._signals(result)} | {ResultRow._judge(result)} "
            f"| {outcome.probability:.2f} | {outcome.decision}{split} "
            f"| {ResultRow._insights(result)} |"
        )

    @staticmethod
    def _signals(result: VerificationResult) -> str:
        return "; ".join(
            f"{s.name} {s.score:.2f} ({', '.join(s.notes[:4]) or 'no match'})"
            for s in result.signals
            if s.name != "vision_judge"
        )

    @staticmethod
    def _judge(result: VerificationResult) -> str:
        judge = next((s for s in result.signals if s.name == "vision_judge"), None)
        if judge is None or result.judge is None:
            return "not run"
        verdict = result.judge
        answer = verdict.answer_for(result.case.claim)
        named = f"{answer} ({verdict.report_type}) {judge.score:.2f}"
        return f"{judge.model}: {named}. {verdict.rationale}"

    @staticmethod
    def _insights(result: VerificationResult) -> str:
        insights = result.insights
        mix = ", ".join(
            f"{s.material} {s.share:.0%} ({s.source.signal})" for s in insights.composition
        )
        hazards = ", ".join(f"{h.hazard} {h.confidence:.2f}" for h in insights.hazards)
        size = insights.size_class.value if insights.size_class else "none"
        return f"{mix or 'no materials'}; size {size}; hazards {hazards or 'none'}"


class VerifyCli:
    def __init__(self, builder: VerifierBuilder, purpose: Purpose) -> None:
        self._builder = builder
        self._purpose = purpose

    def run(self, photos: Sequence[str], default_claim: str) -> int:
        jobs = []
        for index, text in enumerate(photos, start=1):
            path_text, _, claim_text = text.partition("@")
            path = Path(path_text)
            jobs.append((LocalBlurredImageStore.key_for(index, path), path, claim_text))
        service = self._builder.service(LocalBlurredImageStore({k: p for k, p, _ in jobs}))
        print(HEADER)
        failures = 0
        for index, (key, path, claim_text) in enumerate(jobs, start=1):
            try:
                result = service.verify(self._input(index, key, claim_text or default_claim))
                print(ResultRow.render(path.name, result))
            except JunkSnapError as error:
                failures += 1
                print(f"| {path.name} | | error: {error} | | | | |")
        return 1 if failures else 0

    def _input(self, index: int, key: str, claim_text: str) -> VerifyInput:
        report_type, _, context = claim_text.partition("/")
        return VerifyInput(
            report_id=f"{self._purpose.id_prefix}_cli_{index:02d}",
            purpose=self._purpose.name,
            blurred_key=key,
            claim=claim_for(report_type, context),
            features=CLI_FEATURES,
        )


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("photos", nargs="+", help="image file, optionally @report_type/context")
    parser.add_argument("--claim", default="waste_dump/roadside", help="default report claim")
    parser.add_argument("--purpose", default="report", choices=["report", "cleanup"])
    parser.add_argument("--verbose", action="store_true", help="also print JSON logs")
    parser.add_argument(
        "--photos-are-blurred", action="store_true", help="required: no face or plate visible"
    )
    args = parser.parse_args(argv)
    if not args.photos_are_blurred:
        parser.error("models may only see blurred photos; pass --photos-are-blurred to vouch")
    level = logging.INFO if args.verbose else logging.ERROR
    JsonLogging({"service": "ml-verify-cli"}, level=level).install()
    builder = VerifierBuilder(
        CoreSettings.load(), LlmSettings.load(), ModelSettings.load(), Tuning.load()
    )
    return VerifyCli(builder, Purpose.named(args.purpose)).run(args.photos, args.claim)


if __name__ == "__main__":
    sys.exit(main())
