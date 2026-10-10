"""Builds the crawl job: S3 crawl cache, cached extractor and layers, the crawls table."""

import argparse
from datetime import UTC, datetime, timedelta

import boto3
import httpx
from botocore.config import Config

from ward_crawler.adapters.answer_parser import AnswerParser
from ward_crawler.adapters.bedrock_record_extractor import BedrockRecordExtractor
from ward_crawler.adapters.blob_page_store import BlobPageStore
from ward_crawler.adapters.blob_record_store import BlobRecordStore
from ward_crawler.adapters.cached_map_layers import CachedMapLayers
from ward_crawler.adapters.cached_record_extractor import CachedRecordExtractor, CacheVersion
from ward_crawler.adapters.district_catalog import DistrictSourceCatalog
from ward_crawler.adapters.dynamo_crawl_ledger import DynamoCrawlLedger
from ward_crawler.adapters.extraction_prompt import ExtractionPrompt
from ward_crawler.adapters.host_throttle import HostThrottle
from ward_crawler.adapters.http_page_fetcher import USER_AGENT, HttpPageFetcher
from ward_crawler.adapters.json_blobs import JsonBlobs
from ward_crawler.adapters.json_schema_validator import JsonSchemaRecordValidator
from ward_crawler.adapters.model_list import ModelList
from ward_crawler.adapters.overpass_map_layers import DEFAULT_LAYERS, OverpassMapLayers
from ward_crawler.adapters.page_hashes import PageHashes, RecordingPageFetcher
from ward_crawler.adapters.page_text import HtmlText, PageTextReader, PdfText
from ward_crawler.adapters.politeness import Politeness
from ward_crawler.adapters.s3_blob_store import S3BlobStore
from ward_crawler.handlers.cli import OVERPASS_ENDPOINTS
from ward_crawler.services.crawl_job import CrawlJob, CrawlPolicy
from ward_crawler.services.source_reader import ReadLimits, SourceReader
from ward_crawler.services.ward_crawl_service import WardCrawlService


def _now() -> datetime:
    return datetime.now(UTC)


class CrawlComposition:
    def __init__(self, args: argparse.Namespace, client: httpx.Client) -> None:
        self._args = args
        self._client = client
        session = boto3.Session(profile_name=args.profile, region_name=args.region)
        self._blobs = JsonBlobs(S3BlobStore(session.client("s3"), args.bucket))
        self._table = session.resource("dynamodb").Table(args.table)
        self._hashes = PageHashes()
        models = ModelList().parse(args.models)
        retries = Config(retries={"max_attempts": 8, "mode": "adaptive"}, read_timeout=300)
        prompt = ExtractionPrompt()
        bedrock = BedrockRecordExtractor(
            session.client("bedrock-runtime", config=retries), models, prompt, AnswerParser()
        )
        version = CacheVersion.of(prompt, tuple(model.model_id for model in models))
        self._extractor = CachedRecordExtractor(bedrock, self._blobs, version, self._hashes)

    def extractor(self) -> CachedRecordExtractor:
        return self._extractor

    def policy(self) -> CrawlPolicy:
        return CrawlPolicy(
            interval=timedelta(days=self._args.interval_days),
            retry=timedelta(hours=self._args.retry_hours),
        )

    def job(self) -> CrawlJob:
        ledger = DynamoCrawlLedger(self._table)
        return CrawlJob(
            ledger, DistrictSourceCatalog(self._args.sources), self._service(), self.policy()
        )

    def _service(self) -> WardCrawlService:
        fetcher = HttpPageFetcher(
            Politeness(self._client, HostThrottle(interval_s=1.0), USER_AGENT),
            BlobPageStore(self._blobs),
            PageTextReader(HtmlText(), PdfText()),
        )
        limits = ReadLimits(chunk_chars=self._args.chunk_chars, max_chunks=self._args.max_chunks)
        overpass = OverpassMapLayers(
            self._client, OVERPASS_ENDPOINTS, HostThrottle(interval_s=5.0), DEFAULT_LAYERS
        )
        max_age = timedelta(days=self._args.interval_days)
        return WardCrawlService(
            reader=SourceReader(
                RecordingPageFetcher(fetcher, self._hashes), self._extractor, limits
            ),
            finder=CachedMapLayers(overpass, self._blobs, max_age, _now),
            validator=JsonSchemaRecordValidator(self._args.schema),
            store=BlobRecordStore(self._blobs),
        )
