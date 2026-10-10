"""ECI polling stations, 2017 locations (CC0); the rougher 2014 file made wards worse."""

import hashlib
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import pyarrow.parquet as pq

from ward_boundaries.domain.models import Document, Place

RELEASES = "https://github.com/ramSeraph/indian_facilities/releases/download/elections/"


@dataclass(frozen=True)
class StationTable:
    """Where one year's file keeps the state, seat, booth number and booth name."""

    file: str
    year: int
    state: tuple[str, str]
    seat: str
    number: str
    name: str


TABLES = (
    StationTable(
        "ECI_PollingStations_2017.parquet", 2017, ("SCode", "S20"), "ACCode", "PSNumber", "PSName"
    ),
)


class PollingStations:
    """Station names carry the colony or village they serve, with a point for each station."""

    def __init__(self, folder: Path) -> None:
        self._folder = folder

    def places(self, box: tuple[float, float, float, float]) -> tuple[tuple[Place, ...], Document]:
        found: list[Place] = []
        for table in TABLES:
            if (self._folder / table.file).exists():
                found += self._read(table, box)
        main = self._folder / TABLES[0].file
        digest = hashlib.sha256(main.read_bytes()).hexdigest()
        when = datetime.fromtimestamp(main.stat().st_mtime, UTC)
        return tuple(found), Document(RELEASES + TABLES[0].file, "", digest, when)

    def _read(self, table: StationTable, box: tuple[float, float, float, float]) -> list[Place]:
        column, value = table.state
        columns = [column, table.seat, table.number, table.name, "bbox"]
        rows = pq.read_table(self._folder / table.file, columns=columns).to_pylist()
        south, west, north, east = box
        return [
            Place(
                str(row[table.name]),
                float(row["bbox"]["ymin"]),
                float(row["bbox"]["xmin"]),
                f"eci{table.year}:ac{row[table.seat]}-ps{row[table.number]}",
            )
            for row in rows
            if str(row[column]) == value
            and south <= row["bbox"]["ymin"] <= north
            and west <= row["bbox"]["xmin"] <= east
        ]
