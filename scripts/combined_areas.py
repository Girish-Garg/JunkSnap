"""The map's one seamless areas layer: assembly seats where they exist, Lok Sabha seats elsewhere.

Rajasthan's Lok Sabha seats are unions of its assembly seats (data/boundaries/SOURCES.md), so
swapping them for the assembly seats leaves no gap or overlap. Each feature carries its `kind`
(`assembly` or `loksabha`) so a tap opens the right area page.
"""

from typing import Any

Feature = dict[str, Any]

# Lok Sabha seats inside the states that have assembly seats; they are drawn as assembly seats.
ASSEMBLY_STATES = ("s20-",)


def tagged(features: list[Feature], kind: str) -> list[Feature]:
    return [{**f, "properties": {**f["properties"], "kind": kind}} for f in features]


def combine(assembly: list[Feature], loksabha: list[Feature]) -> list[Feature]:
    """Assembly seats, then the Lok Sabha seats of every state without assembly seats."""
    outside = [
        f for f in loksabha if not str(f["properties"].get("id", "")).startswith(ASSEMBLY_STATES)
    ]
    return tagged(assembly, "assembly") + tagged(outside, "loksabha")
