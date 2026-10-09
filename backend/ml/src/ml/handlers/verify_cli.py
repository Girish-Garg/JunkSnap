"""Verify local photos: python -m agent.handlers.verify_cli <image>[@type/context] ..."""

import argparse
import logging
import sys
from collections.abc import Sequence
from pathlib import Path

from agent.domain.case import VerificationCase, VerificationResult
from agent.domain.errors import JunkSnapError
from agent.domain.images import LOCAL_TEST_PREFIX, BlurredImage
from agent.domain.purposes import Purpose
from agent.domain.verification import CaseFeatures, Claim
from agent.handlers.verify_graph import VerifierBuilder
from agent.logging_setup import JsonLogging
from agent.services.stacked_verifier import StackedVerifier
from agent.settings.core import CoreSettings
from agent.settings.llm import LlmSettings

# Neutral non-model inputs: a new device, a typical phone GPS fix, no verified neighbours.
CLI_FEATURES = CaseFeatures(gps_accuracy_m=10.0, reputation=0.5, nearby_verified_reports=0)
HEADER = "| photo | claim | signals | judge | probability | decision |\n|---|---|---|---|---|---|"


class VerifyCli:
    """Prints one Markdown table row per photo; photos count as already blurred."""

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
                print(self._row(path.name, self._verifier.verify(case)))
            except (JunkSnapError, OSError) as error:
                failures += 1
                print(f"| {path.name} | | error: {error} | | | |")
        return 1 if failures else 0

    def _case(self, index: int, path: Path, claim_text: str) -> VerificationCase:
        report_type, _, context = claim_text.partition("/")
        return VerificationCase(
            report_id=f"{self._purpose.id_prefix}_cli_{index:02d}",
            purpose=self._purpose,
            image=BlurredImage(f"{LOCAL_TEST_PREFIX}{path.name}", path.read_bytes()),
            claim=Claim(report_type, context),
            features=CLI_FEATURES,
        )

    @staticmethod
    def _row(photo: str, result: VerificationResult) -> str:
        signals = [s for s in result.signals if s.name != "vision_judge"]
        signal_text = "; ".join(
            f"{s.name} {s.score:.2f} ({', '.join(s.notes[:4]) or 'no match'})" for s in signals
        )
        judges = [s for s in result.signals if s.name == "vision_judge"]
        judge_text = "not run"
        if judges and result.judge is not None:
            judge = judges[0]
            judge_text = f"{judge.model}: {result.judge.report_type}, support {judge.score:.2f}"
        claim = f"{result.case.claim.report_type}/{result.case.claim.context}"
        outcome = result.outcome
        disagreement = " (disagreement)" if outcome.disagreement else ""
        return (
            f"| {photo} | {claim} | {signal_text} | {judge_text} | "
            f"{outcome.probability:.2f} | {outcome.decision}{disagreement} |"
        )


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("photos", nargs="+", help="image file, optionally @report_type/context")
    parser.add_argument("--claim", default="waste_dump/roadside", help="default report claim")
    parser.add_argument("--purpose", default="report", choices=["report", "cleanup"])
    parser.add_argument("--verbose", action="store_true", help="also print JSON logs")
    args = parser.parse_args(argv)
    level = logging.INFO if args.verbose else logging.ERROR
    JsonLogging({"service": "agent-verify-cli"}, level=level).install()
    builder = VerifierBuilder(CoreSettings.load(), LlmSettings.load())
    cli = VerifyCli(builder.verifier(), Purpose.named(args.purpose))
    return cli.run(args.photos, args.claim)


if __name__ == "__main__":
    sys.exit(main())
