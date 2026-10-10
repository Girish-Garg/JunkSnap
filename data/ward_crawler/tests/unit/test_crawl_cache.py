"""The crawl cache on a local blob store: pages, extractions and map layers. No network."""

import hashlib
import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx
import pytest
from fakes import BOX, FakeMapLayerFinder, FakePageFetcher, FakeRecordExtractor, make_page

from ward_crawler.adapters.blob_page_store import BlobPageStore
from ward_crawler.adapters.cached_map_layers import CachedMapLayers
from ward_crawler.adapters.cached_record_extractor import CachedRecordExtractor, CacheVersion
from ward_crawler.adapters.extraction_prompt import ExtractionPrompt
from ward_crawler.adapters.host_throttle import HostThrottle
from ward_crawler.adapters.http_page_fetcher import HttpPageFetcher
from ward_crawler.adapters.json_blobs import JsonBlobs
from ward_crawler.adapters.local_blob_store import LocalBlobStore
from ward_crawler.adapters.page_hashes import PageHashes, RecordingPageFetcher
from ward_crawler.adapters.page_text import HtmlText, PageTextReader, PdfText
from ward_crawler.adapters.politeness import Politeness
from ward_crawler.domain.errors import ExtractionError, FetchError, StoreError
from ward_crawler.domain.extraction import ExtractedWard, Extraction, ExtractionRequest
from ward_crawler.domain.layers import FeatureLayer, MapFeature
from ward_crawler.domain.provenance import Provenance
from ward_crawler.domain.sources import MunicipalBody, Source
from ward_crawler.domain.values import Population, Seat
from ward_crawler.domain.ward import ModelInfo

URL = "https://lsg.rajasthan.gov.in/wards"
MODEL = ModelInfo("bedrock", "apac.amazon.nova-pro-v1:0", "amazon.nova-pro-v1:0")


def blobs(tmp_path: Path) -> JsonBlobs:
    return JsonBlobs(LocalBlobStore(tmp_path))


def fetcher(answer: httpx.MockTransport, store: BlobPageStore) -> HttpPageFetcher:
    throttle = HostThrottle(0.0, sleep=lambda _s: None)
    polite = Politeness(httpx.Client(transport=answer), throttle, "ua")
    return HttpPageFetcher(polite, store, PageTextReader(HtmlText(), PdfText()))


class Site:
    """A fake official host that answers 304 when the ETag matches."""

    def __init__(self, body: bytes, etag: str) -> None:
        self.body, self.etag = body, etag
        self.conditional: list[str | None] = []
        self.down = False

    def __call__(self, request: httpx.Request) -> httpx.Response:
        if request.url.path == "/robots.txt":
            return httpx.Response(404)
        if self.down:
            raise httpx.ConnectTimeout("down", request=request)
        sent = request.headers.get("if-none-match")
        self.conditional.append(sent)
        if sent == self.etag:
            return httpx.Response(304)
        headers = {"content-type": "text/html", "etag": self.etag}
        return httpx.Response(200, content=self.body, headers=headers)


def test_pages_are_stored_with_bytes_and_revalidated_with_their_etag(tmp_path: Path) -> None:
    site = Site(b"<p>Ward 12 Paota</p>", '"v1"')
    store = BlobPageStore(blobs(tmp_path))
    first = fetcher(httpx.MockTransport(site), store).fetch(URL)

    again = fetcher(httpx.MockTransport(site), BlobPageStore(blobs(tmp_path))).fetch(URL)

    assert again == first
    assert site.conditional == [None, '"v1"']
    assert (tmp_path / "pages" / f"{first.sha256}.bin").read_bytes() == site.body
    saved = json.loads((tmp_path / "pages" / f"{first.sha256}.json").read_text(encoding="utf-8"))
    assert (saved["url"], saved["text"], saved["etag"]) == (URL, "Ward 12 Paota", '"v1"')


def test_a_changed_page_is_stored_again_and_a_dead_host_keeps_the_cached_copy(
    tmp_path: Path,
) -> None:
    site = Site(b"<p>Ward 12 Paota</p>", '"v1"')
    store = BlobPageStore(blobs(tmp_path))
    old = fetcher(httpx.MockTransport(site), store).fetch(URL)
    site.body, site.etag = b"<p>Ward 12 Paota, Ward 13 Mandore</p>", '"v2"'

    new = fetcher(httpx.MockTransport(site), store).fetch(URL)
    site.down = True
    offline = fetcher(httpx.MockTransport(site), store).fetch(URL)

    assert new.sha256 == hashlib.sha256(site.body).hexdigest() != old.sha256
    assert offline == new


