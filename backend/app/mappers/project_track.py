from __future__ import annotations

from typing import Any

from app.mappers.utils import (
    as_float,
    as_string,
    build_row_index,
    month_year,
    parse_month_key,
    pick,
)


def _map_employee_tagging(value: str) -> str:
    normalized = value.strip().upper().replace(" ", "_")

    if normalized in {"", "TAGGED", "ASSIGNED"}:
        return "TAGGED"

    if "UNASSIGNED" in normalized or normalized == "UNASSIGNED_GRADE_DEMAND":
        return "UNASSIGNED_GRADE_DEMAND"

    return normalized if normalized else "TAGGED"


def _map_project_status(value: str) -> str:
    normalized = value.strip().lower()
    if normalized in {"planned", "planning", "pipeline"}:
        return "Planned"
    return "Active"


def _map_lifecycle_stage(value: str) -> str:
    normalized = value.strip().lower()
    if normalized in {"planning", "presales", "initiation"}:
        return "Planning"
    return "Delivery"


def _map_contract_type(value: str) -> str:
    normalized = value.strip().lower()
    if "fixed" in normalized:
        return "Fixed Price"
    return "Time & Material"


def map_project_track_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    mapped: list[dict[str, Any]] = []

    for raw in rows:
        row = build_row_index(raw)

        month_key = as_string(
            pick(row, "month_key", "month_key_normalized"),
        )

        if month_key == "":
            month_key = parse_month_key(
                pick(row, "month_name", "calendar_year", "year"),
            ) or ""

        if month_key == "":
            year = pick(row, "year", "calendar_year")
            month_number = pick(row, "month_number", "calendar_month")
            if year is not None and month_number is not None:
                month_key = f"{int(year):04d}-{int(month_number):02d}"

        if month_key == "":
            continue

        employee_tagging_raw = as_string(
            pick(row, "employee_tagging", "employee_tagging_label"),
            "TAGGED",
        )
        employee_tagging = _map_employee_tagging(employee_tagging_raw)

        employee_id = as_string(pick(row, "employee_id"))
        employee_name = as_string(pick(row, "employee_name"))

        if employee_tagging == "UNASSIGNED_GRADE_DEMAND":
            employee_id = ""
            employee_name = ""

        mapped.append(
            {
                "project_id": as_string(pick(row, "project_id")),
                "proposal_number": as_string(pick(row, "proposal_number")),
                "project_name": as_string(
                    pick(row, "project_name", "sub_project_name"),
                    "Unnamed Project",
                ),
                "month_key": month_key,
                "year": month_year(month_key),
                "fiscal_year": as_string(pick(row, "fiscal_year")),
                "fiscal_quarter": as_string(pick(row, "fiscal_quarter")),
                "effort_value": as_float(
                    pick(row, "effort_value", "effort_value_mp"),
                ),
                "primary_capability": as_string(
                    pick(row, "primary_capability", "primary_practice"),
                ),
                "secondary_capability": as_string(
                    pick(row, "secondary_capability", "secondary_practice"),
                ),
                "department": as_string(pick(row, "department")),
                "grade": as_string(pick(row, "grade")),
                "location": as_string(pick(row, "location")),
                "country": as_string(pick(row, "country")),
                "employee_id": employee_id,
                "employee_name": employee_name,
                "employee_tagging": employee_tagging,
                "project_status": _map_project_status(
                    as_string(pick(row, "project_status"), "Active"),
                ),
                "lifecycle_stage": _map_lifecycle_stage(
                    as_string(pick(row, "lifecycle_stage"), "Delivery"),
                ),
                "contract_type": _map_contract_type(
                    as_string(pick(row, "contract_type"), "Time & Material"),
                ),
                "start_date": as_string(pick(row, "start_date")),
                "end_date": as_string(pick(row, "end_date")),
            },
        )

    return mapped


def map_sql_project_track_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    mapped: list[dict[str, Any]] = []

    for row in rows:
        month_key = parse_month_key(row.get("month_key")) or ""

        if month_key == "":
            continue

        employee_tagging = _map_employee_tagging(
            as_string(row.get("employee_tagging"), "TAGGED"),
        )

        employee_id = as_string(row.get("employee_id"))
        employee_name = as_string(row.get("employee_name"))

        if employee_tagging == "UNASSIGNED_GRADE_DEMAND":
            employee_id = ""
            employee_name = ""

        project_id = as_string(row.get("project_id"))
        proposal_number = as_string(row.get("proposal_number"))

        if project_id == "":
            project_id = proposal_number

        mapped.append(
            {
                "project_id": project_id,
                "proposal_number": proposal_number,
                "project_name": as_string(row.get("project_name"), "Unnamed Project"),
                "month_key": month_key,
                "year": int(row.get("year") or month_year(month_key)),
                "fiscal_year": as_string(row.get("fiscal_year")),
                "fiscal_quarter": as_string(row.get("fiscal_quarter")),
                "effort_value": as_float(row.get("effort_value")),
                "primary_capability": as_string(row.get("primary_capability")),
                "secondary_capability": as_string(row.get("secondary_capability")),
                "department": as_string(row.get("department")),
                "grade": as_string(row.get("grade")),
                "location": as_string(row.get("location")),
                "country": as_string(row.get("country")),
                "employee_id": employee_id,
                "employee_name": employee_name,
                "employee_tagging": employee_tagging,
                "project_status": _map_project_status(
                    as_string(row.get("project_status"), "Active"),
                ),
                "lifecycle_stage": _map_lifecycle_stage(
                    as_string(row.get("lifecycle_stage"), "Delivery"),
                ),
                "contract_type": _map_contract_type(
                    as_string(row.get("contract_type"), "Time & Material"),
                ),
                "start_date": as_string(row.get("start_date")),
                "end_date": as_string(row.get("end_date")),
            },
        )

    return mapped
