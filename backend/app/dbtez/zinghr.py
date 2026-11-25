"""ZingHR employee retrieval. The object's declared key is EmployeeCode, so cursor pagination is used.

Pagination follows ``next_cursor`` until it is null. A repeated cursor, a page limit breach, or a
final page still flagged ``truncated`` raises ``IncompleteResultError``.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from app.dbtez.client import DbtezClient
from app.dbtez.errors import IncompleteResultError, SchemaError
from app.dbtez.normalize import EmployeeKeyFn, clean_employee_code, clean_text, default_employee_key, parse_date

log = logging.getLogger("rv.dbtez")

KEY_FIELD = "EmployeeCode"
MAX_PAGES = 200

# Field names from the integration brief. Nothing outside this list is requested or assumed.
ZINGHR_COLUMNS = [
    "EmployeeCode",
    "EmployeeID",
    "EmployeeName",
    "EmployeeStatus",
    "DateOfJoining",
    "DateOfLeaving",
    "ExitDate",
    "DateofResignation",
    "COUNTRY",
    "Email",
    "ReportingManagerName",
    "ReportingManagerCode",
    "EmploymentType",
    "Location",
    "Grade Code",
    "Division",
    "Department",
    "Business Vertical",
    "Primary Practice",
    "Secondary Practice",
    "SERVICE CATEGORY",
    "Resource Category",
]
ZINGHR_REQUIRED = ["EmployeeCode", "EmployeeName"]


@dataclass
class HrMappingReport:
    rows: int = 0
    blank_code: int = 0
    invalid_code: int = 0
    duplicate_codes: int = 0
    unparseable_dates: int = 0
    missing_joining: int = 0
    pages: int = 0


def fetch_employees(
    client: DbtezClient,
    object_name: str,
    *,
    columns: list[str] | None = None,
    max_pages: int = MAX_PAGES,
    max_rows: int | None = None,
) -> tuple[list[dict[str, Any]], int]:
    cols = columns or ZINGHR_COLUMNS
    order_by = f"[{KEY_FIELD}] ASC"  # the cursor is scoped to the object and this order (Client Guide 2.5)
    if max_rows is not None:
        # Deliberate sample: one call for the first rows, no cursor following.
        page = client.query(object_name, columns=cols, limit=max_rows, order_by=order_by)
        return page.data, 1
    records: list[dict[str, Any]] = []
    seen_cursors: set[str] = set()
    cursor: str | None = None
    pages = 0
    while True:
        if pages >= max_pages:
            raise IncompleteResultError("ZingHR pagination exceeded the page limit")
        page = client.query(object_name, columns=cols, cursor=cursor, order_by=order_by)
        pages += 1
        records.extend(page.data)
        cursor = page.next_cursor
        if cursor is None:
            if page.truncated:
                raise IncompleteResultError("ZingHR result is truncated and no cursor was returned")
            break
        if cursor in seen_cursors:
            raise IncompleteResultError("ZingHR pagination returned a repeated cursor")
        seen_cursors.add(cursor)
    log.info("dbtez zinghr fetched %d rows in %d pages", len(records), pages)
    return records, pages


def check_declared_key(declared: tuple[str, ...]) -> None:
    """The brief says EmployeeCode is the declared key; stop if discovery disagrees."""
    if declared and KEY_FIELD not in declared:
        raise SchemaError("The ZingHR object's declared key is not EmployeeCode")


def map_zinghr_rows(
    records: list[dict[str, Any]],
    *,
    key_fn: EmployeeKeyFn = default_employee_key,
    pages: int = 0,
) -> tuple[list[dict[str, Any]], HrMappingReport]:
    """API records -> the dict rows ``engine.build_employees`` consumes.

    Every column the Azure pipeline used is present in the API object. Dates arrive as text, so they
    are parsed here and any that cannot be read are counted, never guessed.
    """
    report = HrMappingReport(pages=pages)
    rows: list[dict[str, Any]] = []
    counts: dict[str, int] = {}

    for record in records:
        report.rows += 1
        code, invalid = clean_employee_code(record.get(KEY_FIELD))
        if invalid:
            report.invalid_code += 1
        elif code is None:
            report.blank_code += 1
        key = key_fn(code) if code else None
        if key:
            counts[key] = counts.get(key, 0) + 1

        def date_of(name: str):
            raw = record.get(name)
            parsed = parse_date(raw)
            if parsed is None and clean_text(raw) is not None:
                report.unparseable_dates += 1
            return parsed

        rows.append(
            {
                "employee_key": key,
                "employee_code": code,
                "employee_name": clean_text(record.get("EmployeeName")),
                "joining_date": date_of("DateOfJoining"),
                "exit_date": date_of("ExitDate"),
                "leaving_date": date_of("DateOfLeaving"),
                "resignation_date": date_of("DateofResignation"),
                "employee_status": clean_text(record.get("EmployeeStatus")),
                "primary_capability": clean_text(record.get("Primary Practice")),
                "secondary_capability": clean_text(record.get("Secondary Practice")),
                "grade": clean_text(record.get("Grade Code")),
                "country": clean_text(record.get("COUNTRY")),
                "location": clean_text(record.get("Location")),
                "division": clean_text(record.get("Division")),
                "department": clean_text(record.get("Department")),
                "email": clean_text(record.get("Email")),
                "manager_name": clean_text(record.get("ReportingManagerName")),
                "manager_code": clean_text(record.get("ReportingManagerCode")),
                "employment_type": clean_text(record.get("EmploymentType")),
                "business_vertical": clean_text(record.get("Business Vertical")),
                # Extra fields the brief lists; the engine ignores unknown keys.
                "employee_id": clean_text(record.get("EmployeeID")),
                "service_category": clean_text(record.get("SERVICE CATEGORY")),
                "resource_category": clean_text(record.get("Resource Category")),
            }
        )

    report.duplicate_codes = sum(1 for n in counts.values() if n > 1)
    report.missing_joining = sum(1 for r in rows if r["employee_key"] and r["joining_date"] is None)
    return rows, report
