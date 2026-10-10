"""Maps a district id (rajasthan-jodhpur) to sources/<city>.json by the file's state and city."""

import re
import unicodedata
from pathlib import Path

from ward_crawler.adapters.source_catalog import JsonSourceCatalog
from ward_crawler.domain.sources import CitySources
from ward_crawler.ports.district_sources import DistrictSources

MAX_AREA_ID = 64


def district_id(state: str, district: str) -> str:
    """The server's district id rule: state and district, accents dropped, [a-z0-9-] only."""
    plain = unicodedata.normalize("NFKD", f"{state} {district}")
    plain = "".join(char for char in plain if not unicodedata.combining(char)).lower()
    return re.sub(r"[^a-z0-9]+", "-", plain)[:MAX_AREA_ID].strip("-")


class DistrictSourceCatalog(DistrictSources):
    def __init__(self, sources_dir: Path) -> None:
        self._sources_dir = sources_dir
        self._catalog = JsonSourceCatalog(sources_dir)

    def find(self, wanted: str) -> CitySources | None:
        for path in sorted(self._sources_dir.glob("*.json")):
            city = self._catalog.load(path.stem)
            if district_id(city.state, city.city) == wanted:
                return city
        return None
