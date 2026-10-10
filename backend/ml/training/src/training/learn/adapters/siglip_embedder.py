"""ImageEmbedder over a local SigLIP 2 vision tower (Apache-2.0), on the GPU."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import torch
from PIL import Image, ImageOps
from transformers import AutoImageProcessor, AutoModel

from training.learn.ports import ImageEmbedder

CHECKPOINT = "google/siglip2-base-patch16-224"


class SiglipImageEmbedder(ImageEmbedder):
    def __init__(self, checkpoint: str = CHECKPOINT) -> None:
        self._checkpoint = checkpoint
        self._device = "cuda" if torch.cuda.is_available() else "cpu"
        self._processor: Any = AutoImageProcessor.from_pretrained(checkpoint)
        self._net: Any = AutoModel.from_pretrained(checkpoint).to(self._device).eval()

    @property
    def model(self) -> str:
        return self._checkpoint

    @property
    def network(self) -> Any:
        return self._net

    def embed(self, images: list[Path]) -> list[tuple[float, ...]]:
        pictures = [self._open(path) for path in images]
        inputs = self._processor(images=pictures, return_tensors="pt").to(self._device)
        with torch.no_grad():
            features = self._net.get_image_features(pixel_values=inputs["pixel_values"])
        pooled = getattr(features, "pooler_output", features)
        normed = torch.nn.functional.normalize(pooled.float(), dim=-1)
        return [tuple(row) for row in normed.cpu().tolist()]

    def pixels(self, images: list[Path]) -> Any:
        """The processor's pixel values as a NumPy array, for checking an exported model."""
        inputs = self._processor(images=[self._open(p) for p in images], return_tensors="np")
        return inputs["pixel_values"]

    @staticmethod
    def _open(path: Path) -> Image.Image:
        with Image.open(path) as opened:
            return ImageOps.exif_transpose(opened).convert("RGB")
