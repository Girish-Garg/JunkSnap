"""Command line for model training: `learn <step>`; runs on the GPU machine only."""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

from training.cli import StoreFactory
from training.domain import JunkSnapError
from training.learn.commands import LearnCommands
from training.settings import Settings

LOG = logging.getLogger("training.learn")


class LearnParser:
    def __init__(self) -> None:
        self._root = argparse.ArgumentParser(prog="learn", description="JunkSnap model training")
        self._sub = self._root.add_subparsers(dest="command", required=True)

    def build(self) -> argparse.ArgumentParser:
        self._sub.add_parser("teacher").add_argument("--source", default="qr4change")
        export = self._sub.add_parser("detector-data")
        export.add_argument("--out", required=True)
        self._detector()
        self._embeddings()
        self._fitting()
        return self._root

    def _detector(self) -> None:
        train = self._sub.add_parser("detector-train")
        train.add_argument("--data", required=True)
        train.add_argument("--base", default="yolo26s.pt")
        train.add_argument("--epochs", type=int, default=100)
        train.add_argument("--imgsz", type=int, default=640)
        train.add_argument("--name", required=True)
        train.add_argument("--cache-images", action="store_true")
        for name in ("detector-eval", "detector-export"):
            command = self._sub.add_parser(name)
            command.add_argument("--weights", required=True)
            command.add_argument("--data", required=True)
        self._sub.choices["detector-eval"].add_argument("--split", default="test")

    def _embeddings(self) -> None:
        embed = self._sub.add_parser("embed")
        embed.add_argument("embedder", choices=["titan", "siglip"])
        embed.add_argument("--cap", type=int, default=None, help="rows per source and split")

    def _fitting(self) -> None:
        heads = self._sub.add_parser("heads")
        heads.add_argument("embedder", choices=["titan", "siglip"])
        cases = self._sub.add_parser("cases")
        cases.add_argument("split", choices=["val", "test"])
        cases.add_argument("--out", required=True)
        cases.add_argument("--sources", default="qr4change", help="sources with report types")
        cases.add_argument("--fire-photos", type=int, default=0)
        stacker = self._sub.add_parser("stacker")
        stacker.add_argument("--val", required=True, help="signal scores JSONL on val")
        stacker.add_argument("--test", required=True, help="signal scores JSONL on test")
        stacker.add_argument("--version", default="meta-v1")


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    logging.getLogger("urllib3").setLevel(logging.ERROR)
    args = LearnParser().build().parse_args(argv)
    try:
        settings = Settings.from_env(Path.cwd())
        commands = LearnCommands(settings, StoreFactory(settings).create(no_upload=False))
        getattr(commands, args.command.replace("-", "_"))(args)
    except JunkSnapError as error:
        LOG.error("%s", error)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
