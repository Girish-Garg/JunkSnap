"""Model settings: ORIGINALS_BUCKET (reads `models/` only) and ML_MODEL_DIR; pins in models.json."""

import json
from importlib import resources

from pydantic import Field

from ml.domain.model_files import ModelPins
from ml.settings.base import EnvSettings

PINS_FILE = "models.json"


class ModelSettings(EnvSettings):
    # Empty is allowed so the app imports in tests; fetching a model then fails with ConfigError.
    originals_bucket: str = Field(default="", alias="ORIGINALS_BUCKET")
    model_dir: str = Field(default="/tmp/junksnap-models", alias="ML_MODEL_DIR")

    @staticmethod
    def pins() -> ModelPins:
        """Key, SHA-256, size and version of every trained model file, written by training."""
        text = resources.files("ml.settings").joinpath(PINS_FILE).read_text(encoding="utf-8")
        return ModelPins.from_json(json.loads(text))
