"""HTTP transport. The only module that touches the network.

Redirects are refused: urllib would otherwise forward the Authorization header to whatever
host a redirect names. Response bodies are size-capped. Errors carry only the exception class.
"""

from __future__ import annotations

import http.client
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Protocol

from app.dbtez.errors import TransportError

MAX_BODY_BYTES = 64 * 1024 * 1024


@dataclass(frozen=True)
class HttpResponse:
    status: int
    headers: dict[str, str]
    body: bytes


class Transport(Protocol):
    def send(
        self, method: str, url: str, headers: dict[str, str], body: bytes | None, timeout: float
    ) -> HttpResponse: ...


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: D401
        return None


class UrllibTransport:
    def __init__(self) -> None:
        self._opener = urllib.request.build_opener(_NoRedirect)

    def send(
        self, method: str, url: str, headers: dict[str, str], body: bytes | None, timeout: float
    ) -> HttpResponse:
        request = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
            with self._opener.open(request, timeout=timeout) as response:
                return HttpResponse(response.status, _lower(response.headers), _read(response))
        except urllib.error.HTTPError as exc:
            try:
                return HttpResponse(exc.code, _lower(exc.headers), _read(exc))
            finally:
                exc.close()
        except TimeoutError:
            raise TransportError("The server did not answer in time (read timeout)", "timeout") from None
        except urllib.error.URLError as exc:
            reason = exc.reason
            if isinstance(reason, TimeoutError):
                raise TransportError("Could not connect in time (connect timeout)", "connect") from None
            raise TransportError(f"Could not connect ({type(reason).__name__})", "connect") from None
        except (OSError, http.client.HTTPException, ValueError) as exc:
            raise TransportError(f"Network error ({type(exc).__name__})") from None


def _read(stream) -> bytes:
    data = stream.read(MAX_BODY_BYTES + 1)
    if len(data) > MAX_BODY_BYTES:
        raise TransportError("Response body too large")
    return data


def _lower(headers) -> dict[str, str]:
    return {k.lower(): v for k, v in headers.items()} if headers else {}
