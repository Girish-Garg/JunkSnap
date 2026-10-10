"""The crawler CronJob: python -m ward_crawler.handlers.job [--district rajasthan-jodhpur]"""

import argparse
import logging
import os
import sys
from collections.abc import Sequence
from pathlib import Path

import httpx

from ward_crawler.adapters.http_page_fetcher import USER_AGENT
from ward_crawler.adapters.system_clock import SystemClock
from ward_crawler.domain.errors import WardCrawlerError
from ward_crawler.handlers.cli import PACKAGE_ROOT, REPO_ROOT
from ward_crawler.handlers.crawl_composition import CrawlComposition

SCHEMA = REPO_ROOT / "contracts" / "schemas" / "ward_record.schema.json"


class JobArguments:
    """Flags default to the environment variables in contracts/README.md."""

    def parse(self, argv: Sequence[str] | None) -> argparse.Namespace:
        env = os.environ
        parser = argparse.ArgumentParser(description="Crawl queued and due districts.")
        parser.add_argument("--table", default=env.get("CRAWLS_TABLE"))
        parser.add_argument("--bucket", default=env.get("ORIGINALS_BUCKET"))
        parser.add_argument("--region", default=env.get("AWS_REGION", "ap-south-1"))
        parser.add_argument("--profile", default=None, help="AWS profile for a local run")
        sources = env.get("CRAWL_SOURCES_DIR", str(PACKAGE_ROOT / "sources"))
        parser.add_argument("--sources", type=Path, default=Path(sources))
        parser.add_argument("--schema", type=Path, default=Path(env.get("CRAWL_SCHEMA", SCHEMA)))
        days = float(env.get("CRAWL_INTERVAL_DAYS") or 30)
        parser.add_argument("--interval-days", type=float, default=days)
        hours = float(env.get("CRAWL_RETRY_HOURS") or 6)
        parser.add_argument("--retry-hours", type=float, default=hours)
        parser.add_argument("--models", default=env.get("CRAWL_MODELS"))
        parser.add_argument("--district", help="queue this district id now, then run the job")
        parser.add_argument("--chunk-chars", type=int, default=3_000)
        parser.add_argument("--max-chunks", type=int, default=60)
        args = parser.parse_args(argv)
        if not args.table or not args.bucket:
            parser.error("set CRAWLS_TABLE and ORIGINALS_BUCKET (or --table and --bucket)")
        return args


def run(args: argparse.Namespace) -> list[str]:
    clock = SystemClock()
    timeout = httpx.Timeout(60.0, connect=20.0)
    with httpx.Client(headers={"User-Agent": USER_AGENT}, timeout=timeout) as client:
        composition = CrawlComposition(args, client)
        job = composition.job()
        if args.district:
            job.queue(args.district, clock)
        runs = job.run(clock)
    extractor = composition.extractor()
    calls = extractor.usage()
    cost = sum(call.cost_usd for call in calls)
    lines = [f"{run.district_id}: {run.status} ({run.detail})" for run in runs]
    lines.append(f"districts crawled: {len(runs)}")
    lines.append(f"extractions reused from the cache: {extractor.hits()}")
    lines.append(f"model calls: {len(calls)}, rough cost USD {cost:.2f}")
    return lines


def main(argv: Sequence[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    args = JobArguments().parse(argv)
    try:
        lines = run(args)
    except WardCrawlerError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    print("\n".join(lines))
    return 0


if __name__ == "__main__":
    sys.exit(main())
