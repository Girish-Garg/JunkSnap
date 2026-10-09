"""Exception hierarchy for the pipeline package. Every error raised here is a JunkSnapError."""


class JunkSnapError(Exception):
    """Root of every error the pipeline raises on purpose."""


class ConfigError(JunkSnapError):
    """Settings are missing or invalid."""


class ExternalServiceError(JunkSnapError):
    """An outside service (AWS or a third party) failed; adapters raise this."""
