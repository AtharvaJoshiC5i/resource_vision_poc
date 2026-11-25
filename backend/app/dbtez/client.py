"""Read-only client for the DBTEZ ColdFusion Data Access API.

Safety properties (each covered by tests/test_dbtez_client.py):
- Tokens and credentials live only in memory, wrapped in ``Secret`` where stored.
- Tokens, request bodies and response bodies are never logged or placed in exceptions.
- A 401 triggers exactly one token refresh and one retry of the call.
- 429, 5xx and network failures are retried a bounded number of times with backoff.
- Calls are throttled below the documented limits (120 data calls and 10 token calls per minute).
- Only GET calls and the documented read-only query POST are ever made.
"""

from __future__ import annotations

import json
import logging
import random
import threading
import time
from dataclasses import dataclass
from typing import Any, Callable
from urllib.parse import quote

from app.dbtez.config import MAX_PAGE_SIZE, DbtezConfig, Secret, validate_object_name
from app.dbtez.errors import (
    ApiError,
    AuthError,
    QueryTimeoutError,
    RateLimitError,
    ResponseValidationError,
    TransportError,
)
from app.dbtez.ratelimit import SlidingWindowLimiter
from app.dbtez.transport import Transport, UrllibTransport

log = logging.getLogger("rv.dbtez")

IDLE_LIMIT_SECONDS = 55 * 60  # the API expires a token after 1 hour of inactivity
MAX_AGE_SECONDS = 7 * 3600 + 50 * 60  # ... or 8 hours after issuance
MAX_RETRY_AFTER_SECONDS = 60.0
_TOKEN_FIELDS = ("access_token", "accessToken", "token")
EXPIRY_MARGIN_SECONDS = 60
_ERROR_CODE = __import__("re").compile(r"^[a-z_]{1,40}$")

# Documented error codes (Client Guide 2.6) and what they mean for the operator.
ERROR_HINTS = {
    "invalid_client": "client credentials are invalid, revoked or expired",
    "unauthorized": "access token expired",
    "unknown_field": "a requested column is not readable on this object",
    "invalid_query": "the query was rejected (filter, cursor or columns)",
    "denied_columns": "a requested column is not granted to this client",
    "not_found": "the object does not exist or is not accessible",
    "rate_limited": "rate limit reached",
    "query_timeout": "the query took longer than 30 seconds",
}


@dataclass(frozen=True)
class QueryResult:
    data: list[dict[str, Any]]
    row_count: int
    next_cursor: str | None
    truncated: bool


