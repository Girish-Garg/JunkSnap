"""Area scores job, run by a Kubernetes CronJob. Run with: python -m pipeline.handlers.scores

No-op shell for now: it logs that it started and returns. A later task adds the scoring.
"""

import logging

from pipeline.logging_setup import configure_logging
from pipeline.settings import Settings


def main() -> None:
    """Run one scores pass."""
    settings = Settings.load()
    configure_logging({"service": "scores", "stage": settings.stage})
    logging.getLogger(__name__).info("scores started")


if __name__ == "__main__":
    main()
