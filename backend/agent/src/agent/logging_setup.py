"""Structured JSON logging on stdout, standard library only."""

import json
import logging
import sys
from collections.abc import Mapping
from datetime import UTC, datetime


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


def configure_logging(fixed_fields: Mapping[str, str], level: int = logging.INFO) -> None:
    """Send every log record to stdout as JSON. Call once, at the start of an entry point."""
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter(fixed_fields))
    logging.basicConfig(level=level, handlers=[handler], force=True)
