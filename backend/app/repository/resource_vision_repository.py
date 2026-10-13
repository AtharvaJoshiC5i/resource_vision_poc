from __future__ import annotations

from typing import Any

from app.database import DatabaseError, fetch_all
from app.mappers.employees import derive_zinghr_employees
from app.mappers.famstack import map_sql_billable_rows, map_sql_non_billable_rows, merge_famstack
from app.mappers.planning import build_planning_horizon
from app.mappers.project_track import map_sql_project_track_rows
from app.queries.resource_vision_sql import (
    EMPLOYEE_MASTER_FROM_SOURCES,
    FAMSTACK_BILLABLE_AGGREGATED,
    FAMSTACK_NON_BILLABLE_AGGREGATED,
    PROJECT_TRACK_RESOURCE_VISION,
)


def _fetch_step(step_name: str, query: str) -> list[dict[str, Any]]:
    try:
        return fetch_all(query)
    except DatabaseError as error:
        raise DatabaseError(f"{step_name} failed: {error}") from error


def load_resource_vision_bundle() -> dict[str, Any]:
    try:
        billable_raw = _fetch_step(
            "Famstack billable query",
            FAMSTACK_BILLABLE_AGGREGATED,
        )
        non_billable_raw = _fetch_step(
            "Famstack non-billable query",
            FAMSTACK_NON_BILLABLE_AGGREGATED,
        )
        project_track_raw = _fetch_step(
            "Project Track query",
            PROJECT_TRACK_RESOURCE_VISION,
        )
        employee_master_raw = _fetch_step(
            "Employee master query",
            EMPLOYEE_MASTER_FROM_SOURCES,
        )
    except DatabaseError:
        raise
    except Exception as error:  # noqa: BLE001
        raise DatabaseError(f"Resource Vision query failed: {error}") from error

    famstack = merge_famstack(
        map_sql_billable_rows(billable_raw),
        map_sql_non_billable_rows(non_billable_raw),
    )
    project_track = map_sql_project_track_rows(project_track_raw)

    zinghr = derive_zinghr_employees(
        famstack,
        project_track,
        employee_master_rows=employee_master_raw,
    )

    planning = build_planning_horizon(famstack, project_track)

    return {
        "source": "azure_sql",
        "planning": planning,
        "counts": {
            "famstack_billable_sql_rows": len(billable_raw),
            "famstack_non_billable_sql_rows": len(non_billable_raw),
            "project_track_sql_rows": len(project_track_raw),
            "employee_master_sql_rows": len(employee_master_raw),
            "famstack": len(famstack),
            "project_track": len(project_track),
            "zinghr": len(zinghr),
        },
        "famstack": famstack,
        "projectTrack": project_track,
        "zinghr": zinghr,
    }
