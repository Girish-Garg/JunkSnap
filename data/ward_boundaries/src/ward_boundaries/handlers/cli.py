"""python -m ward_boundaries.handlers.cli --city jodhpur"""

import argparse
import json
import sys
from dataclasses import replace
from pathlib import Path
from typing import Any

import boto3
import httpx
from botocore.config import Config

from ward_boundaries.adapters.bedrock_place_extractor import BedrockPlaceExtractor
from ward_boundaries.adapters.bedrock_transliterator import BedrockTransliterator
from ward_boundaries.adapters.fetcher import USER_AGENT, CachedFetcher
from ward_boundaries.adapters.geojson_output import (
    CoverageCleaner,
    WardChecks,
    WardFeatures,
    WardMap,
)
from ward_boundaries.adapters.neighbour_check import NeighbourCheck
from ward_boundaries.adapters.overpass_gazetteer import OverpassGazetteer
from ward_boundaries.adapters.politeness import Politeness
from ward_boundaries.adapters.polling_stations import PollingStations
from ward_boundaries.adapters.seat_check import SeatCheck
from ward_boundaries.adapters.shapely_ward_builder import ShapelyWardBuilder, WardShape
from ward_boundaries.domain.models import Place, WardEvidence, WardText
from ward_boundaries.services.place_matcher import PlaceMatcher
from ward_boundaries.services.ward_texts import GazetteRows, LocalityList, WardCrossCheck

PACKAGE = Path(__file__).resolve().parents[3]
REPO = PACKAGE.parents[1]


class BoundaryRun:
    """Gathers the sources for one city and matches each ward's localities to mapped places."""

    def __init__(self, city: dict[str, Any], client: httpx.Client, profile: str | None) -> None:
        self._city = city
        cache = PACKAGE / ".cache"
        self._fetcher = CachedFetcher(Politeness(client, USER_AGENT), cache)
        self._gazetteer = OverpassGazetteer(client, cache)
        self._stations = PollingStations(cache / "eci")
        config = Config(retries={"max_attempts": 6, "mode": "adaptive"}, read_timeout=300)
        bedrock = boto3.Session(profile_name=profile, region_name="ap-south-1")
        client_bedrock = bedrock.client("bedrock-runtime", config=config)
        self.names = BedrockTransliterator(client_bedrock, cache / f"{city['city']}-en.json")
        self.places = BedrockPlaceExtractor(client_bedrock, cache)
        self.context: list[Place] = []

    def evidence(self) -> tuple[WardEvidence, ...]:
        if "boundary_gazette" in self._city:
            official = self._fetcher.fetch(self._city["boundary_gazette"])
            wards = self.places.wards(self._city["city"], official)
            return WardCrossCheck().combine(wards, wards, int(self._city["wards"]))
        gazette = self._read(self._city["gazette_copies"], GazetteRows())
        listed = self._read(self._city["locality_lists"], LocalityList())
        return WardCrossCheck().combine(gazette, listed, int(self._city["wards"]))

    def matched(self, wards: tuple[WardEvidence, ...]) -> tuple[WardEvidence, ...]:
        box = tuple(self._city["bbox"])
        named, _ = self._gazetteer.places(box)
        addressed, _ = self._stations.places(box)
        self.context = [*named, *addressed]
        names = [name for ward in wards for name in ward.listed if not name.isascii()]
        english = self.names.english(str(self._city["city"]), names)
        matched = PlaceMatcher(named, addressed, english).match(wards)
        return tuple(self._with_models(ward) for ward in matched)

    def _with_models(self, ward: WardEvidence) -> WardEvidence:
        """Adds the model that spelled each matched locality to the ward's models."""
        spelled = (self.names.model_for(listed) for listed, _ in ward.matched)
        models = tuple(dict.fromkeys([*ward.models, *(m for m in spelled if m)]))
        return replace(ward, models=models)

    def _read(self, urls: list[str], reader: GazetteRows | LocalityList) -> dict[int, WardText]:
        wards: dict[int, WardText] = {}
        for url in urls:
            for number, row in reader.parse(self._fetcher.fetch(url)).items():
                wards.setdefault(number, row)
        return wards


class Output:
    def __init__(self, city: dict[str, Any]) -> None:
        self._city = city
        self._lat0 = float(city["origin"][0])

    def write(self, shapes: tuple[WardShape, ...], context: list[Place]) -> Path:
        out = REPO / "data" / "boundaries" / f"{self._city['city']}_wards.geojson"
        features = WardFeatures(self._city["body_id"], self._city["body_name"], self._lat0)
        text = json.dumps(features.collection(shapes), ensure_ascii=False)
        out.write_text(text + "\n", encoding="utf-8", newline="\n")
        title = (
            f"{self._city['body_name']}: {len(shapes)} of {self._city['wards']} wards (unreviewed)"
        )
        dots = [(place.lon, place.lat) for place in context]
        WardMap().draw(shapes, title, out.with_suffix(".png"), dots)
        print(json.dumps(WardChecks(self._lat0).report_file(out)))
        return out


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build ward polygons for a city.")
    parser.add_argument("--city", required=True)
    parser.add_argument("--profile", default=None)
    args = parser.parse_args(argv)
    city = json.loads((PACKAGE / "sources" / f"{args.city}.json").read_text(encoding="utf-8"))
    with httpx.Client(headers={"User-Agent": USER_AGENT}, timeout=60) as client:
        run = BoundaryRun(city, client, args.profile)
        wards = run.matched(run.evidence())
    origin = (float(city["origin"][0]), float(city["origin"][1]))
    shapes, left_out = ShapelyWardBuilder(origin, float(city["reach_m"])).build(wards)
    if "seat_ranges" in city:
        seats = REPO / "data" / "boundaries" / "rajasthan_assembly.geojson"
        check = SeatCheck(seats, city["seat_ranges"], city["seat_ranges_source"])
        shapes, conflicts = check.apply(shapes)
        left_out = tuple(sorted((*left_out, *conflicts)))
    shapes = NeighbourCheck().apply(shapes)
    shapes = CoverageCleaner().clean(shapes)
    out = Output(city).write(shapes, run.context)
    print(f"wrote {out}; built {len(shapes)}, left out {len(left_out)}")
    for number, why in left_out:
        print(f"  ward {number}: {why}")
    models = run.names.used_models | run.places.used_models
    print("models used:", sorted(models) or "cached answers only")
    return 0


if __name__ == "__main__":
    sys.exit(main())
