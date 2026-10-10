"""Immutable fact values. None of them hold a person's name or a party."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Population:
    count: int
    census_year: int | None


@dataclass(frozen=True)
class Seat:
    """An assembly or Lok Sabha constituency: its name and official number, if printed."""

    name: str
    code: str | None


@dataclass(frozen=True)
class CouncillorSeat:
    """The councillor's office for a ward and its reservation category. Never the person."""

    office: str
    reservation: str | None


@dataclass(frozen=True)
class OfficeContact:
    """An office's officially published phone or email. Never a person's own number."""

    office: str
    phone: str | None
    email: str | None


FactValue = str | int | float | Population | Seat | CouncillorSeat | OfficeContact
