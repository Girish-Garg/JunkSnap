import os
from io import BytesIO
from pathlib import Path

import numpy as np
import pytest
from PIL import Image

from ml.adapters.onnx_yolo import PAD_GREY, Letterbox, OnnxYoloDetector
from ml.domain.images import BlurredImage


def test_letterbox_centres_a_wide_photo_and_pads_grey() -> None:
    tensor, scale, left, top = Letterbox(64).tensor(Image.new("RGB", (128, 64), (255, 0, 0)))
    assert tensor.shape == (1, 3, 64, 64) and tensor.dtype == np.float32
    assert (scale, left, top) == (0.5, 0, 16)
    assert tensor[0, 0, 32, 32] == pytest.approx(1.0)
    assert tensor[0, 1, 0, 0] == pytest.approx(PAD_GREY / 255)


@pytest.mark.skipif(not os.environ.get("JUNKSNAP_YOLO_ONNX"), reason="needs a trained model file")
def test_the_trained_model_runs_on_a_photo() -> None:
    detector = OnnxYoloDetector(Path(os.environ["JUNKSNAP_YOLO_ONNX"]), "local")
    buffer = BytesIO()
    Image.new("RGB", (640, 480), (90, 90, 90)).save(buffer, format="JPEG")
    found = detector.detect(BlurredImage("media/reports/rpt_x.jpg", buffer.getvalue()))
    assert found.model == "junksnap-yolo26" and found.latency_ms >= 0
    assert all(0.0 <= d.x0 <= d.x1 <= 1.0 for d in found.detections)
