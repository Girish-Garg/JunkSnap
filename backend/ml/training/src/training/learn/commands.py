"""One method per `learn` step; builds the adapters each step needs."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import boto3
from botocore.config import Config

from training.class_map import ClassMap
from training.learn.cases import CaseWriter
from training.learn.detector import DetectorRun, ExportSpec
from training.learn.embeddings import EmbeddingCache, EmbeddingTable
from training.learn.heads import HeadCatalogue
from training.learn.report import StackReport
from training.learn.sample import BenchmarkSample
from training.learn.stacker import ScoredPhoto, StackerTrainer
from training.learn.selection import HeadSelector
from training.learn.ports import DetectorTrainer, ImageEmbedder
from training.learn.teacher import TeacherBoxFile, TeacherLabeller
from training.manifest import ManifestFile
from training.ports import ObjectStore
from training.settings import Settings
from training.yolo import YoloExporter

SERVER_EXPORT = ExportSpec(imgsz=640)
EDGE_EXPORTS = (ExportSpec(imgsz=320, int8=True), ExportSpec(imgsz=320, half=True))
TEACHER_SOURCES = ("qr4change",)


class LearnCommands:
    def __init__(self, settings: Settings, store: ObjectStore) -> None:
        self._settings = settings
        self._cache = settings.require_cache()
        self._store = store

    def teacher(self, args: argparse.Namespace) -> None:
        from training.learn.adapters.owl_teacher import OwlTeacher  # noqa: PLC0415 (GPU only)

        rows = [r for r in self._manifest().read() if r.source == args.source and r.split]
        labeller = TeacherLabeller(OwlTeacher(), self._cache)
        records = labeller.label(r for r in rows if r.split != "holdout")
        TeacherBoxFile(self._cache, args.source).write(records, self._store)
        boxes = [b.label for r in records for b in r.boxes]
        print(json.dumps({"photos": len(records), "boxes": {k: boxes.count(k) for k in set(boxes)}}))

    def detector_data(self, args: argparse.Namespace) -> None:
        out = self._settings.outside_repo(Path(args.out))
        extra = {}
        for source in TEACHER_SOURCES:
            extra.update(TeacherBoxFile(self._cache, source).boxes(self._store))
        class_map = ClassMap.load(self._settings.class_map_path)
        counts = YoloExporter(self._cache, class_map, self._store).export(
            self._manifest().read(), out, extra
        )
        print(json.dumps(dict(sorted(counts.items())), indent=2))

    def detector_train(self, args: argparse.Namespace) -> None:
        run = DetectorRun(
            base=args.base, data=Path(args.data), epochs=args.epochs, imgsz=args.imgsz,
            out=self._cache.parent / "runs", name=args.name, cache_images=args.cache_images,
        )
        print(f"best: {self._detector().train(run)}")

    def detector_eval(self, args: argparse.Namespace) -> None:
        report = self._detector().evaluate(Path(args.weights), Path(args.data), args.split)
        out = Path(args.weights).with_suffix(f".{args.split}.json")
        out.write_text(json.dumps(report.to_json(), indent=2), encoding="utf-8")
        print(report.table())

    def detector_export(self, args: argparse.Namespace) -> None:
        for spec in (SERVER_EXPORT, *EDGE_EXPORTS):
            path = self._detector().export(Path(args.weights), spec, Path(args.data))
            print(f"{spec}: {path} ({path.stat().st_size / 1e6:.1f} MB)")

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
        out = self._cache / "models" / f"heads-{args.embedder}.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(chosen.to_json(), indent=1), encoding="utf-8")
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
        out = self._cache / "models" / f"{args.version}.json"
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(meta.to_json(fitted_on), indent=1), encoding="utf-8")
        report = StackReport(meta)
        print(f"{out}

{report.signals_alone(test)}

{report.table(test)}")

    @staticmethod
    def _scored(path: Path) -> list[ScoredPhoto]:
        rows = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line]
        return [p for raw in rows if (p := ScoredPhoto.from_json(raw)) is not None]

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

    @staticmethod
    def _detector() -> DetectorTrainer:
        from training.learn.adapters.ultralytics_detector import (  # noqa: PLC0415 (GPU only)
            UltralyticsDetector,
        )

        return UltralyticsDetector()
