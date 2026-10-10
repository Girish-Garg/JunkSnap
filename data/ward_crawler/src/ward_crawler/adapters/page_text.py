"""Turns fetched bytes into plain text: HTML with the standard library, PDF with pypdf."""

from html.parser import HTMLParser
from io import BytesIO

from pypdf import PdfReader
from pypdf.errors import PdfReadError

from ward_crawler.domain.errors import FetchError

_SKIP = {"script", "style", "noscript", "svg", "head"}
_BREAK = {
    "p",
    "div",
    "br",
    "tr",
    "li",
    "ul",
    "ol",
    "table",
    "section",
    "article",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "header",
    "footer",
    "nav",
    "form",
    "dt",
    "dd",
}
_CELL = {"td", "th"}


class _TextCollector(HTMLParser):
    """Keeps visible text; rows and blocks become lines, table cells are split by ' | '."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self._parts: list[str] = []
        self._skipping = 0

    def handle_starttag(self, tag: str, _attrs: list[tuple[str, str | None]]) -> None:
        if tag in _SKIP:
            self._skipping += 1
        elif tag in _CELL:
            self._parts.append(" | ")
        elif tag in _BREAK:
            self._parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in _SKIP and self._skipping:
            self._skipping -= 1
        elif tag in _BREAK:
            self._parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self._skipping and data.strip():
            self._parts.append(" ".join(data.split()))

    def text(self) -> str:
        lines = (" ".join(line.split()) for line in "".join(self._parts).splitlines())
        return "\n".join(line for line in lines if line.strip(" |"))


class HtmlText:
    def convert(self, html: str) -> str:
        collector = _TextCollector()
        collector.feed(html)
        collector.close()
        return collector.text()


class PdfText:
    def convert(self, data: bytes) -> str:
        try:
            reader = PdfReader(BytesIO(data))
            pages = [page.extract_text() or "" for page in reader.pages]
        except (PdfReadError, ValueError, KeyError) as error:
            raise FetchError(f"PDF could not be read: {error}") from error
        return "\n".join(
            f"[page {number}]\n{text}" for number, text in enumerate(pages, 1) if text.strip()
        )


class PageTextReader:
    """Picks the converter for a response body; anything but HTML, text or PDF is refused."""

    def __init__(self, html: HtmlText, pdf: PdfText) -> None:
        self._html = html
        self._pdf = pdf

    def read(self, body: bytes, content_type: str, encoding: str) -> str:
        kind = content_type.lower()
        if body.startswith(b"%PDF") or "pdf" in kind:
            return self._pdf.convert(body)
        if not kind or "html" in kind or "xml" in kind or kind.startswith("text/"):
            return self._html.convert(self._decode(body, encoding))
        raise FetchError(f"unsupported content type {content_type!r}")

    def _decode(self, body: bytes, encoding: str) -> str:
        try:
            return body.decode(encoding, errors="replace")
        except LookupError:
            return body.decode("utf-8", errors="replace")
