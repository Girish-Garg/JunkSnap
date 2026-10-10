"""ImageEmbedder over our ONNX export of the SigLIP 2 vision tower (Apache-2.0), on the CPU."""

import time
from io import BytesIO
from pathlib import Path

import numpy as np
import onnxruntime as ort  # type: ignore[import-untyped]
from onnxruntime.capi.onnxruntime_pybind11_state import (  # type: ignore[import-untyped]
    Fail,
    InvalidArgument,
    RuntimeException,
)
from PIL import Image, ImageOps, UnidentifiedImageError

from ml.domain.embedding import Embedding
from ml.domain.errors import ExternalServiceError, InvalidImageError
from ml.domain.images import BlurredImage
from ml.ports.image_embedder import ImageEmbedder

MODEL_ID = "google/siglip2-base-patch16-224"
# The Hugging Face processor: squash to 224 x 224 (bilinear), scale to -1..1.
SIDE = 224


class OnnxSiglipEmbedder(ImageEmbedder):
    def __init__(self, model_path: Path, version: str) -> None:
        self._session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
        self._version = version

    def embed(self, image: BlurredImage) -> Embedding:
        started = time.monotonic()
        pixels = self._pixels(image)
        try:
            vector = self._session.run(None, {"pixel_values": pixels})[0][0]
        except (Fail, InvalidArgument, RuntimeException) as error:
            raise ExternalServiceError(f"siglip onnx inference: {error}") from error
        latency = round((time.monotonic() - started) * 1000)
        return Embedding(tuple(float(v) for v in vector), MODEL_ID, self._version, latency)

    @staticmethod
    def _pixels(image: BlurredImage) -> np.ndarray:
        try:
            with Image.open(BytesIO(image.data)) as opened:
                rgb = ImageOps.exif_transpose(opened).convert("RGB")
        except (UnidentifiedImageError, OSError) as error:
            raise InvalidImageError(f"not a usable image: {image.source}") from error
        square = rgb.resize((SIDE, SIDE), Image.Resampling.BILINEAR)
        array = np.asarray(square, dtype=np.float32) / 255.0
        return ((array - 0.5) / 0.5).transpose(2, 0, 1)[None]
