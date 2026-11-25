"""Exceptions for the DBTEZ client.

Messages are written to be safe to log: they never contain tokens, credentials, response
bodies, request bodies or field values. Only counts, partition labels and field names appear.
"""

from __future__ import annotations


class DbtezError(Exception):
    """Base class for every error raised by this package."""


class ConfigError(DbtezError):
    """Configuration is missing or invalid. Messages name variables, never their values."""


class TransportError(DbtezError):
    """The request never produced an HTTP response (DNS, TLS, connect, timeout).

    ``kind`` is "timeout" when the server accepted the connection but did not answer in time,
    "connect" when no connection could be made, otherwise "other".
    """

    def __init__(self, message: str, kind: str = "other"):
        super().__init__(message)
        self.kind = kind


class AuthError(DbtezError):
    """The client credentials were rejected, or a refreshed token was still rejected."""


class ApiError(DbtezError):
    """The API answered with an error status."""

    def __init__(self, status: int, message: str):
        super().__init__(f"{message} (HTTP {status})")
        self.status = status


class QueryTimeoutError(ApiError):
    """504 query_timeout: the query must be narrowed or its limit reduced; it is not retried blindly."""


class RateLimitError(ApiError):
    """The API kept answering 429 after the bounded number of retries."""


class ResponseValidationError(DbtezError):
    """A response did not have the documented shape."""


class SchemaError(DbtezError):
    """The configured object does not expose the fields this adapter needs."""


class SchemaShapeError(SchemaError):
    """The schema response was not in a recognised shape (as opposed to fields being absent)."""


class IncompleteResultError(DbtezError):
    """A result could not be retrieved completely. The partial data is discarded, never used."""
