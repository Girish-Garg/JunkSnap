"""Command line entry point: python -m ward_crawler.handlers.cli --city jodhpur"""

import argparse
import sys
from collections import Counter
from collections.abc import Sequence
from pathlib import Path

import boto3
import httpx
from botocore.config import Config

from ward_crawler.adapters.answer_parser import AnswerParser
from ward_crawler.adapters.bedrock_record_extractor import DEFAULT_MODELS, BedrockRecordExtractor
from ward_crawler.adapters.extraction_prompt import ExtractionPrompt
from ward_crawler.adapters.host_throttle import HostThrottle
from ward_crawler.adapters.http_page_fetcher import USER_AGENT, HttpPageFetcher
from ward_crawler.adapters.json_record_store import JsonRecordStore
from ward_crawler.adapters.json_schema_validator import JsonSchemaRecordValidator
from ward_crawler.adapters.overpass_map_layers import DEFAULT_LAYERS, OverpassMapLayers
from ward_crawler.adapters.page_cache import PageCache
from ward_crawler.adapters.page_text import HtmlText, PageTextReader, PdfText
from ward_crawler.adapters.politeness import Politeness
from ward_crawler.adapters.source_catalog import JsonSourceCatalog
from ward_crawler.domain.city import CityWards
from ward_crawler.domain.errors import WardCrawlerError
from ward_crawler.domain.extraction import ModelCall
from ward_crawler.services.source_reader import ReadLimits, SourceReader
from ward_crawler.services.ward_crawl_service import WardCrawlService

PACKAGE_ROOT = Path(__file__).resolve().parents[3]
REPO_ROOT = PACKAGE_ROOT.parents[1]
# Public mirrors are often busy, so each gets a second try after the others.
OVERPASS_ENDPOINTS = (
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
)


class Composition:
    def __init__(self, args: argparse.Namespace, client: httpx.Client) -> None:
        self._args = args
        self._client = client
        self._throttle = HostThrottle(interval_s=1.0)
        session = boto3.Session(profile_name=args.profile, region_name=args.region)
        retries = Config(retries={"max_attempts": 8, "mode": "adaptive"}, read_timeout=300)
        self._extractor = BedrockRecordExtractor(
            session.client("bedrock-runtime", config=retries),
            DEFAULT_MODELS,
            ExtractionPrompt(),
            AnswerParser(),
        )

    def extractor(self) -> BedrockRecordExtractor:
        return self._extractor

    def service(self) -> WardCrawlService:
        fetcher = HttpPageFetcher(
            Politeness(self._client, self._throttle, USER_AGENT),
            PageCache(self._args.cache),
            PageTextReader(HtmlText(), PdfText()),
        )
        limits = ReadLimits(chunk_chars=self._args.chunk_chars, max_chunks=self._args.max_chunks)
        return WardCrawlService(
            reader=SourceReader(fetcher, self._extractor, limits),
            finder=OverpassMapLayers(
                self._client, OVERPASS_ENDPOINTS, HostThrottle(interval_s=5.0), DEFAULT_LAYERS
            ),
            validator=JsonSchemaRecordValidator(self._args.schema),
            store=JsonRecordStore(self._args.out, self._args.overwrite_reviewed),
        )


class RunReport:
    def __init__(self, result: CityWards, calls: tuple[ModelCall, ...]) -> None:
        self._result = result
        self._calls = calls

    def lines(self) -> list[str]:
        result = self._result
        bodies = Counter(record.key.body for record in result.records)
        fields = ", ".join(f"{name} {count}" for name, count in result.field_counts().items())
        return [
            f"city {result.city}: {len(result.records)} ward record(s) {dict(bodies)}",
            f"fields filled: {fields}",
            f"rejected by the contract: {len(result.rejected)}",
            "map layers: " + ", ".join(f"{x.kind} {len(x.features)}" for x in result.layers),
            *self._source_lines(),
            *self._call_lines(),
        ]

    def _source_lines(self) -> list[str]:
        sources = self._result.sources
        used = sum(1 for outcome in sources if outcome.wards_found)
        lines = [f"sources: {len(sources)} tried, {used} gave wards"]
        for outcome in sources:
            lines.append(f"  [{outcome.status}] {outcome.wards_found} ward(s) {outcome.source.url}")
            lines.append(f"      {outcome.detail}")
        return lines

    def _call_lines(self) -> list[str]:
        outcomes = Counter(f"{call.model} -> {call.outcome[:60]}" for call in self._calls)
        tokens_in = sum(call.input_tokens for call in self._calls)
        tokens_out = sum(call.output_tokens for call in self._calls)
        cost = sum(call.cost_usd for call in self._calls)
        lines = [f"model calls: {len(self._calls)}, tokens in {tokens_in}, out {tokens_out}"]
        lines += [f"  {count} x {label}" for label, count in outcomes.most_common()]
        lines.append(f"rough model cost: USD {cost:.2f}")
        return lines


class Arguments:
    def parse(self, argv: Sequence[str] | None) -> argparse.Namespace:
        parser = argparse.ArgumentParser(description="Crawl official pages into ward records.")
        parser.add_argument("--city", required=True, help="name of a file in sources/")
        parser.add_argument("--sources", type=Path, default=PACKAGE_ROOT / "sources")
        parser.add_argument("--out", type=Path, default=REPO_ROOT / "data" / "wards")
        parser.add_argument("--cache", type=Path, default=PACKAGE_ROOT / ".cache")
        schema = REPO_ROOT / "contracts" / "schemas" / "ward_record.schema.json"
        parser.add_argument("--schema", type=Path, default=schema)
        parser.add_argument("--profile", default=None, help="AWS profile, e.g. junksnap")
        parser.add_argument("--region", default="ap-south-1")
        parser.add_argument("--chunk-chars", type=int, default=3_000)
        parser.add_argument("--max-chunks", type=int, default=60)
        parser.add_argument("--overwrite-reviewed", action="store_true")
        return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = Arguments().parse(argv)
    headers = {"User-Agent": USER_AGENT}
    timeout = httpx.Timeout(60.0, connect=20.0)
    try:
        city = JsonSourceCatalog(args.sources).load(args.city)
        with httpx.Client(headers=headers, timeout=timeout) as client:
            composition = Composition(args, client)
            result = composition.service().run(city)
    except WardCrawlerError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    print(f"wrote {args.out / (city.city + '.json')}")
    print("\n".join(RunReport(result, composition.extractor().usage()).lines()))
    return 0


if __name__ == "__main__":
    sys.exit(main())
