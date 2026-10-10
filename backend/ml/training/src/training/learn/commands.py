"""Detector steps of `learn`: teacher boxes, the YOLO dataset, training, evaluation, export."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np

from training.class_map import ClassMap
from training.learn.detector import DetectorRun, ExportSpec
from training.learn.ports import DetectorTrainer
from training.learn.teacher import TeacherBoxFile, TeacherLabeller
from training.manifest import ManifestFile
from training.ports import ObjectStore
from training.settings import Settings
from training.yolo import YoloExporter

SERVER_EXPORT = ExportSpec(imgsz=640)
EDGE_EXPORTS = (ExportSpec(imgsz=320, int8=True), ExportSpec(imgsz=320, half=True))
TEACHER_SOURCES = ("qr4change",)


class DetectorCommands:
    def __init__(self, settings: Settings, store: ObjectStore) -> None:
        self._settings = settings
        self._cache = settings.require_cache()
        self._store = store

    def teacher(self, args: argparse.Namespace) -> None:
        from training.learn.adapters.owl_teacher import OwlTeacher  # noqa: PLC0415 (GPU only)

        rows = [r for r in self._manifest().read() if r.source == args.source and r.split]
        labeller = TeacherLabeller(OwlTeacher(), self._cache)
        records = labeller.label(rows)
        TeacherBoxFile(self._cache, args.source).write(records, self._store)
        boxes = [b.label for r in records for b in r.boxes]
        counts = {k: boxes.count(k) for k in set(boxes)}
        print(json.dumps({"photos": len(records), "boxes": counts}))

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

    def embedder_export(self, args: argparse.Namespace) -> None:
        """SigLIP vision tower to ONNX, checked against the torch vectors on 32 val photos."""
        from training.learn.adapters.siglip_embedder import (  # noqa: PLC0415 (GPU only)
            SiglipImageEmbedder,
        )
        from training.learn.adapters.siglip_export import (  # noqa: PLC0415 (GPU only)
            SiglipOnnxExporter,
        )

        embedder = SiglipImageEmbedder()
        rows = [r for r in self._manifest().read() if r.split == "val"][:: 40][:32]
        paths = [self._cache / str(r.local_path) for r in rows]
        reference = np.array(embedder.embed(paths))
        pixels = embedder.pixels(paths)
        exporter = SiglipOnnxExporter(embedder)
        for model in exporter.export(self._settings.outside_repo(Path(args.out))):
            agreement = exporter.agreement(model, pixels, reference)
            print(f"{model} ({model.stat().st_size / 1e6:.0f} MB): min cosine {agreement:.4f}")

    def _manifest(self) -> ManifestFile:
        return ManifestFile(self._cache, self._settings.datasets_dir, self._store)

    @staticmethod
    def _detector() -> DetectorTrainer:
        from training.learn.adapters.ultralytics_detector import (  # noqa: PLC0415 (GPU only)
            UltralyticsDetector,
        )

        return UltralyticsDetector()
