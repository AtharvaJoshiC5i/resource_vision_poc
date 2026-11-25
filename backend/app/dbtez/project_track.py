"""Project Track monthly effort retrieval.

The object has no declared key, so cursor pagination is not used. Each calendar month is queried
with ``Year`` and ``[Month Number]`` filters. If a month is ``truncated`` it is split into disjoint
partitions on the first characters of ``[Employee Code]``. A partition that still truncates at the
maximum depth raises ``IncompleteResultError``: an incomplete month is never returned as complete.

Partitions are disjoint and cover everything (including NULL and non-alphanumeric codes through a
remainder partition), so no de-duplication is done. Duplicate source rows are real data and the
engine treats them as conflicts.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from datetime import date
from typing import Any

from app.dbtez.client import DbtezClient
from app.dbtez.config import ProjectTrackFields
from app.dbtez.errors import IncompleteResultError, ResponseValidationError
from app.dbtez.normalize import (
    EmployeeKeyFn,
    clean_employee_code,
    clean_text,
    default_employee_key,
    parse_bool,
    parse_date,
    parse_effort,
    parse_int,
)

log = logging.getLogger("rv.dbtez")

MAX_PARTITION_DEPTH = 24
MAX_CALLS_PER_MONTH = 600
_CODE = "[Employee Code]"
_SAFE_PIVOT = re.compile(r"^[A-Za-z0-9_.\-@/ ]{1,100}$")


@dataclass
class MonthFetch:
    year: int
    month: int
    rows: list[dict[str, Any]] = field(default_factory=list)
    calls: int = 0
    partitions: int = 0  # 0 means the month fit in one request
    sampled: bool = False  # True when only the first rows of the month were requested on purpose


def month_where(year: int, month: int) -> str:
    return f"Year = {int(year)} AND [Month Number] = {int(month)}"


def _range_clause(lo: str | None, hi: str | None) -> str:
    parts = [f"{_CODE} IS NOT NULL"]
    if lo is not None:
        parts.append(f"{_CODE} >= '{lo}'")
    if hi is not None:
        parts.append(f"{_CODE} < '{hi}'")
    return " AND ".join(parts)


def _pivot(sample: list[dict[str, Any]], code_field: str, lo: str | None, hi: str | None) -> str | None:
    """Median of the distinct codes seen in a truncated page, used to split a range in two.

    Any pivot gives two disjoint, exhaustive halves ([lo, pivot) and [pivot, hi)), so correctness never
    depends on how the database orders text; the pivot only has to make progress. Only a restricted
    alphabet is ever placed into a query.
    """
    codes = sorted(
        {
            str(r.get(code_field)).strip()
            for r in sample
            if r.get(code_field) is not None and _SAFE_PIVOT.match(str(r.get(code_field)).strip())
        }
    )
    codes = [c for c in codes if (lo is None or c > lo) and (hi is None or c < hi)]
    return codes[len(codes) // 2] if len(codes) >= 2 else None


def fetch_month(
    client: DbtezClient,
    object_name: str,
    year: int,
    month: int,
    fields: ProjectTrackFields,
    *,
    columns: list[str] | None = None,
    max_depth: int = MAX_PARTITION_DEPTH,
    max_calls: int = MAX_CALLS_PER_MONTH,
    sample_rows: int | None = None,
) -> MonthFetch:
    if not (1 <= month <= 12 and 1900 <= year <= 2200):
        raise ValueError("year or month out of range")
    cols = columns or fields.requested_columns()
    base = month_where(year, month)
    result = MonthFetch(year, month)

    def run(clause: str | None, label: str):
        if result.calls >= max_calls:
            raise IncompleteResultError(f"{year}-{month:02d}: call budget exhausted at partition {label}")
        result.calls += 1
        where = base if clause is None else f"{base} AND {clause}"
        page = client.query(object_name, columns=cols, where=where)
        if page.next_cursor:
            # Cursors are for keyed objects. This object has no key, so a cursor is unexpected.
            raise ResponseValidationError("Unexpected cursor from an object without a declared key")
        return page

    def incomplete(page) -> bool:
        # Fail closed: a full page is treated as incomplete even if the flag says otherwise.
        return page.truncated or page.row_count >= client.page_size

    if sample_rows is not None:
        # Deliberate sample: one call, the first rows of the month. Truncation is expected and is
        # reported through ``sampled``, never hidden, and never triggers partitioning.
        result.calls += 1
        page = client.query(object_name, columns=cols, where=base, limit=sample_rows)
        if page.next_cursor:
            raise ResponseValidationError("Unexpected cursor from an object without a declared key")
        result.rows = page.data
        result.sampled = page.truncated or page.row_count >= sample_rows
        _check_month(result.rows, fields, year, month)
        return result

    first = run(None, "all")
    if not incomplete(first):
        result.rows = first.data
        _check_month(result.rows, fields, year, month)
        return result

    # Truncated: discard the partial page and bisect by employee code. Rows with no code are fetched
    # separately, and every non-null code falls in exactly one range, so partitions are disjoint and
    # exhaustive. A range that cannot be split further raises instead of returning partial data.
    collected: list[dict[str, Any]] = []
    null_page = run(f"{_CODE} IS NULL", "null")
    result.partitions += 1
    if incomplete(null_page):
        raise IncompleteResultError(f"{year}-{month:02d}: rows without an employee code exceed one page")
    collected.extend(null_page.data)

    pending: list[tuple[str | None, str | None, list[dict[str, Any]], int]] = [(None, None, first.data, 0)]
    while pending:
        lo, hi, sample, depth = pending.pop()
        pivot = _pivot(sample, fields.employee_code, lo, hi) if depth < max_depth else None
        if pivot is None:
            label = f"[{lo or '*'}, {hi or '*'})"
            raise IncompleteResultError(f"{year}-{month:02d}: range {label} is still truncated and cannot be split further")
        for child_lo, child_hi in ((lo, pivot), (pivot, hi)):
            page = run(_range_clause(child_lo, child_hi), f"[{child_lo or '*'}, {child_hi or '*'})")
            result.partitions += 1
            if incomplete(page):
                pending.append((child_lo, child_hi, page.data, depth + 1))
            else:
                collected.extend(page.data)

    _check_month(collected, fields, year, month)
    result.rows = collected
    log.info("dbtez %d-%02d fetched %d rows in %d calls (%d partitions)", year, month, len(collected), result.calls, result.partitions)
    return result


def _check_month(rows: list[dict[str, Any]], fields: ProjectTrackFields, year: int, month: int) -> None:
    """The server filter is trusted only after checking it: rows from another month mean it was ignored."""
    for row in rows:
        if parse_int(row.get(fields.year)) != year or parse_int(row.get(fields.month_number)) != month:
            raise ResponseValidationError(f"{year}-{month:02d}: a returned row is outside the requested month")


def _proposal(value: Any) -> int | str | None:
    number = parse_int(value)
    return number if number is not None else clean_text(value)


def fetch_months(
    client: DbtezClient,
    object_name: str,
    month_keys: list[int],
    fields: ProjectTrackFields,
    *,
    columns: list[str] | None = None,
    sample_rows: int | None = None,
) -> list[MonthFetch]:
    return [
        fetch_month(client, object_name, key // 100, key % 100, fields, columns=columns, sample_rows=sample_rows)
        for key in month_keys
    ]


# --------------------------------------------------------------------------- mapping
@dataclass
class PtMappingReport:
    rows: int = 0
    blank_employee: int = 0
    invalid_employee: int = 0
    invalid_month: int = 0
    invalid_effort: int = 0
    warnings: list[str] = field(default_factory=list)


def map_project_track_rows(
    records: list[dict[str, Any]],
    fields: ProjectTrackFields,
    *,
    key_fn: EmployeeKeyFn = default_employee_key,
) -> tuple[list[dict[str, Any]], PtMappingReport]:
    """API records -> the dict rows ``engine.classify_rows`` consumes. The engine is not changed.

    Fields the API does not supply stay ``None``; they are never defaulted. Rows with a missing or
    invalid employee code get ``employee_key=None`` and are treated as untagged by the engine.
    """
    report = PtMappingReport()
    rows: list[dict[str, Any]] = []

    optional_missing = [
        name
        for name in ("sub_project", "is_override", "contract_type", "start_date", "end_date")
        if getattr(fields, name) is None
    ]
    assume_clear = fields.is_override is None and fields.assume_no_override
    if assume_clear:
        report.warnings.append("is_override is not supplied: every row is treated as not an override (owner decision).")
        optional_missing = [n for n in optional_missing if n != "is_override"]
    if optional_missing:
        report.warnings.append(
            "Not supplied by configuration, left empty: " + ", ".join(optional_missing)
            + (". Without is_override the engine marks every named row unresolved." if "is_override" in optional_missing else ".")
        )

    for record in records:
        report.rows += 1
        code, invalid = clean_employee_code(record.get(fields.employee_code))
        if invalid:
            report.invalid_employee += 1
        elif code is None:
            report.blank_employee += 1

        year = parse_int(record.get(fields.year))
        month = parse_int(record.get(fields.month_number))
        month_key: date | None = None
        if year is not None and month is not None and 1900 <= year <= 2200 and 1 <= month <= 12:
            month_key = date(year, month, 1)
        else:
            report.invalid_month += 1

        raw_effort = record.get(fields.effort)
        effort = parse_effort(raw_effort)
        if effort is None and raw_effort is not None and str(raw_effort).strip() != "":
            report.invalid_effort += 1

        def optional(name: str):
            column = getattr(fields, name)
            return record.get(column) if column else None

        rows.append(
            {
                "row_id": clean_text(record.get(fields.row_id)),
                "project_id": clean_text(record.get(fields.project_id)),
                # nvarchar in the API: keep numbers as numbers (as in Azure) and anything else as text, so
                # different proposals never collapse into one duplicate-check group.
                "proposal_number": _proposal(record.get(fields.proposal_number)),
                "sub_project_name": clean_text(optional("sub_project")),
                "employee_key": key_fn(code) if code else None,
                "employee_code": code,
                "month_key": month_key,
                "effort": effort,
                "is_override": False if assume_clear else parse_bool(optional("is_override")),
                "contract_type": clean_text(optional("contract_type")),
                "start_date": parse_date(optional("start_date")),
                "end_date": parse_date(optional("end_date")),
                # Carried for display/enrichment only; the engine ignores unknown keys.
                "project_name": clean_text(record.get(fields.project_name)),
                "employee_name": clean_text(record.get(fields.employee_name)),
                "primary_capability": clean_text(record.get("Primary Capability")),
                "secondary_capability": clean_text(record.get("Secondary Capability")),
                "department": clean_text(record.get("Department")),
                "grade": clean_text(record.get("Grade")),
                "location": clean_text(record.get("Location")),
                "country": clean_text(record.get("Country")),
            }
        )
    return rows, report
