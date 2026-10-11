"""Score labelled dataset photos offline: python -m ml.handlers.score_cli <cases> --out <jsonl>."""

import argparse
import json
import logging
import sys
from collections.abc import Sequence
from pathlib import Path

from ml.adapters.local_images import LocalBlurredImageStore
from ml.domain.errors import JunkSnapError
from ml.handlers.score_graph import ScoreGraph, ScoreOptions
from ml.logging_setup import JsonLogging
from ml.services.case_scorer import CaseScorer, LabelledPhoto, UsageCost
from ml.services.vision_judge import VisionJudge
from ml.settings.core import CoreSettings
from ml.settings.tuning import Tuning

logger = logging.getLogger(__name__)


class ScoreRun:
    """Appends one JSON line per photo; photos already in the output are skipped."""

    def __init__(self, scorer: CaseScorer, judge: VisionJudge | None, cost: UsageCost) -> None:
        self._scorer = scorer
        self._judge = judge
        self._cost = cost

    def run(self, photos: Sequence[LabelledPhoto], out: Path) -> int:
        done = self._done(out)
        failures = 0
        with out.open("a", encoding="utf-8") as sink:
            for count, photo in enumerate(p for p in photos if p.case_id not in done):
                try:
                    row = self._scorer.score(photo, self._judge)
                except JunkSnapError as error:
                    failures += 1
                    logger.warning("score_failed", extra={"fields": {"id": photo.case_id,
                                                                     "reason": str(error)}})
                    continue
                row["judge_cost"] = self._cost.take()
                sink.write(json.dumps(row) + "\n")
                sink.flush()
                if count % 25 == 0:
                    print(f"{count} scored", flush=True)
        return 1 if failures else 0

    @staticmethod
    def _done(out: Path) -> set[str]:
        if not out.exists():
            return set()
        lines = out.read_text(encoding="utf-8").splitlines()
        return {json.loads(line)["id"] for line in lines if line}


class CaseFile:
    """JSONL from `learn cases`: id, path and truth for each labelled photo."""

    @staticmethod
    def read(path: Path) -> tuple[list[LabelledPhoto], dict[str, Path]]:
        photos, files = [], {}
        for index, line in enumerate(path.read_text(encoding="utf-8").splitlines()):
            raw = json.loads(line)
            image = Path(raw["path"])
            key = LocalBlurredImageStore.key_for(index, image)
            files[key] = image
            photos.append(LabelledPhoto(raw["id"], key, raw["truth"]))
        return photos, files


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("cases", type=Path)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--signals", default="rekognition_labels,yolo,embedding_classifier")
    parser.add_argument("--yolo", type=Path, help="local YOLO ONNX file")
    parser.add_argument("--heads", type=Path, help="local embedding heads JSON")
    parser.add_argument("--embedder", type=Path, help="local SigLIP ONNX file")
    parser.add_argument("--judge", default=None, help="Bedrock model id for the judge")
    parser.add_argument(
        "--public-dataset-photos", action="store_true",
        help="required: openly licensed dataset photos, never user photos",
    )
    args = parser.parse_args(argv)
    if not args.public_dataset_photos:
        parser.error("only openly licensed dataset photos; pass --public-dataset-photos to vouch")
    JsonLogging({"service": "ml-score-cli"}, level=logging.WARNING).install()
    photos, files = CaseFile.read(args.cases)
    signals = tuple(s for s in args.signals.split(",") if s)
    options = ScoreOptions(signals, args.yolo, args.heads, args.embedder)
    graph = ScoreGraph(options, CoreSettings.load().aws_region, Tuning.load())
    scorer = CaseScorer(LocalBlurredImageStore(files), graph.fitter(), graph.signals())
    return ScoreRun(scorer, graph.judge(args.judge), graph.cost()).run(photos, args.out)


if __name__ == "__main__":
    sys.exit(main())
