"""Exception hierarchy for the agent package. Every error raised here is a JunkSnapError."""


class JunkSnapError(Exception):
    """Root of every error the agent raises on purpose."""


class ConfigError(JunkSnapError):
    """Settings are missing or invalid."""


class ExternalServiceError(JunkSnapError):
    """An outside service (AWS, a model provider or a third party) failed; adapters raise this."""
