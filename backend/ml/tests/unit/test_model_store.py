import hashlib
import json
from pathlib import Path

import pytest
from botocore.exceptions import ClientError

from ml.adapters.s3_model_store import S3ModelStore
from ml.domain.errors import ConfigError, ExternalServiceError
from ml.domain.model_files import ModelPins, PinnedModel
from ml.settings.models import ModelSettings

WEIGHTS = b"onnx-bytes"


class FakeS3:
    def __init__(self, objects: dict[str, bytes]) -> None:
        self._objects = objects
        self.downloads = 0

    def download_file(self, bucket: str, key: str, filename: str) -> None:
        self.downloads += 1
        if key not in self._objects:
            raise ClientError({"Error": {"Code": "404", "Message": "missing"}}, "GetObject")
        Path(filename).write_bytes(self._objects[key])


def pin(data: bytes = WEIGHTS, key: str = "models/yolo/y.onnx") -> PinnedModel:
    return PinnedModel("yolo", key, hashlib.sha256(data).hexdigest(), len(data), "v1")


def store(s3: FakeS3, folder: Path, bucket: str = "b") -> S3ModelStore:
    return S3ModelStore(s3, bucket, folder)  # type: ignore[arg-type]


def test_downloads_once_and_verifies_the_hash(tmp_path: Path) -> None:
    s3 = FakeS3({"models/yolo/y.onnx": WEIGHTS})
    path = store(s3, tmp_path).fetch(pin())
    again = store(s3, tmp_path).fetch(pin())
    assert path == again and path.read_bytes() == WEIGHTS and s3.downloads == 1


def test_a_file_with_the_wrong_hash_is_refused_and_removed(tmp_path: Path) -> None:
    s3 = FakeS3({"models/yolo/y.onnx": b"tampered!!"})
    with pytest.raises(ConfigError, match="SHA-256"):
        store(s3, tmp_path).fetch(pin())
    assert not any(tmp_path.rglob("*.onnx*"))


def test_missing_object_or_bucket_fails_loudly(tmp_path: Path) -> None:
    with pytest.raises(ExternalServiceError):
        store(FakeS3({}), tmp_path).fetch(pin())
    with pytest.raises(ConfigError):
        store(FakeS3({}), tmp_path, bucket="").fetch(pin())


def test_pins_live_under_the_models_prefix() -> None:
    with pytest.raises(ConfigError):
        pin(key="datasets/x.onnx")
    raw = {"models": {"meta": {"key": "models/meta/m.json", "sha256": "0" * 64,
                               "size_bytes": 3, "version": "meta-v1"}}}
    assert ModelPins.from_json(raw).get("meta").version == "meta-v1"
    with pytest.raises(ConfigError):
        ModelPins.from_json(raw).get("yolo")


def test_committed_pins_name_every_trained_model() -> None:
    pins = ModelSettings.pins()
    assert {"yolo", "heads", "meta"} <= set(pins.models)
    assert all(len(p.sha256) == 64 for p in pins.models.values())
    assert json.dumps(sorted(pins.models))
