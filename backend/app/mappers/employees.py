from __future__ import annotations

from typing import Any

from app.mappers.utils import as_string, build_row_index, pick


def _names_from_famstack_raw(rows: list[dict[str, Any]]) -> dict[str, str]:
    names: dict[str, str] = {}

    for raw in rows:
        row = build_row_index(raw)
        employee_id = as_string(
            pick(row, "Employee Code", "employee_code", "employee_id"),
        )
        employee_name = as_string(pick(row, "Member Name", "member_name"))

        if employee_id != "" and employee_name != "":
            names[employee_id] = employee_name

    return names


def derive_zinghr_employees(
    famstack_records: list[dict[str, Any]],
    project_track_records: list[dict[str, Any]],
    famstack_name_sources: list[dict[str, Any]] | None = None,
    employee_master_rows: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """
    ZingHR is not loaded from Azure in this POC.
    Employee master rows are derived from Famstack and Project Track.
    """

    employees: dict[str, dict[str, Any]] = {}
    famstack_names = _names_from_famstack_raw(famstack_name_sources or [])

    def upsert(
        employee_id: str,
        employee_name: str,
        primary_capability: str,
        secondary_capability: str,
        department: str,
        grade: str,
        location: str,
        country: str,
    ) -> None:
        if employee_id.strip() == "":
            return

        existing = employees.get(employee_id)

        if existing is None:
            employees[employee_id] = {
                "employee_id": employee_id,
                "employee_name": employee_name or employee_id,
                "email": "",
                "primary_capability": primary_capability,
                "secondary_capability": secondary_capability,
                "department": department,
                "grade": grade,
                "location": location,
                "country": country,
                "employment_status": "Active",
                "date_of_joining": "",
                "date_of_leaving": "",
                "weekly_capacity_hours": 40,
            }
            return

        if employee_name and existing["employee_name"] == employee_id:
            existing["employee_name"] = employee_name

        for field, value in (
            ("primary_capability", primary_capability),
            ("secondary_capability", secondary_capability),
            ("department", department),
            ("grade", grade),
            ("location", location),
            ("country", country),
        ):
            if value and existing[field] == "":
                existing[field] = value

    for record in employee_master_rows or []:
        upsert(
            as_string(record.get("employee_id")),
            as_string(record.get("employee_name")),
            as_string(record.get("primary_capability")),
            as_string(record.get("secondary_capability")),
            as_string(record.get("department")),
            as_string(record.get("grade")),
            as_string(record.get("location")),
            as_string(record.get("country")),
        )

    for record in project_track_records:
        upsert(
            str(record.get("employee_id", "")).strip(),
            str(record.get("employee_name", "")).strip(),
            str(record.get("primary_capability", "")).strip(),
            str(record.get("secondary_capability", "")).strip(),
            str(record.get("department", "")).strip(),
            str(record.get("grade", "")).strip(),
            str(record.get("location", "")).strip(),
            str(record.get("country", "")).strip(),
        )

    for record in famstack_records:
        employee_id = str(record.get("employee_id", "")).strip()
        upsert(
            employee_id,
            famstack_names.get(employee_id, ""),
            "",
            "",
            "",
            "",
            "",
            "",
        )

    return sorted(employees.values(), key=lambda item: item["employee_id"])