class DbtezClient:
    def __init__(
        self,
        config: DbtezConfig,
        transport: Transport | None = None,
        *,
        clock: Callable[[], float] = time.monotonic,
        sleep: Callable[[float], None] = time.sleep,
        jitter: Callable[[], float] = random.random,
    ):
        self._config = config
        self._transport = transport or UrllibTransport()
        self._clock = clock
        self._sleep = sleep
        self._jitter = jitter
        self._data_limiter = SlidingWindowLimiter(config.data_calls_per_minute, clock=clock, sleep=sleep)
        self._token_limiter = SlidingWindowLimiter(config.token_calls_per_minute, clock=clock, sleep=sleep)
        self._token: Secret | None = None
        self._expires_at: float | None = None
        self._issued_at = 0.0
        self._last_used = 0.0
        self._lock = threading.RLock()
        self.token_requests = 0
        self.data_requests = 0

    @property
    def page_size(self) -> int:
        return self._config.page_size

    # ----------------------------------------------------------------- public, read-only calls
    def health(self) -> dict[str, Any]:
        """Unauthenticated (Client Guide 2): never requests or sends a token."""
        self._data_limiter.acquire()
        try:
            response = self._transport.send(
                "GET", self._config.base_url + "/v1/health", {"Accept": "application/json"}, None, self._config.timeout_seconds
            )
        except TransportError as error:
            raise TransportError(f"{error} during GET /v1/health", error.kind) from None
        if not 200 <= response.status < 300:
            raise ApiError(response.status, "Health check failed" + _hint(response.body))
        return self._expect_dict(_parse_json(response.body))

    def me(self) -> dict[str, Any]:
        """Identity of the credential. Callers must not print it."""
        return self._expect_dict(self._call("GET", "/v1/me"))

    def list_objects(self) -> Any:
        return self._call("GET", "/v1/objects")

    def describe_object(self, name: str) -> Any:
        return self._call("GET", f"/v1/objects/{quote(validate_object_name(name), safe='')}")

    def query(
        self,
        object_name: str,
        *,
        columns: list[str],
        where: str | None = None,
        limit: int | None = None,
        cursor: str | None = None,
        order_by: str | None = None,
    ) -> QueryResult:
        if not columns:
            raise ValueError("columns must not be empty")
        size = self._config.page_size if limit is None else limit
        if not 1 <= size <= MAX_PAGE_SIZE:
            raise ValueError(f"limit must be between 1 and {MAX_PAGE_SIZE}")
        body: dict[str, Any] = {"columns": list(columns), "limit": size}
        if where:
            body["where"] = where
        if order_by:
            body["order_by"] = order_by
        if cursor:
            body["cursor"] = cursor
        payload = self._expect_dict(
            self._call("POST", f"/v1/objects/{quote(validate_object_name(object_name), safe='')}/query", body)
        )
        # ColdFusion may upper-case the envelope keys (DATA, ROW_COUNT, ...). Row field names are untouched.
        return _parse_query_result({str(k).lower(): v for k, v in payload.items()}, size)

    # ----------------------------------------------------------------- token handling
    def _ensure_token(self) -> Secret:
        with self._lock:
            now = self._clock()
            expired = (
                self._token is None
                or now - self._last_used >= IDLE_LIMIT_SECONDS
                or now - self._issued_at >= MAX_AGE_SECONDS
                or (self._expires_at is not None and now >= self._expires_at)
            )
            if expired:
                self._token, lifetime = self._authenticate()
                self._issued_at = self._clock()
                self._expires_at = (
                    self._issued_at + max(lifetime - EXPIRY_MARGIN_SECONDS, 1) if lifetime else None
                )
            self._last_used = self._clock()
            assert self._token is not None
            return self._token

    def _invalidate_token(self) -> None:
        with self._lock:
            self._token = None

    def _authenticate(self) -> tuple[Secret, float | None]:
        body = json.dumps(
            {
                "client_id": self._config.client_id.reveal(),
                "client_secret": self._config.client_secret.reveal(),
            }
        ).encode()
        url = self._config.base_url + "/auth/token/client"
        attempt = 0
        while True:
            self._token_limiter.acquire()
            self.token_requests += 1
            try:
                response = self._transport.send(
                    "POST",
                    url,
                    {"Content-Type": "application/json", "Accept": "application/json"},
                    body,
                    self._config.timeout_seconds,
                )
            except TransportError as error:
                if attempt >= self._retry_limit(error):
                    raise TransportError(f"{error} during the token request", error.kind) from None
                self._backoff(attempt, None)
                attempt += 1
                continue

            status = response.status
            if status in (401, 403):
                # invalid_client: stop, never retry in a loop (Client Guide 2.1, 2.6).
                raise AuthError("Client credentials were rejected" + _hint(response.body))
            if status == 429 or 500 <= status < 600:
                if attempt >= self._config.max_retries:
                    raise ApiError(status, "Token request failed" + _hint(response.body))
                self._backoff(attempt, _retry_after(response))
                attempt += 1
                continue
            if not 200 <= status < 300:
                raise ApiError(status, "Token request failed" + _hint(response.body))
            return _extract_token(response.body)

    # ----------------------------------------------------------------- request core
    def _call(self, method: str, path: str, body: dict[str, Any] | None = None) -> Any:
        if method == "GET":
            data = None
        elif method == "POST" and path.endswith("/query"):
            data = json.dumps(body).encode()
        else:
            raise ValueError("Only reads are permitted")  # the read-only guarantee, enforced in code

        url = self._config.base_url + path
        attempt = 0
        refreshed = False
        while True:
            token = self._ensure_token()
            headers = {"Authorization": "Bearer " + token.reveal(), "Accept": "application/json"}
            if data is not None:
                headers["Content-Type"] = "application/json"

            self._data_limiter.acquire()
            self.data_requests += 1
            try:
                response = self._transport.send(method, url, headers, data, self._config.timeout_seconds)
            except TransportError as error:
                if attempt >= self._retry_limit(error):
                    raise TransportError(f"{error} during {method} {path.split('?')[0]}", error.kind) from None
                log.warning("dbtez network error, retrying (attempt %d)", attempt + 1)
                self._backoff(attempt, None)
                attempt += 1
                continue

            status = response.status
            if 200 <= status < 300:
                return _parse_json(response.body)
            if status == 401:
                if refreshed:
                    raise AuthError("Request was unauthorised after a token refresh")
                log.info("dbtez token rejected, refreshing once")
                self._invalidate_token()
                refreshed = True
                continue
            where = f" during {method} {path.split('?')[0]}"
            if status == 504:
                # query_timeout: reduce the limit or narrow the filter; never retry blindly (2.6).
                raise QueryTimeoutError(status, "Query timed out" + _hint(response.body) + where)
            if status == 429 or 500 <= status < 600:
                if attempt >= self._config.max_retries:
                    if status == 429:
                        raise RateLimitError(status, "Rate limit still exceeded after retries" + where)
                    raise ApiError(status, "Server error after retries" + _hint(response.body) + where)
                log.warning("dbtez HTTP %d, retrying (attempt %d)", status, attempt + 1)
                self._backoff(attempt, _retry_after(response))
                attempt += 1
                continue
            # 400 unknown_field/invalid_query, 403 denied_columns, 404 not_found: fix the request, no retry.
            raise ApiError(status, "Request rejected" + _hint(response.body) + where)

    def _retry_limit(self, error: TransportError) -> int:
        """A server that accepted the connection but stayed silent is retried once, not repeatedly:
        each try costs a full timeout, so repeating it only makes a dead endpoint wait minutes."""
        if error.kind == "timeout":
            return min(self._config.max_retries, 1)
        return self._config.max_retries

    def _backoff(self, attempt: int, retry_after: str | None) -> None:
        delay: float | None = None
        if retry_after:
            try:
                delay = min(max(float(retry_after), 0.0), MAX_RETRY_AFTER_SECONDS)
            except ValueError:
                delay = None
        if delay is None:
            delay = min(30.0, 0.5 * (2**attempt)) * (0.5 + self._jitter())
        self._sleep(delay)

    @staticmethod
    def _expect_dict(value: Any) -> dict[str, Any]:
        if not isinstance(value, dict):
            raise ResponseValidationError("Response was not a JSON object")
        return value


