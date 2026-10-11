"""Composition and hazards read from image labels with plain keyword lists."""

from collections.abc import Mapping
from types import MappingProxyType

from ml.domain.insights import HazardSighting, Insights, InsightSource, MaterialShare
from ml.domain.labels import DetectedLabel

# Lower-case label names per material. No "cable": overhead power lines get that label.
MATERIAL_LABELS: Mapping[str, frozenset[str]] = MappingProxyType(
    {
        # Rekognition calls loose carry bags "Bag"; on Indian streets they are mostly plastic.
        "plastic": frozenset(
            {"plastic", "plastic bag", "bag", "plastic wrap", "polythene", "bottle"}
        ),
        "organic": frozenset({"food", "vegetable", "fruit", "compost", "peel", "produce"}),
        "construction_debris": frozenset(
            {"rubble", "brick", "bricks", "concrete", "gravel", "cement", "debris", "tile"}
        ),
        "paper": frozenset({"paper", "cardboard", "carton", "newspaper"}),
        "glass": frozenset({"glass", "jar", "broken glass"}),
        "metal": frozenset({"metal", "tin", "can", "aluminium", "scrap", "steel", "iron"}),
        "textile": frozenset({"clothing", "fabric", "textile", "apparel", "shoe", "footwear"}),
        "e_waste": frozenset(
            {"electronics", "computer", "monitor", "battery", "television", "keyboard"}
        ),
        "medical": frozenset({"syringe", "mask", "pill", "medicine", "bandage"}),
    }
)
HAZARD_LABELS: Mapping[str, frozenset[str]] = MappingProxyType(
    {
        "burning": frozenset({"fire", "smoke", "flame", "bonfire", "ash"}),
        "medical_waste": MATERIAL_LABELS["medical"],
        "e_waste": MATERIAL_LABELS["e_waste"],
        "dead_animal": frozenset({"carcass", "dead animal", "roadkill"}),
        "chemicals": frozenset({"chemical", "barrel", "oil spill"}),
    }
)
HAZARD_MIN_CONFIDENCE = 0.6  # ML_LABEL_HAZARD_MIN


class LabelInsights:
    def __init__(
        self,
        materials: Mapping[str, frozenset[str]] = MATERIAL_LABELS,
        hazards: Mapping[str, frozenset[str]] = HAZARD_LABELS,
        hazard_min: float = HAZARD_MIN_CONFIDENCE,
    ) -> None:
        self._materials = dict(materials)
        self._hazards = dict(hazards)
        self._hazard_min = hazard_min

    def read(self, labels: tuple[DetectedLabel, ...], source: InsightSource) -> Insights:
        """Relative shares of the materials seen (best label each); no size class from labels."""
        weights: dict[str, float] = {}
        for label in labels:
            material = self._material(label.name.lower())
            if material is not None:
                weights[material] = max(weights.get(material, 0.0), label.confidence)
        total = sum(weights.values())
        shares = {material: weight / total for material, weight in weights.items()}
        return Insights(
            composition=MaterialShare.from_weights(shares, source),
            hazards=self._sightings(labels, source),
        )

    def _material(self, name: str) -> str | None:
        return next((m for m, names in self._materials.items() if name in names), None)

    def _sightings(
        self, labels: tuple[DetectedLabel, ...], source: InsightSource
    ) -> tuple[HazardSighting, ...]:
        best: dict[str, float] = {}
        for label in labels:
            for hazard, names in self._hazards.items():
                if label.name.lower() in names and label.confidence >= self._hazard_min:
                    best[hazard] = max(best.get(hazard, 0.0), label.confidence)
        return tuple(HazardSighting(hazard, conf, source) for hazard, conf in best.items())
