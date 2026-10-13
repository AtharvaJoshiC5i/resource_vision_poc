from __future__ import annotations

from typing import Any

from app.mappers.utils import parse_month_key


def _month_sort_key(month_key: str) -> tuple[int, int]:
    parts = month_key.split("-", maxsplit=1)

    if len(parts) != 2:
        return (0, 0)

    try:
        return (int(parts[0]), int(parts[1]))
    except ValueError:
        return (0, 0)


def _canonical_month_key(record: dict[str, Any]) -> str:
    return parse_month_key(record.get("month_key")) or ""


def _unique_sorted_months(records: list[dict[str, Any]]) -> list[str]:
    months = {
        month_key
        for record in records
        for month_key in [_canonical_month_key(record)]
        if month_key != ""
    }

    return sorted(months, key=_month_sort_key)


def build_planning_horizon(
    famstack: list[dict[str, Any]],
    project_track: list[dict[str, Any]],
) -> dict[str, Any]:
    famstack_months = _unique_sorted_months(famstack)
    project_track_months = _unique_sorted_months(project_track)

    all_months = sorted(
        set(famstack_months) | set(project_track_months),
        key=_month_sort_key,
    )

    if famstack_months and project_track_months:
        last_historical = famstack_months[-1]
        planning_starts = [
            month for month in project_track_months if month > last_historical
        ]
        current_month = (
            planning_starts[0] if planning_starts else project_track_months[0]
        )
    elif project_track_months:
        current_month = project_track_months[0]
    elif famstack_months:
        current_month = famstack_months[-1]
    else:
        current_month = "2026-09"

    return {
        "currentMonth": current_month,
        "monthKeys": all_months,
        "famstackMonths": famstack_months,
        "projectTrackMonths": project_track_months,
    }
