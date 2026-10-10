"""Embedding, stacking and benchmark steps of `learn`."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import boto3
from botocore.config import Config

from training.class_map import ClassMap
from training.learn.bench import BenchRow, JudgeBench
from training.learn.cases import CaseWriter
from training.learn.embeddings import EmbeddingCache, EmbeddingTable
from training.learn.heads import HeadCatalogue
from training.learn.ports import ImageEmbedder
from training.learn.publish import ModelPublisher, Release
from training.learn.report import StackReport
from training.learn.sample import BenchmarkSample
from training.learn.selection import HeadSelector
from training.learn.stacker import ScoredPhoto, StackerTrainer
from training.manifest import ManifestFile
from training.ports import ObjectStore
from training.settings import Settings

PINS = Path("backend/ml/src/ml/settings/models.json")
EMBEDDER_IDS = {"titan": "amazon.titan-embed-image-v1", "siglip": "google/siglip2-base-patch16-224"}


class FitCommands:
    def __init__(self, settings: Settings, store: ObjectStore) -> None:
        self._settings = settings
        self._cache = settings.require_cache()
        self._store = store

    def embed(self, args: argparse.Namespace) -> None:
        rows = BenchmarkSample(args.cap).rows(self._manifest().read())
        embedder = self._embedder(args.embedder)
        table = EmbeddingTable(self._cache, args.embedder)
        vectors = EmbeddingCache(embedder, table, self._cache).fill(rows)
        print(f"{embedder.model}: {len(vectors)} embeddings")

    def heads(self, args: argparse.Namespace) -> None:
        from training.learn.adapters.sklearn_fitter import (  # noqa: PLC0415
            SklearnLogisticFitter,
        )

        rows = self._manifest().read()
        vectors = EmbeddingTable(self._cache, args.embedder).read()
        materials = ClassMap.load(self._settings.class_map_path).vocabulary.materials
        selector = HeadSelector(HeadCatalogue.defaults(materials), SklearnLogisticFitter)
        chosen = selector.select(rows, vectors)
        content = chosen.to_json(EMBEDDER_IDS[args.embedder], args.version)
        self._write(f"heads-{args.embedder}.json", content)
        print(chosen.table())

    def cases(self, args: argparse.Namespace) -> None:
        writer = CaseWriter(self._cache, tuple(args.sources.split(",")), args.fire_photos)
        count = writer.write(self._manifest().read(), args.split, Path(args.out))
        print(f"{count} {args.split} photos -> {args.out}")

    def stacker(self, args: argparse.Namespace) -> None:
        from training.learn.adapters.sklearn_fitter import (  # noqa: PLC0415
            SklearnLogisticFitter,
        )

        val, test = self._scored(Path(args.val)), self._scored(Path(args.test))
        meta = StackerTrainer(SklearnLogisticFitter()).fit(val, args.version)
        fitted_on = {"photos": len(val), "judged": sum(p.judged for p in val)}
        out = self._write(f"{args.version}.json", meta.to_json(fitted_on))
        report = StackReport(meta)
        print(out, report.signals_alone(test), report.table(test), sep="\n\n")

    def bench(self, args: argparse.Namespace) -> None:
        bench = JudgeBench()
        lines = [BenchRow.header()]
        for spec in args.runs:
            model, _, path = spec.partition("=")
            lines.append(bench.summarise(model, self._lines(Path(path))).row())
        print("\n".join(lines))

    def publish(self, args: argparse.Namespace) -> None:
        pins = self._settings.repo / PINS
        releases = [Release.parse(text) for text in args.files]
        print(json.dumps(ModelPublisher(self._store).publish(releases, pins), indent=2))

    def _write(self, name: str, content: dict[str, Any]) -> Path:
        out = self._cache / "models" / name
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(content, indent=1), encoding="utf-8")
        return out

    def _scored(self, path: Path) -> list[ScoredPhoto]:
        return [p for raw in self._lines(path) if (p := ScoredPhoto.from_json(raw)) is not None]

    @staticmethod
    def _lines(path: Path) -> list[dict[str, Any]]:
        text = path.read_text(encoding="utf-8")
        return [json.loads(line) for line in text.splitlines() if line]

    def _embedder(self, name: str) -> ImageEmbedder:
        if name == "titan":
            from training.learn.adapters.titan_embedder import (  # noqa: PLC0415
                TitanImageEmbedder,
            )

            session = boto3.Session(region_name=self._settings.region)
            config = Config(max_pool_connections=16, retries={"max_attempts": 4})
            return TitanImageEmbedder(session.client("bedrock-runtime", config=config))
        from training.learn.adapters.siglip_embedder import (  # noqa: PLC0415 (GPU only)
            SiglipImageEmbedder,
        )

        return SiglipImageEmbedder()

    def _manifest(self) -> ManifestFile:
        return ManifestFile(self._cache, self._settings.datasets_dir, self._store)
