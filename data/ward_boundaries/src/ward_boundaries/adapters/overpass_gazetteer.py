"""Named OpenStreetMap places inside a box, from the Overpass API (ODbL)."""

import hashlib
import json
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx

from ward_boundaries.domain.models import Document, Place, WardBoundariesError

ENDPOINTS = (
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
)
# Places people name a locality after: settlements, colonies, landmarks, temples, schools.
SELECTORS = (
    'nwr["place"]["name"]',
    'nwr["landuse"="residential"]["name"]',
    'nwr["amenity"]["name"]',
    'nwr["leisure"]["name"]',
    'nwr["tourism"]["name"]',
    'nwr["historic"]["name"]',
    'nwr["building"]["name"]',
)
NAME_TAGS = ("name", "name:en", "name:hi", "alt_name", "old_name")


class OverpassGazetteer:
    def __init__(self, client: httpx.Client, cache_dir: Path) -> None:
        self._client = client
        self._cache_dir = cache_dir

    def places(self, box: tuple[float, float, float, float]) -> tuple[tuple[Place, ...], Document]:
        """One query for the whole box, or (if busy mirrors refuse it) one per kind of place."""
        whole = self._cached(self._query(box, SELECTORS), rounds=1)
        if whole is None:
            parts = [self._cached(self._query(box, (kind,)), rounds=2) for kind in SELECTORS]
            found = [part for part in parts if part is not None]
            if not found:
                raise WardBoundariesError("Overpass unreachable for every kind of place")
            elements = [e for part in found for e in part[0]["elements"]]
            return tuple(self._places(elements)), found[0][1]
        return tuple(self._places(whole[0]["elements"])), whole[1]

    def _cached(self, query: str, rounds: int) -> tuple[dict[str, Any], Document] | None:
        path = self._cache_dir / f"overpass-{hashlib.sha256(query.encode()).hexdigest()[:16]}.json"
        if not path.exists():
            try:
                answer = self._ask(query, rounds)
            except WardBoundariesError:
                return None
            self._cache_dir.mkdir(parents=True, exist_ok=True)
            path.write_text(json.dumps(answer), encoding="utf-8")
        saved = json.loads(path.read_text(encoding="utf-8"))
        when = datetime.fromisoformat(saved["at"])
        return saved, Document(f"{saved['endpoint']}?data={query}", "", saved["sha256"], when)

    def _query(self, box: tuple[float, float, float, float], selectors: tuple[str, ...]) -> str:
        bbox = "({},{},{},{})".format(*box)
        parts = "".join(f"{selector}{bbox};" for selector in selectors)
        return f"[out:json][timeout:120];({parts});out center tags;"

    def _ask(self, query: str, rounds: int) -> dict[str, Any]:
        errors = []
        for endpoint in ENDPOINTS * rounds:
            try:
                response = self._client.post(endpoint, data={"data": query}, timeout=90)
                response.raise_for_status()
                elements = response.json()["elements"]
            except (httpx.HTTPError, ValueError, KeyError) as error:
                errors.append(f"{endpoint}: {type(error).__name__}")
                time.sleep(5)
                continue
            digest = hashlib.sha256(response.content).hexdigest()
            at = datetime.now(UTC).isoformat()
            return {"endpoint": endpoint, "sha256": digest, "at": at, "elements": elements}
        raise WardBoundariesError("Overpass unreachable: " + "; ".join(errors))

    def _places(self, elements: list[dict[str, Any]]) -> list[Place]:
        places = []
        for element in elements:
            where = element.get("center", element)
            if "lat" not in where:
                continue
            ref = f"osm:{element['type']}/{element['id']}"
            names = {element["tags"][tag] for tag in NAME_TAGS if tag in element.get("tags", {})}
            places += [Place(name, float(where["lat"]), float(where["lon"]), ref) for name in names]
        return places
