"""Skills-based employee filtering.

Mirrors the Power BI skills handoff: EmployeeSkill is a bridge that only ever narrows which
employees are shown, exactly like DimEmployee -> EmployeeSkill there. Reads
dbo.vw_RV_EmployeeSkillsForDashboard (EmployeeCode, SkillName, CurrentSkillLevel only) into a
small cached snapshot, independent of the Project Track / HR availability engine in
engine.py and service.py.

A row with a NULL level (SelectionStatus = 'Pending' on the view) is kept and shown as
"Not documented", matching dbo.vwl_DimEmployeeSkill's
COALESCE(SkillLevel, 'Not documented'): it is not dropped.

Filtering is Match Any only, the same as the Power BI report: an employee is kept if they
have at least one skill row whose name is in the selected names (or all names, if none were
picked) AND whose level is in the selected levels (or all levels, if none were picked).
"Python" + "Advanced" selected together means Python at Advanced, because both conditions
apply to the same bridge row, not to the employee's skills independently.

Matching is done here, in Python, against normalized employee codes only. Skills rows are
never joined to allocation or capacity rows in SQL, and nothing here changes the
Planned / Remaining / Status values computed by engine.py: it only narrows which employees
views.py includes.
"""

from __future__ import annotations

import logging
import os
import threading
import time
from dataclasses import dataclass, field
from typing import Any

from app.rv.skills_sql import EMPLOYEE_SKILLS_VIEW

logger = logging.getLogger("resource_vision")
CACHE_SECONDS = int(os.environ.get("RV_SKILLS_CACHE_SECONDS", "300"))

NOT_DOCUMENTED = "Not documented"


def normalize_code(code: str | None) -> str:
    """Trimmed, upper-cased employee code. Skills rows (EmployeeCode on
    vw_RV_EmployeeSkillsForDashboard) are matched against snap.employees[*].code through
    this: never through a SQL-side join to the Project Track / HR facts."""
    return (code or "").strip().upper()


@dataclass(frozen=True)
class SkillRecord:
    name: str
    level: str  # NOT_DOCUMENTED when the source row's level is NULL


@dataclass
class SkillsSnapshot:
    by_code: dict[str, list[SkillRecord]] = field(default_factory=dict)
    names: list[str] = field(default_factory=list)
    levels: list[str] = field(default_factory=list)
    available: bool = False  # false when the skills view could not be read


def _rows_to_snapshot(rows: list[dict[str, Any]]) -> SkillsSnapshot:
    by_code: dict[str, list[SkillRecord]] = {}
    names: set[str] = set()
    levels: set[str] = set()
    for r in rows:
        name = r.get("skill_name")
        if not name:
            continue
        code = normalize_code(r.get("employee_code"))
        if not code:
            continue
        level = r.get("skill_level") or NOT_DOCUMENTED
        rec = SkillRecord(name=name, level=level)
        by_code.setdefault(code, []).append(rec)
        names.add(name)
        levels.add(level)
    return SkillsSnapshot(
        by_code=by_code,
        names=sorted(names, key=str.casefold),
        levels=sorted(levels, key=lambda v: (v == NOT_DOCUMENTED, v.casefold())),
        available=True,
    )


def _load() -> SkillsSnapshot:
    # Imported lazily: pyodbc (and a real DB connection) is only needed when a snapshot is
    # actually requested, not just because this module was imported (e.g. in unit tests, or
    # when RV_DATA_SOURCE=demo and pyodbc isn't installed at all).
    try:
        from app.database import DatabaseError, fetch_rows
    except ImportError:
        logger.info("pyodbc not installed; skills filtering will be unavailable")
        return SkillsSnapshot()

    try:
        rows = fetch_rows(EMPLOYEE_SKILLS_VIEW)
    except DatabaseError:
        logger.exception("vw_RV_EmployeeSkillsForDashboard could not be read; skills filtering will be unavailable")
        return SkillsSnapshot()
    return _rows_to_snapshot(rows)


_lock = threading.Lock()
_state: dict[str, Any] = {"snapshot": None, "checked": 0.0}


def get_skills_snapshot() -> SkillsSnapshot:
    """Cached for RV_SKILLS_CACHE_SECONDS so a filter change never re-queries the skills
    view; a monthly import (after dbo.rv_RefreshSkills runs) is picked up within that window
    without a restart."""
    now = time.monotonic()
    if _state["snapshot"] is not None and now - _state["checked"] < CACHE_SECONDS:
        return _state["snapshot"]
    if not _lock.acquire(blocking=_state["snapshot"] is None):
        return _state["snapshot"] or SkillsSnapshot()
    try:
        if _state["snapshot"] is None or now - _state["checked"] >= CACHE_SECONDS:
            _state["snapshot"] = _load()
            _state["checked"] = now
        return _state["snapshot"]
    finally:
        _lock.release()


def skill_options() -> dict[str, Any]:
    snap = get_skills_snapshot()
    return {"available": snap.available, "names": snap.names, "levels": snap.levels}


def matching_codes(skills: SkillsSnapshot, names: set[str], levels: set[str]) -> set[str] | None:
    """Normalized employee codes with at least one skill row matching both the selected
    names and the selected levels (Match Any; an empty set means that dimension isn't
    filtered). None when neither filter is set: the caller then skips filtering entirely."""
    if not names and not levels:
        return None
    return {
        code
        for code, records in skills.by_code.items()
        if any((not names or r.name in names) and (not levels or r.level in levels) for r in records)
    }


def employee_skills(skills: SkillsSnapshot, code: str) -> list[dict[str, Any]] | None:
    """Distinct, sorted skill rows for one employee (Employee 360), or None when the
    employee has no skills record at all ("Skills Not Available")."""
    records = skills.by_code.get(normalize_code(code))
    if not records:
        return None
    distinct = sorted({(r.name, r.level) for r in records}, key=lambda t: (t[0].casefold(), t[1] == NOT_DOCUMENTED, t[1]))
    return [{"name": name, "level": level} for name, level in distinct]