# --------------------------------------------------------------------------- parsing helpers
def _parse_json(body: bytes) -> Any:
    try:
        return json.loads(body)
    except (ValueError, UnicodeDecodeError):
        raise ResponseValidationError("Response was not valid JSON") from None


def _extract_token(body: bytes) -> tuple[Secret, float | None]:
    """access_token plus expires_in seconds when present (Client Guide 2.1)."""
    payload = _parse_json(body)
    if isinstance(payload, dict):
        payload = {str(k).lower(): v for k, v in payload.items()}
        lifetime = payload.get("expires_in")
        try:
            seconds = float(lifetime) if lifetime is not None and not isinstance(lifetime, bool) else None
        except (TypeError, ValueError):
            seconds = None
        for name in (n.lower() for n in _TOKEN_FIELDS):
            value = payload.get(name)
            if isinstance(value, str) and value.strip():
                return Secret(value.strip()), (seconds if seconds and seconds > 0 else None)
    raise ResponseValidationError("Token response did not contain an access token")


def _error_payload(body: bytes) -> dict[str, Any]:
    try:
        payload = json.loads(body)
    except (ValueError, UnicodeDecodeError):
        return {}
    return payload if isinstance(payload, dict) else {}


def _hint(body: bytes) -> str:
    """The documented error code only (never the message or body), e.g. ' [denied_columns: ...]'."""
    payload = _error_payload(body)
    code = payload.get("error") or payload.get("code")
    if isinstance(code, dict):
        code = code.get("code")
    if not isinstance(code, str) or not _ERROR_CODE.match(code):
        return ""
    meaning = ERROR_HINTS.get(code)
    return f" [{code}: {meaning}]" if meaning else f" [{code}]"


def _retry_after(response) -> str | None:
    """details.retry_after_seconds from the body (Client Guide 2.6), else the Retry-After header."""
    details = _error_payload(response.body).get("details")
    if isinstance(details, dict):
        value = details.get("retry_after_seconds")
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return str(value)
    return response.headers.get("retry-after")


def _parse_query_result(payload: dict[str, Any], limit: int) -> QueryResult:
    data = payload.get("data")
    if not isinstance(data, list) or not all(isinstance(r, dict) for r in data):
        raise ResponseValidationError("Query response 'data' must be a list of objects")
    row_count = payload.get("row_count")
    if isinstance(row_count, bool) or not isinstance(row_count, int):
        raise ResponseValidationError("Query response 'row_count' must be an integer")
    if row_count != len(data):
        raise ResponseValidationError("Query response 'row_count' does not match the rows returned")
    if len(data) > limit:
        raise ResponseValidationError("Query response returned more rows than requested")
    truncated = payload.get("truncated")
    if not isinstance(truncated, bool):
        raise ResponseValidationError("Query response 'truncated' must be a boolean")
    cursor = payload.get("next_cursor")
    if cursor is not None and not (isinstance(cursor, str) and cursor):
        raise ResponseValidationError("Query response 'next_cursor' must be null or a non-empty string")
    return QueryResult(data=data, row_count=row_count, next_cursor=cursor, truncated=truncated)
