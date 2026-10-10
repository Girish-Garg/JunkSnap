"""The prompt for ward extraction. Every model gets the same prompt and the same schema."""

import json

from ward_crawler.adapters.answer_schema import ANSWER_SCHEMA
from ward_crawler.domain.extraction import ExtractionRequest

SYSTEM = """You read official Indian government pages (web pages and PDFs, in English or \
Hindi) and copy facts about municipal wards into JSON. Follow these rules exactly.

1. Use only facts written in the text you are given. Never guess, infer, calculate or use \
outside knowledge. If a fact is not written for a ward, give null. If the text lists no \
wards, answer {"wards": []}.
2. Never write any person's name anywhere. councillor_seat is the office only (for example \
"Ward Councillor (Parshad), Ward 12") plus the seat's reservation category if printed (for \
example "OBC Woman", "SC", "General"). Never mention a political party.
3. sanitation_office: only a phone number or email printed for an office or designation \
(for example "Health Officer, Zone North"), never one printed against a person's name.
4. body: the slug of the municipal body the ward belongs to, chosen from the list given. \
ward_number: the ward's number as an integer (turn Hindi digits into 0-9).
5. evidence: copy 4 to 30 consecutive words exactly as they appear in the text that show \
this ward and its facts, for example the start of the table row. The evidence must contain \
the ward number and every number you report for the ward (such as the population). Do not \
translate or fix spelling.
6. ward_name: only a name printed as the ward's name; a list of localities or a boundary \
description is not a name. zone: the zone name as printed. population: the ward's own \
population as printed; census_year only if the text or the page description states it, \
else null. area_km2: only if printed in square kilometres.
7. assembly_seat and lok_sabha_seat: only when the text says the ward lies in that \
constituency (for example a heading "assembly constituency X (wards 1 to 22)"). A boundary \
that runs along a constituency's limit does not count, and a column that holds the municipal \
body's name is not a seat. Give the constituency's name as printed, without words such as \
"assembly constituency" or "विधानसभा क्षेत्र", and its number as digits if printed, else a null \
code.
8. Reply with one JSON object and nothing else, matching this JSON Schema:
"""


class ExtractionPrompt:
    def system(self) -> str:
        return SYSTEM + json.dumps(ANSWER_SCHEMA, ensure_ascii=False)

    def user(self, request: ExtractionRequest) -> str:
        bodies = "\n".join(f"- {body.slug}: {body.name}" for body in request.bodies)
        owner = request.source.body or "say which body each ward belongs to"
        fields = ", ".join(request.source.fields) or "any field in the schema"
        return (
            f"City: {request.city}\n"
            f"Municipal bodies (slug: name):\n{bodies}\n"
            f"Ward numbers on this page belong to: {owner}\n"
            f"This page holds: {request.source.holds}\n"
            f"Facts to read from this page: {fields}\n"
            f"Page URL: {request.source.url}\n\n"
            f"Text:\n<<<\n{request.text}\n>>>"
        )

    def repair(self, problem: str) -> str:
        return (
            f"That answer was rejected: {problem}. Reply again with one JSON object only, "
            "matching the schema, with no other text."
        )
