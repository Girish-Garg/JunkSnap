"""ObjectDetector over our YOLO26 end-to-end ONNX export, with onnxruntime on the CPU."""

import ast
import time
from io import BytesIO
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps, UnidentifiedImageError

from ml.adapters.onnx_session import RUN_ERRORS, OnnxSessionLoader
from ml.domain.detections import Detection, DetectionSet
from ml.domain.errors import ConfigError, ExternalServiceError, InvalidImageError
from ml.domain.images import BlurredImage
from ml.ports.object_detector import ObjectDetector

MODEL = "junksnap-yolo26"
PAD_GREY = 114
MIN_CONFIDENCE = 0.25


class Letterbox:
    """Ultralytics' centred letterbox: fit inside a square, pad the rest grey."""

    def __init__(self, size: int) -> None:
        self._size = size

    def tensor(self, picture: Image.Image) -> tuple[np.ndarray, float, int, int]:
        """NCHW float32 in 0..1, plus the scale and the left and top padding."""
        scale = min(self._size / picture.width, self._size / picture.height)
        width, height = round(picture.width * scale), round(picture.height * scale)
        canvas = Image.new("RGB", (self._size, self._size), (PAD_GREY,) * 3)
        left, top = (self._size - width) // 2, (self._size - height) // 2
        canvas.paste(picture.resize((width, height), Image.Resampling.BILINEAR), (left, top))
        array = np.asarray(canvas, dtype=np.float32).transpose(2, 0, 1)[None] / 255.0
        return array, scale, left, top


class OnnxYoloDetector(ObjectDetector):
    def __init__(self, model_path: Path, version: str) -> None:
        self._session = OnnxSessionLoader.open(model_path)
        meta = self._session.get_modelmeta().custom_metadata_map
        if "names" not in meta:
            raise ConfigError(f"{model_path.name} has no class names; export it with Ultralytics")
        self._names: dict[int, str] = ast.literal_eval(meta["names"])
        size = int(self._session.get_inputs()[0].shape[2])
        self._letterbox = Letterbox(size)
        self._input = self._session.get_inputs()[0].name
        self._version = version

    def detect(self, image: BlurredImage) -> DetectionSet:
        started = time.monotonic()
        picture = self._open(image)
        tensor, scale, left, top = self._letterbox.tensor(picture)
        try:
            rows = self._session.run(None, {self._input: tensor})[0][0]
        except RUN_ERRORS as error:
            raise ExternalServiceError(f"yolo onnx inference: {error}") from error
        frame = (scale, left, top, picture.width, picture.height)
        found = tuple(self._detection(row, frame) for row in rows if row[4] >= MIN_CONFIDENCE)
        latency = round((time.monotonic() - started) * 1000)
        return DetectionSet(found, MODEL, self._version, latency)

    def _detection(
        self, row: np.ndarray, frame: tuple[float, int, int, int, int]
    ) -> Detection:
        scale, left, top, width, height = frame
        x0, y0, x1, y1 = ((row[i] - (left, top)[i % 2]) / scale for i in range(4))
        return Detection(
            label=self._names[int(row[5])],
            confidence=float(row[4]),
            x0=max(float(x0) / width, 0.0),
            y0=max(float(y0) / height, 0.0),
            x1=min(float(x1) / width, 1.0),
            y1=min(float(y1) / height, 1.0),
        )

    @staticmethod
    def _open(image: BlurredImage) -> Image.Image:
        try:
            with Image.open(BytesIO(image.data)) as opened:
                return ImageOps.exif_transpose(opened).convert("RGB")
        except (UnidentifiedImageError, OSError) as error:
            raise InvalidImageError(f"not a usable image: {image.source}") from error
