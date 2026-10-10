"""ImageEmbedder over Bedrock Titan Multimodal Embeddings G1 (amazon.titan-embed-image-v1)."""

from __future__ import annotations

import base64
import json
import math
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from pathlib import Path
from typing import TYPE_CHECKING

from botocore.exceptions import BotoCoreError, ClientError
from PIL import Image, ImageOps

from training.domain import ExternalServiceError
from training.learn.ports import ImageEmbedder

if TYPE_CHECKING:
    from mypy_boto3_bedrock_runtime import BedrockRuntimeClient

MODEL_ID = "amazon.titan-embed-image-v1"
DIMENSIONS = 1024
# The ml service sends the same JPEG: longest side 1024 px, quality 90.
MAX_SIDE = 1024
JPEG_QUALITY = 90
WORKERS = 6
ATTEMPTS = 5
# The account's on-demand quota is 200 requests a minute; stay just under it.
REQUESTS_PER_MINUTE = 190


class Pacer:
    """Spaces calls evenly across threads so the quota is never hit."""

    def __init__(self, per_minute: int) -> None:
        self._gap = 60.0 / per_minute
        self._next = time.monotonic()
        self._lock = threading.Lock()

    def wait(self) -> None:
        with self._lock:
            now = time.monotonic()
            start = max(now, self._next)
            self._next = start + self._gap
        time.sleep(max(start - now, 0.0))


class TitanImageEmbedder(ImageEmbedder):
    def __init__(self, client: BedrockRuntimeClient) -> None:
        self._client = client
        self._pacer = Pacer(REQUESTS_PER_MINUTE)

    @property
    def model(self) -> str:
        return MODEL_ID

    def embed(self, images: list[Path]) -> list[tuple[float, ...]]:
        with ThreadPoolExecutor(WORKERS) as pool:
            return list(pool.map(self._one, images))

    def _one(self, image: Path) -> tuple[float, ...]:
        body = json.dumps({
            "inputImage": base64.b64encode(self._jpeg(image)).decode("ascii"),
            "embeddingConfig": {"outputEmbeddingLength": DIMENSIONS},
        })
        for attempt in range(ATTEMPTS):
            self._pacer.wait()
            try:
                response = self._client.invoke_model(modelId=MODEL_ID, body=body)
                vector = json.loads(response["body"].read())["embedding"]
                norm = math.sqrt(sum(v * v for v in vector)) or 1.0
                return tuple(v / norm for v in vector)
            except (BotoCoreError, ClientError) as error:
                if attempt == ATTEMPTS - 1:
                    raise ExternalServiceError(f"titan embedding {image.name}: {error}") from error
                time.sleep(2**attempt)
        raise ExternalServiceError("unreachable")

    @staticmethod
    def _jpeg(image: Path) -> bytes:
        with Image.open(image) as opened:
            rgb = ImageOps.exif_transpose(opened).convert("RGB")
        rgb.thumbnail((MAX_SIDE, MAX_SIDE))
        buffer = BytesIO()
        rgb.save(buffer, format="JPEG", quality=JPEG_QUALITY)
        return buffer.getvalue()
