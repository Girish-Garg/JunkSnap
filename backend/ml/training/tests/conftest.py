from pathlib import Path

import pytest
from training.class_map import ClassMap
from training.ports import ObjectStore

REPO = Path(__file__).resolve().parents[4]


class FakeStore(ObjectStore):
    def __init__(self) -> None:
        self.uploaded: dict[str, bytes] = {}

    def upload_file(self, local: Path, key: str) -> None:
        self.uploaded[key] = local.read_bytes()

    def read(self, key_or_uri: str) -> bytes | None:
        return self.uploaded.get(key_or_uri.removeprefix("s3://fake-bucket/"))

    @property
    def is_remote(self) -> bool:
        return True

    def uri(self, key: str) -> str | None:
        return f"s3://fake-bucket/{key}"


@pytest.fixture
def class_map() -> ClassMap:
    return ClassMap.load(REPO / "data" / "datasets" / "class_map.json")


@pytest.fixture
def store() -> FakeStore:
    return FakeStore()
