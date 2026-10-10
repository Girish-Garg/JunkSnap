"""One exception hierarchy for the package, rooted at JunkSnapError."""


class JunkSnapError(Exception):
    """Root of every error raised by JunkSnap code."""


class WardCrawlerError(JunkSnapError):
    """Root of every error raised by the ward crawler."""


class FetchError(WardCrawlerError):
    """A page could not be fetched or turned into text."""


class ExtractionError(WardCrawlerError):
    """No model returned a valid extraction for a page."""


class UnsourcedFieldError(WardCrawlerError):
    """A fact arrived without its source URL, fetch time or page hash."""


class InvalidRecordError(WardCrawlerError):
    """A ward record does not match the ward_record contract."""


class SourceListError(WardCrawlerError):
    """The sources file for a city is missing or malformed."""


class StoreError(WardCrawlerError):
    """The result could not be saved without losing a person's review."""
