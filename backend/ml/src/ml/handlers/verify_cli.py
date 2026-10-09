"""Verify local photos: python -m ml.handlers.verify_cli <image>[@type/context] ..."""

import argparse
import logging
import sys
from collections.abc import Sequence
from pathlib import Path

from ml.domain.case import VerificationCase, VerificationResult
from ml.domain.errors import JunkSnapError
from ml.domain.images import LOCAL_TEST_PREFIX, BlurredImage
from ml.domain.purposes import Purpose
from ml.domain.verification import CaseFeatures, Claim
from ml.handlers.verify_graph import VerifierBuilder
from ml.logging_setup import JsonLogging
from ml.services.stacked_verifier import StackedVerifier
from ml.settings.core import CoreSettings
from ml.settings.llm import LlmSettings

# Neutral non-model inputs: a new device, a typical phone GPS fix, no verified neighbours.
CLI_FEATURES = CaseFeatures(gps_accuracy_m=10.0, reputation=0.5, nearby_verified_reports=0)
HEADER = (
    "| photo | claim | signals | judge | probability | decision | insights |\n"
    "|---|---|---|---|---|---|---|"
)


class ResultRow:
    """One Markdown table row per photo."""

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
        return f"{judge.model}: {verdict.report_type} {judge.score:.2f}. {verdict.rationale}"

    @staticmethod
    def _insights(result: VerificationResult) -> str:
        insights = result.insights
        mix = ", ".join(f"{s.material} {s.share:.2f}" for s in insights.composition[:4])
        source = insights.composition[0].source if insights.composition else "none"
        hazards = ", ".join(sorted(insights.hazards)) or "none"
        return f"{mix or 'no materials'} ({source}); size {insights.size_class}; hazards {hazards}"


class VerifyCli:
    def __init__(self, verifier: StackedVerifier, purpose: Purpose) -> None:
        self._verifier = verifier
        self._purpose = purpose

    def run(self, photos: Sequence[str], default_claim: str) -> int:
        print(HEADER)
        failures = 0
        for index, text in enumerate(photos, start=1):
            path_text, _, claim_text = text.partition("@")
            path = Path(path_text)
            try:
                case = self._case(index, path, claim_text or default_claim)
                print(ResultRow.render(path.name, self._verifier.verify(case)))
            except (JunkSnapError, OSError) as error:
                failures += 1
                print(f"| {path.name} | | error: {error} | | | | |")
        return 1 if failures else 0

    def _case(self, index: int, path: Path, claim_text: str) -> VerificationCase:
        report_type, _, context = claim_text.partition("/")
        return VerificationCase(
            report_id=f"{self._purpose.id_prefix}_cli_{index:02d}",
            purpose=self._purpose,
            # Local test photos count as already blurred.
            image=BlurredImage(f"{LOCAL_TEST_PREFIX}{path.name}", path.read_bytes()),
            claim=Claim(report_type, context),
            features=CLI_FEATURES,
        )


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("photos", nargs="+", help="image file, optionally @report_type/context")
    parser.add_argument("--claim", default="waste_dump/roadside", help="default report claim")
    parser.add_argument("--purpose", default="report", choices=["report", "cleanup"])
    parser.add_argument("--verbose", action="store_true", help="also print JSON logs")
    args = parser.parse_args(argv)
    level = logging.INFO if args.verbose else logging.ERROR
    JsonLogging({"service": "ml-verify-cli"}, level=level).install()
    builder = VerifierBuilder(CoreSettings.load(), LlmSettings.load())
    cli = VerifyCli(builder.verifier(), Purpose.named(args.purpose))
    return cli.run(args.photos, args.claim)


if __name__ == "__main__":
    sys.exit(main())
