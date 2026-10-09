"""Area scores job, run by a Kubernetes CronJob. Run with: python -m pipeline.handlers.scores

No-op shell for now: it logs that it started and returns. A later task adds the scoring.
"""

import logging

from pipeline.logging_setup import JsonLogging
from pipeline.settings.core import CoreSettings


def main() -> None:
    """Run one scores pass."""
    settings = CoreSettings.load()
    JsonLogging({"service": "scores", "stage": settings.stage}).install()
    logging.getLogger(__name__).info("scores started")


if __name__ == "__main__":
    main()
