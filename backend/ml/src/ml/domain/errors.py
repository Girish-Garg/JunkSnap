"""Exception hierarchy for the ml package. Every error raised here is a JunkSnapError."""


class JunkSnapError(Exception):
    """Root of every error the ml package raises on purpose."""


class ConfigError(JunkSnapError):
    """Settings are missing or invalid."""


class ExternalServiceError(JunkSnapError):
    """An outside service (AWS, a model provider or a third party) failed; adapters raise this."""


class ProviderError(ExternalServiceError):
    """One model provider call failed: throttled, unavailable, refused or timed out."""


class NoProviderAnsweredError(JunkSnapError):
    """Every provider in a task's order was skipped, failed or gave an invalid answer."""


class NotBlurredImageError(JunkSnapError):
    """An image did not come from the blurred `media/` area, so no model may see it."""


class InvalidImageError(JunkSnapError):
    """Image bytes are empty or in a format the models do not accept."""


class InvalidClaimError(JunkSnapError):
    """A report type and context that are not a pair in the contract, or an unknown purpose."""
