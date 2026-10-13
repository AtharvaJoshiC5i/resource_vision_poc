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


def map_billable_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    mapped: list[dict[str, Any]] = []

    for raw in rows:
        row = build_row_index(raw)

        month_key = parse_month_key(
            pick(row, "Date", "date", "month", "month_key"),
        )

        employee_id = as_string(
            pick(row, "Employee Code", "employee_code", "employee_id"),
        )

        if month_key is None or employee_id == "":
            continue

        proposal_number = as_string(
            pick(row, "Proposal No", "proposal_no", "proposal_number"),
        )
        project_name = as_string(
            pick(row, "Project Name", "project_name"),
            "Unnamed Project",
        )
        project_id = proposal_number if proposal_number != "" else project_name

        total_hours = as_float(pick(row, "Total Hours", "total_hours"))
        billable_hours = as_float(
            pick(row, "B-Hours", "b_hours", "billable_hours"),
            total_hours,
        )
        non_inv_hours = as_float(
            pick(row, "Non-Inv Hours", "non_inv_hours", "non_billable_hours"),
        )

        mapped.append(
            {
                "employee_id": employee_id,
                "month_key": month_key,
                "year": month_year(month_key),
                "project_id": project_id,
                "proposal_number": proposal_number,
                "project_name": project_name,
                "billing_type": "Billable",
                "work_category": "Project",
                "billable_hours": billable_hours,
                "non_billable_hours": non_inv_hours,
                "leave_hours": 0,
                "actual_effort_hours": total_hours,
                "total_logged_hours": total_hours,
            },
        )

    return mapped


def map_non_billable_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    mapped: list[dict[str, Any]] = []

    for raw in rows:
        row = build_row_index(raw)

        month_key = parse_month_key(
            pick(row, "Month", "month", "date", "month_key"),
        )

        employee_id = as_string(
            pick(row, "Employee Code", "employee_code", "employee_id"),
        )

        if month_key is None or employee_id == "":
            continue

        proposal_number = as_string(
            pick(row, "Proposal No", "proposal_no", "proposal_number"),
        )
        project_name = as_string(
            pick(row, "Project Name", "project_name"),
            "Non-Billable Activity",
        )
        project_id = proposal_number if proposal_number != "" else project_name

        total_hours = as_float(pick(row, "Total Hours", "total_hours"))

        mapped.append(
            {
                "employee_id": employee_id,
                "month_key": month_key,
                "year": month_year(month_key),
                "project_id": project_id,
                "proposal_number": proposal_number,
                "project_name": project_name,
                "billing_type": "Non-Billable",
                "work_category": "Internal",
                "billable_hours": 0,
                "non_billable_hours": total_hours,
                "leave_hours": 0,
                "actual_effort_hours": total_hours,
                "total_logged_hours": total_hours,
            },
        )

    return mapped


def merge_famstack(
    billable_rows: list[dict[str, Any]],
    non_billable_rows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    return billable_rows + non_billable_rows


def map_sql_billable_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    mapped: list[dict[str, Any]] = []

    for row in rows:
        employee_id = as_string(row.get("employee_code"))
        month_key = parse_month_key(row.get("month_key")) or ""

        if employee_id == "" or month_key == "":
            continue

        proposal_number = as_string(row.get("proposal_number"))
        project_name = as_string(row.get("project_name"), "Unnamed Project")
        project_id = (
            as_string(row.get("project_id"))
            or proposal_number
            or project_name
        )

        total_hours = as_float(row.get("total_hours"))
        billable_hours = as_float(row.get("billable_hours"), total_hours)
        non_inv_hours = as_float(row.get("non_inv_hours"))

        year_value = row.get("year")
        year = int(year_value) if year_value is not None else month_year(month_key)

        mapped.append(
            {
                "employee_id": employee_id,
                "month_key": month_key,
                "year": year,
                "project_id": project_id,
                "proposal_number": proposal_number,
                "project_name": project_name,
                "billing_type": "Billable",
                "work_category": "Project",
                "billable_hours": billable_hours,
                "non_billable_hours": non_inv_hours,
                "leave_hours": 0,
                "actual_effort_hours": total_hours,
                "total_logged_hours": total_hours,
            },
        )

    return mapped


def map_sql_non_billable_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    mapped: list[dict[str, Any]] = []

    for row in rows:
        employee_id = as_string(row.get("employee_code"))
        month_key = parse_month_key(row.get("month_key")) or ""

        if employee_id == "" or month_key == "":
            continue

        proposal_number = as_string(row.get("proposal_number"))
        project_name = as_string(row.get("project_name"), "Non-Billable Activity")
        project_id = (
            as_string(row.get("project_id"))
            or proposal_number
            or project_name
        )

        total_hours = as_float(row.get("total_hours"))
        year_value = row.get("year")
        year = int(year_value) if year_value is not None else month_year(month_key)

        mapped.append(
            {
                "employee_id": employee_id,
                "month_key": month_key,
                "year": year,
                "project_id": project_id,
                "proposal_number": proposal_number,
                "project_name": project_name,
                "billing_type": "Non-Billable",
                "work_category": "Internal",
                "billable_hours": 0,
                "non_billable_hours": total_hours,
                "leave_hours": 0,
                "actual_effort_hours": total_hours,
                "total_logged_hours": total_hours,
            },
        )

    return mapped
