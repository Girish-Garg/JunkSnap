"""HTTP adapters against httpx.MockTransport: no network."""

import hashlib
import json
from collections.abc import Callable
from pathlib import Path

import httpx
import pytest
from fakes import BOX

from ward_crawler.adapters.host_throttle import HostThrottle
from ward_crawler.adapters.http_page_fetcher import HttpPageFetcher
from ward_crawler.adapters.overpass_map_layers import OverpassLayer, OverpassMapLayers
from ward_crawler.adapters.page_cache import PageCache
from ward_crawler.adapters.page_text import HtmlText, PageTextReader, PdfText
from ward_crawler.adapters.politeness import Politeness
from ward_crawler.domain.errors import FetchError

DOWN = "https://overpass-down.example/api/interpreter"
UP = "https://overpass-up.example/api/interpreter"
OSM = {
    "elements": [
        {"type": "node", "id": 1, "lat": 26.812345678, "lon": 75.79},
        {"type": "way", "id": 2, "center": {"lat": 26.9, "lon": 75.73}},
        {
            "type": "way",
            "id": 3,
            "geometry": [{"lat": 26.1, "lon": 73.0}, {"lat": 26.2, "lon": 73.1}],
        },
    ]
}
LAYERS = (OverpassLayer("school", ('nwr["amenity"="school"]',), "center"),)


def no_wait() -> HostThrottle:
    return HostThrottle(0.0, sleep=lambda _seconds: None)


def test_overpass_falls_back_to_the_next_endpoint_and_keeps_provenance() -> None:
    asked: list[str] = []

    def answer(request: httpx.Request) -> httpx.Response:
        asked.append(request.content.decode())
        if request.url.host == "overpass-down.example":
            return httpx.Response(504, text="<html>Gateway Time-out</html>")
        return httpx.Response(200, content=json.dumps(OSM).encode())

    client = httpx.Client(transport=httpx.MockTransport(answer))
    finder = OverpassMapLayers(client, (DOWN, UP), no_wait(), LAYERS)

    layer = finder.find("school", BOX)

    assert finder.kinds() == ("school",)
    assert [(item.ref, item.coords) for item in layer.features] == [
        ("osm:node/1", ((26.81235, 75.79),)),
        ("osm:way/2", ((26.9, 75.73),)),
        ("osm:way/3", ((26.1, 73.0), (26.2, 73.1))),
    ]
    assert "amenity%22%3D%22school" in asked[0]
    assert layer.provenance.source_url.startswith(UP + "?data=")
    assert layer.provenance.page_sha256 == hashlib.sha256(json.dumps(OSM).encode()).hexdigest()
    assert finder.describe("school").url == UP


def test_overpass_raises_when_every_endpoint_fails() -> None:
    client = httpx.Client(transport=httpx.MockTransport(lambda _r: httpx.Response(500)))

    with pytest.raises(FetchError, match="overpass-down.example"):
        OverpassMapLayers(client, (DOWN,), no_wait(), LAYERS).find("school", BOX)


def fetcher(answer: Callable[[httpx.Request], httpx.Response], tmp_path: Path) -> HttpPageFetcher:
    client = httpx.Client(transport=httpx.MockTransport(answer))
    polite = Politeness(client, no_wait(), "JunkSnap-ward-crawler")
    return HttpPageFetcher(polite, PageCache(tmp_path), PageTextReader(HtmlText(), PdfText()))


def test_fetcher_hashes_the_bytes_converts_html_and_caches(tmp_path: Path) -> None:
    html = b"<html><body><p>Ward 12 Paota</p></body></html>"
    hits: list[str] = []

    def answer(request: httpx.Request) -> httpx.Response:
        hits.append(request.url.path)
        if request.url.path == "/robots.txt":
            return httpx.Response(404)
        return httpx.Response(200, content=html, headers={"content-type": "text/html"})

    subject = fetcher(answer, tmp_path)
    first = subject.fetch("https://lsg.rajasthan.gov.in/wards")
    second = subject.fetch("https://lsg.rajasthan.gov.in/wards")

    assert first.text == "Ward 12 Paota"
    assert first.sha256 == hashlib.sha256(html).hexdigest()
    assert second == first
    assert hits == ["/robots.txt", "/wards"]


def test_fetcher_turns_http_errors_into_fetch_errors(tmp_path: Path) -> None:
    with pytest.raises(FetchError, match="404"):
        fetcher(lambda _r: httpx.Response(404), tmp_path).fetch("https://jodhpurmc.org/missing")


def test_fetcher_obeys_robots_txt(tmp_path: Path) -> None:
    def answer(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/robots.txt":
            return httpx.Response(200, text="User-agent: *\nDisallow: /private/\n")
        return httpx.Response(200, text="ok")

    with pytest.raises(FetchError, match="robots.txt"):
        fetcher(answer, tmp_path).fetch("https://x.gov.in/private/wards")


def test_fetcher_follows_redirects_hop_by_hop_and_honours_retry_after(tmp_path: Path) -> None:
    asked: list[str] = []
    busy = [True]

    def answer(request: httpx.Request) -> httpx.Response:
        asked.append(f"{request.url.host}{request.url.path}")
        if request.url.path == "/robots.txt":
            return httpx.Response(404)
        if request.url.host == "old.gov.in":
            return httpx.Response(301, headers={"location": "https://new.gov.in/wards"})
        if busy.pop() if busy else False:
            return httpx.Response(503, headers={"retry-after": "7"})
        return httpx.Response(200, text="Ward 1")

    page = fetcher(answer, tmp_path).fetch("https://old.gov.in/wards")

    assert page.text == "Ward 1"
    assert asked == [
        "old.gov.in/robots.txt",
        "old.gov.in/wards",
        "new.gov.in/robots.txt",
        "new.gov.in/wards",
        "new.gov.in/wards",
    ]
