import json

import pytest
from fakes import make_page

from ward_crawler.adapters.answer_parser import AnswerParser
from ward_crawler.adapters.host_throttle import HostThrottle
from ward_crawler.adapters.page_text import HtmlText, PageTextReader, PdfText
from ward_crawler.domain.errors import ExtractionError, FetchError
from ward_crawler.domain.values import CouncillorSeat, Seat


def answer(**ward: object) -> str:
    base = {"body": "uttar", "ward_number": 7, "evidence": "Ward 7"}
    return json.dumps({"wards": [{**base, **ward}]}, ensure_ascii=False)


def test_parser_reads_json_inside_a_code_fence_and_converts_hindi_digits() -> None:
    seat = {"name": "सूरसागर", "code": "१२३"}
    text = "```json\n" + answer(assembly_seat=seat) + "\n```"

    ward = AnswerParser().parse(text)[0]

    assert ward.facts["assembly_seat"] == Seat("सूरसागर", "123")


def test_parser_drops_office_text_that_names_a_person() -> None:
    named = {"office": "Shri Example, Councillor", "reservation": None}
    office = {"office": "Ward Councillor, Ward 7", "reservation": "OBC Woman"}

    assert "councillor_seat" not in AnswerParser().parse(answer(councillor_seat=named))[0].facts
    kept = AnswerParser().parse(answer(councillor_seat=office))[0].facts["councillor_seat"]
    assert kept == CouncillorSeat("Ward Councillor, Ward 7", "OBC Woman")


def test_parser_drops_an_office_contact_without_phone_or_email() -> None:
    contact = {"office": "Health Officer, Zone North", "phone": None, "email": " "}

    assert AnswerParser().parse(answer(sanitation_office=contact))[0].facts == {}


@pytest.mark.parametrize("text", ["no json here", '{"wards": [{"ward_number": 1}]}', "{"])
def test_parser_rejects_answers_that_are_not_valid(text: str) -> None:
    with pytest.raises(ExtractionError):
        AnswerParser().parse(text)


def test_html_tables_become_one_line_per_row() -> None:
    html = (
        "<html><head><title>x</title><script>var a=1;</script></head><body>"
        "<table><tr><th>Ward</th><th>Name</th></tr>"
        "<tr><td>12</td><td>Paota &amp; Mandore</td></tr></table></body></html>"
    )

    text = HtmlText().convert(html)

    assert text.splitlines() == ["| Ward | Name", "| 12 | Paota & Mandore"]


def test_reader_refuses_unknown_content_types() -> None:
    reader = PageTextReader(HtmlText(), PdfText())

    with pytest.raises(FetchError):
        reader.read(b"\x89PNG", "image/png", "utf-8")
    with pytest.raises(FetchError):
        reader.read(b"%PDF-1.4 broken", "application/pdf", "utf-8")


def test_throttle_waits_one_interval_per_host_only() -> None:
    now = [100.0]
    slept: list[float] = []
    throttle = HostThrottle(1.0, clock=lambda: now[0], sleep=slept.append)

    throttle.wait("https://lsg.rajasthan.gov.in/a")
    now[0] += 0.25
    throttle.wait("https://lsg.rajasthan.gov.in/b")
    throttle.wait("https://censusindia.gov.in/c")

    assert slept == [0.75]


def test_page_splits_on_lines_and_finds_snippets_ignoring_spacing() -> None:
    page = make_page("https://x.gov.in", "Ward 1 | A\nWard 2 | B\nWard 3 | C\n")

    assert page.chunks(22) == ("Ward 1 | A\nWard 2 | B\n", "Ward 3 | C\n")
    assert page.supports("ward 2  |b")
    assert not page.supports("Ward 4")


def test_pdf_text_is_cut_at_page_breaks_when_pages_fit() -> None:
    text = "[page 1]\nWard 1 | A\nheading 1-2\n[page 2]\nWard 3 | C\n"
    page = make_page("https://x.gov.in/a.pdf", text)

    assert page.chunks(40) == ("[page 1]\nWard 1 | A\nheading 1-2\n", "[page 2]\nWard 3 | C\n")


def test_snippets_with_small_copy_slips_still_match_but_numbers_must_be_on_the_page() -> None:
    row = "3 3 जोध्ुर- दक्षिण 7656 सीमा रावो की बगेची से वन र ववभाग िैर/न रगर नन रगम\n"
    page = make_page("https://x.gov.in", row)

    assert page.supports("3 3 जोध्ुर- दक्षिण 7656 सीमा रावो की बगेची से वन विभाग")
    assert not page.supports("3 3 जोध्ुर- दक्षिण 7665 सीमा रावो की बगेची से")
    assert not page.supports("4 4 कुछ और लिखा है जो पेज पर नहीं है")
