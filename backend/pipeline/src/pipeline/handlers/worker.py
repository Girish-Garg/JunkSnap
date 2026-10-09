"""Queue worker that long-polls SQS. Run with: python -m pipeline.handlers.worker

No-op shell for now: it logs that it started and returns. A later task adds the poll loop.
"""

import logging

from pipeline.logging_setup import configure_logging
from pipeline.settings import Settings


def main() -> None:
    """Start the worker."""
    settings = Settings.load()
    configure_logging({"service": "worker", "stage": settings.stage})
    logging.getLogger(__name__).info("worker started")


if __name__ == "__main__":
    main()
