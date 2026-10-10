"""Exports the SigLIP 2 vision tower to ONNX for the ml service: pixels in, unit vector out."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
import onnxruntime as ort
import torch
from onnxruntime.quantization import QuantType, quantize_dynamic

from training.learn.adapters.siglip_embedder import SiglipImageEmbedder

OPSET = 18
SIDE = 224


class _UnitImageFeatures(torch.nn.Module):  # type: ignore[misc]
    def __init__(self, net: Any) -> None:
        super().__init__()
        self._net = net

    def forward(self, pixel_values: torch.Tensor) -> torch.Tensor:
        features = self._net.get_image_features(pixel_values=pixel_values)
        pooled = getattr(features, "pooler_output", features)
        return torch.nn.functional.normalize(pooled, dim=-1)


class SiglipOnnxExporter:
    def __init__(self, embedder: SiglipImageEmbedder) -> None:
        self._embedder = embedder

    def export(self, out: Path) -> tuple[Path, Path]:
        """Returns the fp32 file and a weight-only int8 copy."""
        out.parent.mkdir(parents=True, exist_ok=True)
        module = _UnitImageFeatures(self._embedder.network.float().cpu()).eval()
        dummy = torch.zeros(1, 3, SIDE, SIDE)
        torch.onnx.export(
            module, (dummy,), str(out), input_names=["pixel_values"], output_names=["embedding"],
            dynamic_axes={"pixel_values": {0: "batch"}, "embedding": {0: "batch"}},
            opset_version=OPSET, dynamo=False,
        )
        small = out.with_name(f"{out.stem}-int8.onnx")
        quantize_dynamic(str(out), str(small), weight_type=QuantType.QInt8)
        return out, small

    @staticmethod
    def agreement(model: Path, pixels: np.ndarray, reference: np.ndarray) -> float:
        """Smallest cosine similarity between the ONNX vectors and the reference vectors."""
        session = ort.InferenceSession(str(model), providers=["CPUExecutionProvider"])
        vectors = session.run(None, {"pixel_values": pixels.astype(np.float32)})[0]
        return float(np.min(np.sum(vectors * reference, axis=1)))
