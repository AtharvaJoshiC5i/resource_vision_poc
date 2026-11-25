"""In-memory stand-in for the DBTEZ API. Every value is synthetic; nothing touches the network."""

from __future__ import annotations

import json
import re
from typing import Any, Callable

from app.dbtez.config import DbtezConfig, Secret
from app.dbtez.transport import HttpResponse

SENTINEL_CLIENT_ID = "SYNTHETIC-CLIENT-ID-0001"
SENTINEL_CLIENT_SECRET = "SYNTHETIC-CLIENT-SECRET-0001"
PT_OBJECT = "synthetic_project_track"
HR_OBJECT = "synthetic_zinghr"


def make_config(**overrides: Any) -> DbtezConfig:
    base = dict(
        base_url="https://dbtez.invalid",
        client_id=Secret(SENTINEL_CLIENT_ID),
        client_secret=Secret(SENTINEL_CLIENT_SECRET),
        project_track_object=PT_OBJECT,
        zinghr_object=HR_OBJECT,
        max_retries=2,
    )
    base.update(overrides)
    return DbtezConfig(**base)


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0
        self.sleeps: list[float] = []

    def time(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.now += seconds


def pt_record(code: str | None, year: int, month: int, effort: Any = 40, **extra: Any) -> dict[str, Any]:
    record = {
        "project_id": "SYN-P1",
        "Proposal Number": 1,
        "Project Name": "Synthetic Project",
        "Row ID": "SYN-SLOT-1",
        "Primary Capability": "Synthetic Capability",
        "Secondary Capability": None,
        "Department": "Synthetic Dept",
        "Grade": "G1",
        "Location": "Synthetic City",
        "Country": "Synthetic Land",
        "Employee User UUID": "00000000-0000-0000-0000-000000000000",
        "Employee Name": "Synthetic Person",
        "Employee Code": code,
        "Employee Source": "synthetic",
        "Month": f"{year}-{month:02d}",
        "Year": year,
        "Month Number": month,
        "Effort": effort,
    }
    record.update(extra)
    return record


def hr_record(code: str, **extra: Any) -> dict[str, Any]:
    record = {
        "EmployeeCode": code,
        "EmployeeID": f"ID-{code}",
        "EmployeeName": f"Synthetic {code}",
        "EmployeeStatus": "Existing",
        "DateOfJoining": "2020-01-15",
        "DateOfLeaving": None,
        "EmploymentType": "Permanent",
        "Location": "Synthetic City",
        "Grade Code": "G1",
        "Division": "Synthetic Division",
        "Department": "Synthetic Dept",
        "Business Vertical": "Synthetic Vertical",
        "Primary Practice": "Synthetic Practice",
        "Secondary Practice": None,
        "SERVICE CATEGORY": "Synthetic Service",
        "Resource Category": "Synthetic Resource",
    }
    record.update(extra)
    return record


def _compile_where(where: str | None) -> Callable[[dict[str, Any]], bool]:
    """Evaluates only the WHERE shapes this package generates. Test-only."""
    if not where:
        return lambda row: True
    expr = re.sub(r"\[Employee Code\] LIKE '([^']*)%'", lambda m: f"L({m.group(1)!r})", where)
    expr = re.sub(r"\[Employee Code\] >= '([^']*)'", lambda m: f"GE({m.group(1)!r})", expr)
    expr = re.sub(r"\[Employee Code\] < '([^']*)'", lambda m: f"LT({m.group(1)!r})", expr)
    expr = expr.replace("[Employee Code] IS NOT NULL", "(not N())")
    expr = expr.replace("[Employee Code] IS NULL", "N()")
    expr = re.sub(r"\bYear = (\d+)", r"(Y == \1)", expr)
    expr = re.sub(r"\[Month Number\] = (\d+)", r"(M == \1)", expr)
    expr = expr.replace(" AND ", " and ").replace(" OR ", " or ").replace("NOT ", "not ")
    code = compile(expr, "<where>", "eval")

    def predicate(row: dict[str, Any]) -> bool:
        value = row.get("Employee Code")
        names = {
            "L": lambda p: value is not None and str(value).upper().startswith(p),
            "N": lambda: value is None,
            "GE": lambda p: value is not None and str(value).upper() >= p.upper(),
            "LT": lambda p: value is not None and str(value).upper() < p.upper(),
            "Y": row.get("Year"),
            "M": row.get("Month Number"),
        }
        return bool(eval(code, {"__builtins__": {}}, names))  # noqa: S307 - synthetic test input only

    return predicate


class FakeDbtez:
    """Implements the documented endpoints against in-memory synthetic objects."""

    def __init__(self) -> None:
        self.objects: dict[str, dict[str, Any]] = {}
        self.requests: list[dict[str, Any]] = []
        self.issued = 0
        self.valid_tokens: set[str] = set()
        self.script: list[tuple[str, int, dict[str, str]]] = []  # (path suffix, status, headers)
        self.reject_credentials = False
        self.ignore_where = False
        self.expires_in = 3600

    # ------------------------------------------------------------------ setup helpers
    def add_object(self, name: str, columns: list[str], rows: list[dict], key: list[str] | None = None) -> None:
        self.objects[name] = {"columns": columns, "rows": rows, "key": key or []}

    def expire_all_tokens(self) -> None:
        self.valid_tokens.clear()

    def fail_next(self, suffix: str, status: int, headers: dict[str, str] | None = None) -> None:
        self.script.append((suffix, status, headers or {}))

    # ------------------------------------------------------------------ transport
    def send(self, method, url, headers, body, timeout) -> HttpResponse:
        path = url.split("invalid", 1)[1]
        record = {"method": method, "path": path, "headers": dict(headers), "body": body}
        self.requests.append(record)

        for i, (suffix, status, extra) in enumerate(self.script):
            if path.endswith(suffix):
                self.script.pop(i)
                return HttpResponse(status, {k.lower(): v for k, v in extra.items()}, b"{}")

        if path == "/auth/token/client":
            data = json.loads(body)
            if self.reject_credentials or data.get("client_secret") != SENTINEL_CLIENT_SECRET:
                return self._json(401, {"error": "synthetic rejection"})
            self.issued += 1
            token = f"synthetic-token-{self.issued}"
            self.valid_tokens.add(token)
            return self._json(200, {"access_token": token, "token_type": "Bearer", "expires_in": self.expires_in})

        if path == "/v1/health":
            return self._json(200, {"status": "ok"})  # unauthenticated, per the Client Guide

        auth = headers.get("Authorization", "")
        if not auth.startswith("Bearer ") or auth[7:] not in self.valid_tokens:
            return self._json(401, {"error": "synthetic unauthorised"})

        if path == "/v1/health":
            return self._json(200, {"status": "ok"})
        if path == "/v1/me":
            return self._json(200, {"client": "synthetic"})
        if path == "/v1/objects":
            return self._json(200, {"objects": [{"object": n, "object_type": "VIEW", "readable_columns": len(o["columns"])} for n, o in self.objects.items()]})
        match = re.fullmatch(r"/v1/objects/([^/]+)", path)
        if match and match.group(1) in self.objects:
            obj = self.objects[match.group(1)]
            return self._json(
                200,
                {"name": match.group(1), "columns": [{"name": c, "type": "text"} for c in obj["columns"]], "key_columns": obj["key"]},
            )
        match = re.fullmatch(r"/v1/objects/([^/]+)/query", path)
        if match and match.group(1) in self.objects:
            return self._query(self.objects[match.group(1)], json.loads(body))
        return self._json(404, {"error": "synthetic not found"})

    def _query(self, obj: dict[str, Any], request: dict[str, Any]) -> HttpResponse:
        limit = request["limit"]
        columns = request["columns"]
        rows = obj["rows"]
        if obj["key"]:
            offset = int(request.get("cursor") or 0)
            window = rows[offset : offset + limit]
            more = offset + limit < len(rows)
            return self._json(
                200,
                {
                    "data": [{c: r.get(c) for c in columns} for r in window],
                    "row_count": len(window),
                    "next_cursor": str(offset + limit) if more else None,
                    "truncated": False,
                },
            )
        predicate = (lambda r: True) if self.ignore_where else _compile_where(request.get("where"))
        matched = [r for r in rows if predicate(r)]
        truncated = len(matched) > limit
        window = matched[:limit]
        return self._json(
            200,
            {
                "data": [{c: r.get(c) for c in columns} for r in window],
                "row_count": len(window),
                "next_cursor": None,
                "truncated": truncated,
            },
        )

    @staticmethod
    def _json(status: int, payload: Any) -> HttpResponse:
        return HttpResponse(status, {}, json.dumps(payload).encode())

    # ------------------------------------------------------------------ assertions
    def data_requests(self) -> list[dict[str, Any]]:
        return [r for r in self.requests if r["path"] != "/auth/token/client"]

    def token_requests(self) -> list[dict[str, Any]]:
        return [r for r in self.requests if r["path"] == "/auth/token/client"]
