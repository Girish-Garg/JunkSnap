"""ImageEmbedder over Bedrock Titan Multimodal Embeddings G1 (amazon.titan-embed-image-v1)."""

import base64
import json
import math
import time
from io import BytesIO
from typing import TYPE_CHECKING

from botocore.exceptions import BotoCoreError, ClientError
from PIL import Image, ImageOps, UnidentifiedImageError

from ml.domain.embedding import Embedding
from ml.domain.errors import ExternalServiceError, InvalidImageError
from ml.domain.images import BlurredImage
from ml.ports.image_embedder import ImageEmbedder

if TYPE_CHECKING:
    from mypy_boto3_bedrock_runtime import BedrockRuntimeClient

MODEL_ID = "amazon.titan-embed-image-v1"
VERSION = "v1"
DIMENSIONS = 1024
# Same JPEG the heads were trained on (backend/ml/training): longest side 1024 px, quality 90.
MAX_SIDE = 1024
JPEG_QUALITY = 90


class TitanImageEmbedder(ImageEmbedder):
    def __init__(self, client: "BedrockRuntimeClient") -> None:
        self._client = client

    def embed(self, image: BlurredImage) -> Embedding:
        started = time.monotonic()
        body = json.dumps({
            "inputImage": base64.b64encode(self._jpeg(image)).decode("ascii"),
            "embeddingConfig": {"outputEmbeddingLength": DIMENSIONS},
        })
        try:
            response = self._client.invoke_model(modelId=MODEL_ID, body=body)
            vector = json.loads(response["body"].read())["embedding"]
        except (BotoCoreError, ClientError) as error:
            raise ExternalServiceError(f"titan image embedding: {error}") from error
        norm = math.sqrt(math.fsum(v * v for v in vector)) or 1.0
        latency = round((time.monotonic() - started) * 1000)
        return Embedding(tuple(v / norm for v in vector), MODEL_ID, VERSION, latency)

    @staticmethod
    def _jpeg(image: BlurredImage) -> bytes:
        try:
            with Image.open(BytesIO(image.data)) as opened:
                rgb = ImageOps.exif_transpose(opened).convert("RGB")
        except (UnidentifiedImageError, OSError) as error:
            raise InvalidImageError(f"not a usable image: {image.source}") from error
        rgb.thumbnail((MAX_SIDE, MAX_SIDE))
        buffer = BytesIO()
        rgb.save(buffer, format="JPEG", quality=JPEG_QUALITY)
        return buffer.getvalue()
