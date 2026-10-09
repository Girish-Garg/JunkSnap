"""Loads sources/<city>.json: the official URLs to crawl and what each one holds."""

from pathlib import Path

from pydantic import BaseModel, ConfigDict, ValidationError

from ward_crawler.domain.errors import SourceListError
from ward_crawler.domain.sources import BoundingBox, CitySources, MunicipalBody, Source
from ward_crawler.domain.ward import FACT_FIELDS


class _Frozen(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class _Body(_Frozen):
    slug: str
    name: str


class _Box(_Frozen):
    south: float
    west: float
    north: float
    east: float


class _Source(_Frozen):
    url: str
    holds: str
    body: str | None = None
    fields: list[str] = []

    def to_domain(self) -> Source:
        return Source(self.url, self.holds, self.body, tuple(self.fields))


class _Skipped(_Frozen):
    url: str
    why: str


class _SourceFile(_Frozen):
    city: str
    state: str
    note: str = ""
    bbox: _Box
    bodies: list[_Body]
    sources: list[_Source]
    not_used: list[_Skipped] = []

    def to_domain(self) -> CitySources:
        return CitySources(
            city=self.city,
            state=self.state,
            bodies=tuple(MunicipalBody(body.slug, body.name) for body in self.bodies),
            bbox=BoundingBox(self.bbox.south, self.bbox.west, self.bbox.north, self.bbox.east),
            sources=tuple(item.to_domain() for item in self.sources),
            note=self.note,
        )

    def unknown_names(self) -> list[str]:
        slugs = {body.slug for body in self.bodies}
        bodies = [item.body for item in self.sources if item.body and item.body not in slugs]
        fields = [name for item in self.sources for name in item.fields if name not in FACT_FIELDS]
        return bodies + fields


class JsonSourceCatalog:
    def __init__(self, sources_dir: Path) -> None:
        self._sources_dir = sources_dir

    def load(self, city: str) -> CitySources:
        path = self._sources_dir / f"{city}.json"
        try:
            parsed = _SourceFile.model_validate_json(path.read_text(encoding="utf-8"))
        except (OSError, ValidationError) as error:
            raise SourceListError(f"{path}: {error}") from error
        unknown = parsed.unknown_names()
        if unknown:
            raise SourceListError(f"{path}: unknown body or field names: {unknown}")
        return parsed.to_domain()