def test_a_dead_host_without_a_cached_copy_still_fails(tmp_path: Path) -> None:
    site = Site(b"", '"v1"')
    site.down = True
    with pytest.raises(FetchError):
        fetcher(httpx.MockTransport(site), BlobPageStore(blobs(tmp_path))).fetch(URL)


def request(text: str = "Ward 12 | Paota | population 9,876") -> ExtractionRequest:
    bodies = (MunicipalBody("jodhpur-uttar-mc", "Nagar Nigam Jodhpur Uttar"),)
    return ExtractionRequest("jodhpur", bodies, Source(URL, "ward list", "jodhpur-uttar-mc"), text)


def answer(_request: ExtractionRequest) -> Extraction:
    facts = {"population": Population(9876, None), "assembly_seat": Seat("Jodhpur", "128")}
    ward = ExtractedWard("jodhpur-uttar-mc", 12, "Ward 12 | Paota", {**facts, "zone": "North"})
    return Extraction((ward,), MODEL)


def cached(tmp_path: Path, inner: FakeRecordExtractor, prompt: str = "p1") -> CachedRecordExtractor:
    hashes = PageHashes()
    hashes.note(make_page(URL, "Ward 12"))
    return CachedRecordExtractor(inner, blobs(tmp_path), CacheVersion(prompt, ("m1",)), hashes)


def test_an_extraction_is_reused_until_the_prompt_or_chunk_changes(tmp_path: Path) -> None:
    inner = FakeRecordExtractor(answer)
    first = cached(tmp_path, inner).extract(request())

    again = cached(tmp_path, inner)
    assert again.extract(request()) == first
    assert again.hits() == 1
    assert len(inner.requests) == 1

    cached(tmp_path, inner, prompt="p2").extract(request())
    cached(tmp_path, inner).extract(request("Ward 13 | Mandore"))
    assert len(inner.requests) == 3


def test_a_stored_extraction_names_its_prompt_models_and_page(tmp_path: Path) -> None:
    cached(tmp_path, FakeRecordExtractor(answer)).extract(request())

    (entry,) = (tmp_path / "extractions").glob("*.json")
    saved = json.loads(entry.read_text(encoding="utf-8"))

    assert saved["prompt_version"] == "p1"
    assert saved["models"] == ["m1"]
    assert saved["page_sha256"] == make_page(URL, "Ward 12").sha256
    assert saved["model"]["model"] == MODEL.model
    assert saved["wards"][0]["facts"]["population"] == {"count": 9876, "census_year": None}


def test_a_failed_extraction_is_not_stored(tmp_path: Path) -> None:
    with pytest.raises(ExtractionError):
        cached(tmp_path, FakeRecordExtractor(lambda _r: None)).extract(request())
    assert not (tmp_path / "extractions").exists()


def test_the_prompt_version_follows_the_prompt_text() -> None:
    one = CacheVersion.of(ExtractionPrompt(), ("m1",))
    assert one == CacheVersion.of(ExtractionPrompt(), ("m1",))
    assert len(one.prompt) == 16


def layer(day: int) -> FeatureLayer:
    fetched = datetime(2026, 10, day, tzinfo=UTC)
    provenance = Provenance("https://overpass.example/api", fetched, "a" * 64)
    return FeatureLayer("school", provenance, (MapFeature("osm:node/1", ((26.2, 73.0),)),))


def layers(tmp_path: Path, inner: FakeMapLayerFinder, today: int) -> CachedMapLayers:
    now = datetime(2026, 10, today, tzinfo=UTC)
    return CachedMapLayers(inner, blobs(tmp_path), timedelta(days=30), lambda: now)


def test_a_fresh_cached_layer_is_reused_and_kept_when_overpass_is_down(tmp_path: Path) -> None:
    stored = layers(tmp_path, FakeMapLayerFinder((layer(1),)), today=1).find("school", BOX)

    reused = layers(tmp_path, FakeMapLayerFinder(), today=2).find("school", BOX)
    stale_but_down = layers(tmp_path, FakeMapLayerFinder(), today=31).find("school", BOX)

    assert reused == stored == stale_but_down


def test_a_layer_with_no_cached_copy_still_fails(tmp_path: Path) -> None:
    with pytest.raises(FetchError):
        layers(tmp_path, FakeMapLayerFinder(), today=1).find("school", BOX)


def test_the_local_store_refuses_keys_outside_its_folder(tmp_path: Path) -> None:
    with pytest.raises(StoreError):
        LocalBlobStore(tmp_path / "cache").put("../escape.json", b"{}", "application/json")


def test_recording_fetcher_notes_each_page_hash() -> None:
    page = make_page(URL, "Ward 12")
    hashes = PageHashes()

    RecordingPageFetcher(FakePageFetcher({URL: page}), hashes).fetch(URL)

    assert hashes.sha_for(URL) == page.sha256
    assert hashes.sha_for("https://other.gov.in") is None
