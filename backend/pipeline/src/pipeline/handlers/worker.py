"""Queue worker that long-polls SQS. Run with: python -m pipeline.handlers.worker

No-op shell for now: it logs that it started and returns. A later task adds the poll loop.
"""

import logging

from pipeline.logging_setup import JsonLogging
from pipeline.settings.core import CoreSettings


def main() -> None:
    """Start the worker."""
    settings = CoreSettings.load()
    JsonLogging({"service": "worker", "stage": settings.stage}).install()
    logging.getLogger(__name__).info("worker started")


if __name__ == "__main__":
    main()
