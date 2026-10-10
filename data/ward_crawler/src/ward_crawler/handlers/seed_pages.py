"""Seeds the S3 crawl cache from .cache/ pages and data/wards layers (python -m ...seed_pages)."""

import argparse
import json
import sys
from collections.abc import Sequence
from pathlib import Path

import boto3

from ward_crawler.adapters.blob_page_store import BlobPageStore
from ward_crawler.adapters.cached_map_layers import layer_key
from ward_crawler.adapters.json_blobs import JsonBlobs
from ward_crawler.adapters.page_cache import PageCache
from ward_crawler.adapters.s3_blob_store import S3BlobStore
from ward_crawler.adapters.source_catalog import JsonSourceCatalog
from ward_crawler.domain.errors import WardCrawlerError
from ward_crawler.handlers.cli import PACKAGE_ROOT, REPO_ROOT


def seed_pages(blobs: JsonBlobs, cache: Path) -> int:
    store = BlobPageStore(blobs)
    pages = PageCache(cache).entries()
    for stored in pages:
        store.put(stored, None)
        print(f"page {stored.page.sha256[:12]} {stored.page.url}")
    return len(pages)


def seed_layers(blobs: JsonBlobs, city: str) -> int:
    """The map layers of data/wards/<city>.json, keyed by the city box in sources/."""
    bbox = JsonSourceCatalog(PACKAGE_ROOT / "sources").load(city).bbox
    saved = json.loads((REPO_ROOT / "data" / "wards" / f"{city}.json").read_text(encoding="utf-8"))
    layers = saved.get("map_layers", [])
    for layer in layers:
        blobs.put(layer_key(layer["kind"], bbox), layer)
        print(f"layer {city} {layer['kind']} fetched {layer['fetched_at']}")
    return len(layers)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Seed the S3 crawl cache.")
    parser.add_argument("--cache", type=Path, default=PACKAGE_ROOT / ".cache")
    parser.add_argument("--layers-of", nargs="*", default=[], help="cities whose layers to copy")
    parser.add_argument("--bucket", required=True, help="the stage's originals bucket")
    parser.add_argument("--profile", default=None)
    parser.add_argument("--region", default="ap-south-1")
    args = parser.parse_args(argv)
    session = boto3.Session(profile_name=args.profile, region_name=args.region)
    blobs = JsonBlobs(S3BlobStore(session.client("s3"), args.bucket))
    try:
        pages = seed_pages(blobs, args.cache)
        layers = sum(seed_layers(blobs, city) for city in args.layers_of)
    except WardCrawlerError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    print(f"{pages} page(s) and {layers} layer(s) seeded")
    return 0


if __name__ == "__main__":
    sys.exit(main())
