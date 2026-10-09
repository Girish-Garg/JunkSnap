"""Structured JSON logging on stdout, standard library only."""

import json
import logging
import sys
from collections.abc import Mapping
from datetime import UTC, datetime

# Uvicorn installs its own plain-text handlers; these send its logs through ours instead.
UVICORN_LOGGERS = ("uvicorn", "uvicorn.error", "uvicorn.access")


class JsonFormatter(logging.Formatter):
    """Formats each log record as one JSON line, plus fixed fields such as the service name."""

    def __init__(self, fixed_fields: Mapping[str, str]) -> None:
        super().__init__()
        self._fixed_fields = dict(fixed_fields)

    def format(self, record: logging.LogRecord) -> str:
        entry: dict[str, str] = {
            "time": datetime.fromtimestamp(record.created, tz=UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            **self._fixed_fields,
        }
        if record.exc_info:
            entry["error"] = self.formatException(record.exc_info)
        return json.dumps(entry)


class JsonLogging:
    """Sends every log record, uvicorn's included, to stdout as JSON. Install once per process."""

    def __init__(self, fixed_fields: Mapping[str, str], level: int = logging.INFO) -> None:
        self._fixed_fields = dict(fixed_fields)
        self._level = level

    def install(self) -> None:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(JsonFormatter(self._fixed_fields))
        logging.basicConfig(level=self._level, handlers=[handler], force=True)
        for name in UVICORN_LOGGERS:
            logging.getLogger(name).handlers.clear()
            logging.getLogger(name).propagate = True
