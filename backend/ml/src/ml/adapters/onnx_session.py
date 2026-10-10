"""Opens ONNX models with onnxruntime on the CPU; a file it cannot load is a ConfigError."""

from pathlib import Path
from typing import Any

import onnxruntime as ort  # type: ignore[import-untyped]
from onnxruntime.capi.onnxruntime_pybind11_state import (  # type: ignore[import-untyped]
    Fail,
    InvalidArgument,
    InvalidGraph,
    InvalidProtobuf,
    NoModel,
    NoSuchFile,
    RuntimeException,
)

from ml.domain.errors import ConfigError

LOAD_ERRORS = (Fail, InvalidArgument, InvalidGraph, InvalidProtobuf, NoModel, NoSuchFile,
               RuntimeException)
RUN_ERRORS = (Fail, InvalidArgument, RuntimeException)


class OnnxSessionLoader:
    @staticmethod
    def open(path: Path) -> Any:
        try:
            return ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
        except LOAD_ERRORS as error:
            raise ConfigError(f"cannot load model {path.name}: {error}") from error
