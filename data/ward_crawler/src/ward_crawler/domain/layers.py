"""City-wide map layers (disposal points, schools, hospitals, water, drains) for distance checks."""

from dataclasses import dataclass

from ward_crawler.domain.provenance import Provenance


@dataclass(frozen=True)
class MapFeature:
    """One mapped place: a point, or the vertices of a line or area, as (lat, lon) pairs."""

    ref: str
    coords: tuple[tuple[float, float], ...]

    def to_json(self) -> dict[str, object]:
        return {"ref": self.ref, "coords": [[lat, lon] for lat, lon in self.coords]}


@dataclass(frozen=True)
class FeatureLayer:
    kind: str
    provenance: Provenance
    features: tuple[MapFeature, ...]

    def to_json(self) -> dict[str, object]:
        return {
            "kind": self.kind,
            "count": len(self.features),
            **self.provenance.to_json(),
            "features": [feature.to_json() for feature in self.features],
        }
