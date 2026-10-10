"""In-memory fakes of the trained-model ports (A2): detector, embedder and heads."""

from collections.abc import Sequence

from ml.domain.detections import Detection, DetectionSet
from ml.domain.embedding import Embedding
from ml.domain.images import BlurredImage
from ml.domain.linear import EmbeddingHeads, MetaModel
from ml.ports.image_embedder import ImageEmbedder
from ml.ports.object_detector import ObjectDetector

TITAN = "amazon.titan-embed-image-v1"


class FakeObjectDetector(ObjectDetector):
    def __init__(self, boxes: Sequence[tuple[str, float, float]]) -> None:
        """Each box: label, confidence and its share of the image (a square at the corner)."""
        self._detections = tuple(
            Detection(label, conf, 0.0, 0.0, share**0.5, share**0.5)
            for label, conf, share in boxes
        )

    def detect(self, image: BlurredImage) -> DetectionSet:
        return DetectionSet(self._detections, "junksnap-yolo26", "yolo26s-v1", 120)


class FakeEmbedder(ImageEmbedder):
    def __init__(self, vector: tuple[float, ...], model: str = TITAN) -> None:
        self._vector = vector
        self._model = model

    def embed(self, image: BlurredImage) -> Embedding:
        return Embedding(self._vector, self._model, "v1", 300)


def two_dim_heads() -> EmbeddingHeads:
    """x[0] means waste and plastic, x[1] means paper; a strong x[0] also means fire."""
    return EmbeddingHeads.from_json({
        "version": "clf-test",
        "embedder": TITAN,
        "dim": 2,
        "groups": {
            "report_type": {"classes": ["waste_dump"], "weights": [[8.0, 0.0]], "biases": [-4.0]},
            "materials": {
                "classes": ["plastic", "paper"],
                "weights": [[8.0, 0.0], [0.0, 8.0]],
                "biases": [-4.0, -4.0],
            },
            "hazards": {"classes": ["burning"], "weights": [[8.0, 0.0]], "biases": [-7.0]},
        },
    })


def meta_model() -> MetaModel:
    signals = ["rekognition_labels", "yolo", "embedding_classifier"]
    return MetaModel.from_json({
        "version": "meta-test",
        "base": {"signals": signals, "weights": [1.0, 1.0, 1.0], "bias": 0.0},
        "judged": {"signals": [*signals, "vision_judge"], "weights": [1.0, 1.0, 1.0, 3.0],
                   "bias": 0.0},
    })
