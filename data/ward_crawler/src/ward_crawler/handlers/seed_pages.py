"""Copies a local page cache into the S3 crawl cache: python -m ward_crawler.handlers.seed_pages"""

import argparse
import sys
from collections.abc import Sequence
from pathlib import Path

import boto3

from ward_crawler.adapters.blob_page_store import BlobPageStore
from ward_crawler.adapters.json_blobs import JsonBlobs
from ward_crawler.adapters.page_cache import PageCache
from ward_crawler.adapters.s3_blob_store import S3BlobStore
from ward_crawler.domain.errors import WardCrawlerError
from ward_crawler.handlers.cli import PACKAGE_ROOT


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Seed the S3 crawl cache from .cache/.")
    parser.add_argument("--cache", type=Path, default=PACKAGE_ROOT / ".cache")
    parser.add_argument("--bucket", required=True, help="the stage's originals bucket")
    parser.add_argument("--profile", default=None)
    parser.add_argument("--region", default="ap-south-1")
    args = parser.parse_args(argv)
    session = boto3.Session(profile_name=args.profile, region_name=args.region)
    store = BlobPageStore(JsonBlobs(S3BlobStore(session.client("s3"), args.bucket)))
    pages = PageCache(args.cache).entries()
    try:
        for stored in pages:
            store.put(stored, None)
            print(f"seeded {stored.page.sha256[:12]} {stored.page.url}")
    except WardCrawlerError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    print(f"{len(pages)} page(s) seeded")
    return 0


if __name__ == "__main__":
    sys.exit(main())
