"""DetectorTrainer over Ultralytics YOLO (AGPL-3.0; decision 20261010-0400). Training only."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from ultralytics import YOLO

from training.learn.detector import ClassScores, DetectorReport, DetectorRun, ExportSpec
from training.learn.ports import DetectorTrainer

SEED = 26
WORKERS = 6


class UltralyticsDetector(DetectorTrainer):
    def train(self, run: DetectorRun) -> Path:
        model = YOLO(run.base)
        model.train(
            data=str(run.data), epochs=run.epochs, imgsz=run.imgsz, batch=run.batch,
            project=str(run.out), name=run.name, exist_ok=True, seed=SEED, workers=WORKERS,
            cache="ram" if run.cache_images else False, plots=True, patience=30,
        )
        return Path(model.trainer.best)

    def evaluate(self, weights: Path, data: Path, split: str) -> DetectorReport:
        model = YOLO(str(weights))
        metrics = model.val(data=str(data), split=split, plots=False, batch=32, workers=WORKERS)
        names: dict[int, str] = model.names
        counts = list(metrics.nt_per_class)
        classes = tuple(
            self._scores(names[int(c)], int(counts[int(c)]), metrics.box.class_result(i))
            for i, c in enumerate(metrics.ap_class_index)
        )
        overall = ClassScores(
            "all", int(sum(counts)), float(metrics.box.mp), float(metrics.box.mr),
            float(metrics.box.map50), float(metrics.box.map),
        )
        images = int(getattr(metrics, "nt_per_image", counts).__len__())
        return DetectorReport(str(weights), split, images, classes, overall)

    def export(self, weights: Path, spec: ExportSpec, data: Path) -> Path:
        """End-to-end ONNX (nms=False keeps YOLO26's NMS-free head): (1, 300, 6) boxes out."""
        model = YOLO(str(weights))
        extra: dict[str, Any] = {"quantize": 8, "data": str(data)} if spec.int8 else {}
        out = Path(model.export(
            format="onnx", imgsz=spec.imgsz, half=spec.half, simplify=True, dynamic=False,
            nms=False, **extra,
        ))
        named = out.with_name(f"{weights.stem}-{spec.suffix}.onnx")
        out.replace(named)
        return named

    @staticmethod
    def _scores(name: str, instances: int, result: Any) -> ClassScores:
        precision, recall, map50, map50_95 = (float(v) for v in result)
        return ClassScores(name, instances, precision, recall, map50, map50_95)
