"""BoxTeacher over OWLv2 (Apache-2.0) from Hugging Face transformers, on the GPU."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import torch
from PIL import Image
from torchvision.ops import nms
from transformers import Owlv2ForObjectDetection, Owlv2Processor

from training.domain import Box
from training.learn.domain import QueryHit
from training.learn.ports import BoxTeacher

FLOOR = 0.1
MERGE_IOU = 0.5


class OwlTeacher(BoxTeacher):
    def __init__(self, checkpoint: str = "google/owlv2-large-patch14-ensemble") -> None:
        self._checkpoint = checkpoint
        self._device = "cuda" if torch.cuda.is_available() else "cpu"
        self._processor: Any = Owlv2Processor.from_pretrained(checkpoint)
        self._net: Any = Owlv2ForObjectDetection.from_pretrained(checkpoint).to(self._device)
        self._net.eval()

    @property
    def model(self) -> str:
        return self._checkpoint

    def hits(self, image: Path, queries: tuple[str, ...]) -> list[QueryHit]:
        with Image.open(image) as opened:
            picture = opened.convert("RGB")
        width, height = picture.size
        inputs = self._processor(text=[list(queries)], images=picture, return_tensors="pt")
        with torch.no_grad():
            outputs = self._net(**inputs.to(self._device))
        side = max(width, height)  # OWLv2 pads to a square before predicting
        found = self._processor.post_process_grounded_object_detection(
            outputs, threshold=FLOOR, target_sizes=torch.tensor([[side, side]])
        )[0]
        keep = nms(found["boxes"], found["scores"], MERGE_IOU)
        return [self._hit(found, int(i), width, height) for i in keep]

    @staticmethod
    def _hit(found: Any, i: int, width: int, height: int) -> QueryHit:
        x0, y0, x1, y1 = (float(v) for v in found["boxes"][i])
        box = Box("teacher", x0 / width, y0 / height, (x1 - x0) / width, (y1 - y0) / height)
        clipped = box.clipped() or box
        return QueryHit(int(found["labels"][i]), clipped, float(found["scores"][i]))
