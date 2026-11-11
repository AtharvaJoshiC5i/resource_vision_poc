"""Page-level read models built on a Snapshot (pure functions, unit tested)."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date
from typing import Any

from app.rv import engine as e

MONTH_ABBR = ("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec")
LETTER = {
    e.FULLY_AVAILABLE: "F",
    e.PARTIALLY_AVAILABLE: "P",
    e.FULLY_COMMITTED: "C",
    e.OVER_ALLOCATED: "O",
    e.UNVERIFIED: "U",
}
COVERAGE_MODES = ("All Projects", "With Allocations", "Without Allocations")


def month_label(key: int) -> str:
    return f"{MONTH_ABBR[key % 100 - 1]} {key // 100}"


def _iso(value: date | None) -> str | None:
    return value.isoformat() if value else None


@dataclass
class Filters:
    months: list[int] | None = None
    contract_categories: set[str] = field(default_factory=set)
    divisions: set[str] = field(default_factory=set)
    capabilities: set[str] = field(default_factory=set)
    grades: set[str] = field(default_factory=set)
    locations: set[str] = field(default_factory=set)
    search: str | None = None
    statuses: set[str] = field(default_factory=set)


NO_RECORD_FILTER = "No record"


def selected_months(snap: e.Snapshot, f: Filters) -> list[int]:
    if not f.months:
        return list(snap.window)
    wanted = set(f.months)
    return [m for m in snap.window if m in wanted]


def filters_without_months(f: Filters) -> Filters:
    """KPI strips use the full reporting window; month pickers scope charts and tables only."""
    return Filters(
        months=None,
        contract_categories=set(f.contract_categories),
        divisions=set(f.divisions),
        capabilities=set(f.capabilities),
        grades=set(f.grades),
        locations=set(f.locations),
        search=f.search,
        statuses=set(f.statuses),
    )


def _employee_ok(emp: e.Employee, f: Filters) -> bool:
    return (
        (not f.divisions or emp.division in f.divisions)
        and (not f.capabilities or emp.primary_capability in f.capabilities)
        and (not f.grades or emp.grade in f.grades)
        and (not f.locations or emp.location in f.locations)
    )


def filtered_employee_months(snap: e.Snapshot, f: Filters) -> list[e.EmployeeMonth]:
    months = set(selected_months(snap, f))
    result = []
    for em in snap.employee_months.values():
        if em.month not in months:
            continue
        if f.contract_categories and em.contract_category not in f.contract_categories:
            continue
        if not _employee_ok(snap.employees[em.key], f):
            continue
        result.append(em)
    return result


def _matches_search(emp: e.Employee, text: str | None) -> bool:
    if not text:
        return True
    needle = text.strip().casefold()
    return needle in emp.code.casefold() or needle in emp.name.casefold()


# --------------------------------------------------------------------------- availability
def availability_options(snap: e.Snapshot) -> dict[str, Any]:
    people = list(snap.employees.values())  # whole employee dimension, like Power BI slicers

    def values(attr: str) -> list[str]:
        return sorted({getattr(p, attr) for p in people if getattr(p, attr)})

    return {
        "months": [
            {"key": m, "label": month_label(m), "has_data": m in snap.months_with_data}
            for m in snap.window
        ],
        "contract_categories": list(e.CONTRACT_CATEGORIES),
        "divisions": values("division"),
        "capabilities": values("primary_capability"),
        "grades": values("grade"),
        "locations": values("location"),
    }


def availability_overview(snap: e.Snapshot, f: Filters) -> dict[str, Any]:
    ems_kpi = filtered_employee_months(snap, filters_without_months(f))
    status_sets: dict[str, set[str]] = {s: set() for s in e.STATUSES}
    for em in ems_kpi:
        status_sets[em.status].add(em.key)

    kpis = {
        "employees_with_records": len({em.key for em in ems_kpi}),
        "fully_available": len(status_sets[e.FULLY_AVAILABLE]),
        "partially_available": len(status_sets[e.PARTIALLY_AVAILABLE]),
        "fully_committed": len(status_sets[e.FULLY_COMMITTED]),
        "over_allocated": len(status_sets[e.OVER_ALLOCATED]),
        "unverified": len(status_sets[e.UNVERIFIED]),
    }

    ems = filtered_employee_months(snap, f)
    by_month_status: dict[int, dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
    by_month_contract: dict[int, dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
    by_month_all: dict[int, set[str]] = defaultdict(set)
    for em in ems:
        by_month_status[em.month][em.status].add(em.key)
        by_month_contract[em.month][em.contract_category].add(em.key)
        by_month_all[em.month].add(em.key)

    months = []
    for m in selected_months(snap, f):
        has_data = m in snap.months_with_data
        months.append(
            {
                "month": m,
                "label": month_label(m),
                "has_data": has_data,
                "total": len(by_month_all[m]) if has_data else None,
                "statuses": {s: (len(by_month_status[m][s]) if has_data else None) for s in e.STATUSES},
                "contracts": {
                    c: (len(by_month_contract[m][c]) if has_data else None) for c in e.CONTRACT_CATEGORIES
                },
            }
        )
    return {"kpis": kpis, "months": months}


def availability_matrix(
    snap: e.Snapshot, f: Filters, page: int = 1, page_size: int = 50
) -> dict[str, Any]:
    ems = filtered_employee_months(snap, f)
    cell_lookup = {(em.key, em.month): em for em in ems}
    # Like Power BI: the matrix lists the whole employee dimension (employees without a record in a
    # month show "no record"). A contract-category filter is a fact-side filter, so it narrows to
    # employees that have matching employee-month records.
    if f.contract_categories:
        candidates = {em.key for em in ems}
    else:
        candidates = {k for k, emp in snap.employees.items() if _employee_ok(emp, f)}
    keys = {k for k in candidates if _matches_search(snap.employees[k], f.search)}
    if f.statuses:
        # Keep employees who have any wanted status (or, for "No record", a missing row in a month that
        # has Project Track data) in at least one selected month.
        data_months = [m for m in selected_months(snap, f) if m in snap.months_with_data]
        want_none = NO_RECORD_FILTER in f.statuses

        def _hit(key: str) -> bool:
            for m in data_months:
                em = cell_lookup.get((key, m))
                if em is None:
                    if want_none:
                        return True
                elif em.status in f.statuses:
                    return True
            return False

        keys = {k for k in keys if _hit(k)}
    people = sorted((snap.employees[k] for k in keys), key=lambda p: (p.code.casefold(), p.key))

    total = len(people)
    page_size = max(1, min(page_size, 200))
    pages = max(1, -(-total // page_size))
    page = max(1, min(page, pages))
    chunk = people[(page - 1) * page_size : page * page_size]

    months = selected_months(snap, f)
    rows = []
    for person in chunk:
        cells = []
        for m in months:
            if m not in snap.months_with_data:
                cells.append({"month": m, "state": "blank"})
                continue
            em = cell_lookup.get((person.key, m))
            if em is None:
                cells.append({"month": m, "state": "none"})
            else:
                cells.append(
                    {
                        "month": m,
                        "state": "status",
                        "status": em.status,
                        "letter": LETTER[em.status],
                        "remaining_hours": em.remaining,
                        "planned_hours": em.planned,
                        "reason": em.status_reason,
                        "contract_category": em.contract_category,
                    }
                )
        rows.append(
            {
                "key": person.key,
                "code": person.code,
                "name": person.name,
                "hr_match": person.hr_matched,
                "cells": cells,
            }
        )
    return {
        "months": [{"key": m, "label": month_label(m)} for m in months],
        "rows": rows,
        "page": page,
        "pages": pages,
        "page_size": page_size,
        "total": total,
    }


# --------------------------------------------------------------------------- employee 360
def employee_search(snap: e.Snapshot, query: str | None, limit: int = 5000) -> list[dict[str, str]]:
    people = sorted(
        (emp for emp in snap.employees.values() if _matches_search(emp, query)),
        key=lambda p: (p.name.casefold(), p.code),
    )
    return [
        {"key": p.key, "code": p.code, "name": p.name, "label": f"{p.name} ({p.code})"}
        for p in people[:limit]
    ]


DIRECTORY_LIST_SIZE = 6  # rows shown in each short list on the Employee 360 landing page
DIRECTORY_FREEING_MONTHS = 3  # how far ahead "freeing up soon" looks


def employee_directory(snap: e.Snapshot, month: int | None = None) -> dict[str, Any]:
    """Landing-page read model for Employee 360: one row per employee in the dimension, judged on the
    selected month, plus two short lists (needs attention, freeing up soon)."""
    current = month if month is not None and month in snap.window else snap.window[0]
    start = snap.window.index(current)
    horizon = snap.window[start + 1 : start + 1 + DIRECTORY_FREEING_MONTHS]
    people = sorted(snap.employees.values(), key=lambda p: (p.name.casefold(), p.code))

    rows: list[dict[str, Any]] = []
    counts = {status: 0 for status in e.STATUSES}
    no_record = 0
    over: list[tuple[float, dict[str, Any]]] = []
    unverified: list[dict[str, Any]] = []
    freeing: list[tuple[float, int, dict[str, Any]]] = []

    for emp in people:
        em = snap.employee_months.get((emp.key, current))
        if em is None:
            no_record += 1
        else:
            counts[em.status] += 1

        available_from = None
        for m in snap.window:
            later = snap.employee_months.get((emp.key, m))
            if later is not None and later.remaining is not None and later.remaining > 0:
                available_from = {"month": m, "label": month_label(m), "remaining_hours": later.remaining}
                break

        utilisation = None
        if em is not None and em.planned is not None and em.capacity:
            utilisation = em.planned / em.capacity

        rows.append(
            {
                "key": emp.key,
                "code": emp.code,
                "name": emp.name,
                "grade": emp.grade,
                "capability": emp.primary_capability,
                "location": emp.location,
                "hr_match": emp.hr_matched,
                "status": em.status if em else None,
                "projects": em.project_count if em else None,
                "planned_hours": em.planned if em else None,
                "capacity_hours": em.capacity if em else None,
                "remaining_hours": em.remaining if em else None,
                "utilisation": utilisation,
                "available_from": available_from,
            }
        )

        if em is None:
            continue
        who = {"key": emp.key, "code": emp.code, "name": emp.name}
        if em.status == e.OVER_ALLOCATED and em.remaining is not None:
            over.append((em.remaining, {**who, "status": em.status, "reason": f"{-em.remaining:,.0f} h over capacity"}))
        elif em.status == e.UNVERIFIED:
            reason = "No HR match" if not emp.hr_matched else (em.status_reason or "Hours need review")
            unverified.append({**who, "status": em.status, "reason": reason})

        if em.remaining is not None:
            for m in horizon:
                later = snap.employee_months.get((emp.key, m))
                if later is not None and later.remaining is not None and later.remaining > 0 and later.remaining > em.remaining:
                    gain = later.remaining - em.remaining
                    freeing.append((gain, m, {**who, "month": m, "label": month_label(m), "hours_freed": gain}))
                    break

    over.sort(key=lambda pair: pair[0])  # most over capacity first
    attention = [item for _, item in over] + unverified
    freeing.sort(key=lambda t: (-t[0], t[1]))

    return {
        "month": current,
        "month_label": month_label(current),
        "kpis": {
            "total": len(people),
            "over_allocated": counts[e.OVER_ALLOCATED],
            "unverified": counts[e.UNVERIFIED],
            "fully_committed": counts[e.FULLY_COMMITTED],
            "partially_available": counts[e.PARTIALLY_AVAILABLE],
            "fully_available": counts[e.FULLY_AVAILABLE],
            "no_record": no_record,
        },
        "rows": rows,
        "attention": {"total": len(attention), "items": attention[:DIRECTORY_LIST_SIZE]},
        "freeing": {
            "months": len(horizon),
            "total": len(freeing),
            "items": [item for _, _, item in freeing[:DIRECTORY_LIST_SIZE]],
        },
    }


def _combine_categories(categories: list[str]) -> str:
    if e.FTE_BASED in categories:
        return e.FTE_BASED
    if e.PROGRAM_BASED in categories:
        return e.PROGRAM_BASED
    return e.NOT_SPECIFIED if categories else "-"


def employee_detail(snap: e.Snapshot, key: str) -> dict[str, Any] | None:
    emp = snap.employees.get(key.upper())
    if emp is None:
        return None
    key = emp.key

    months = []
    for m in snap.window:
        em = snap.employee_months.get((key, m))
        months.append(
            {
                "month": m,
                "label": month_label(m),
                "has_data": m in snap.months_with_data,
                "present": em is not None,
                "project_count": em.project_count if em else None,
                "contract_category": em.contract_category if em else None,
                "planned_hours": em.verified_hours if em else None,
                "unresolved_hours": em.unresolved_hours if em else None,
                "remaining_hours": em.remaining if em else None,
                "status": em.status if em else None,
                "status_reason": em.status_reason if em else None,
            }
        )

    present = [row for row in months if row["present"]]
    statuses = [row["status"] for row in present]
    if not statuses:
        total_status = None
    elif e.PARTIALLY_AVAILABLE in statuses:
        total_status = e.PARTIALLY_AVAILABLE
    elif len(set(statuses)) == 1:
        total_status = statuses[0]
    else:
        total_status = "Multiple values"
    verified_values = [r["planned_hours"] for r in present if r["planned_hours"] is not None]
    unresolved_values = [r["unresolved_hours"] for r in present if r["unresolved_hours"] is not None]
    totals = {
        "project_count": sum(r["project_count"] for r in present),
        "contract_category": _combine_categories([r["contract_category"] for r in present]),
        "planned_hours": sum(verified_values) if verified_values else None,
        "unresolved_hours": sum(unresolved_values) if unresolved_values else None,
        "status": total_status,
    }

    allocations = _employee_allocations(snap, key)
    return {
        "profile": {
            "key": emp.key,
            "code": emp.code,
            "name": emp.name,
            "initials": emp.initials,
            "status": emp.employee_status,
            "hr_match_status": emp.hr_match_status,
            "primary_capability": emp.primary_capability,
            "secondary_capability": emp.secondary_capability,
            "grade": emp.grade,
            "division": emp.division,
            "department": emp.department,
            "location": emp.location,
            "country": emp.country,
            "manager": emp.manager_name,
            "employment_type": emp.employment_type,
            "joining_date": _iso(emp.joining),
            "email": emp.email,
        },
        "months": months,
        "totals": totals,
        "allocations": allocations,
    }


def _employee_allocations(snap: e.Snapshot, key: str) -> dict[str, Any]:
    rows = [
        r for r in snap.rows_by_employee().get(key, [])
        if (key, r.month) in snap.employee_months
    ]
    grouped: dict[tuple[int, str], list[e.PtRow]] = defaultdict(list)
    for r in rows:
        grouped[(r.month, r.project_id or "")].append(r)

    def summarise(items: list[e.PtRow]) -> dict[str, Any]:
        valid = [r.effort for r in items if r.status == e.VALID]
        unresolved = [r.effort for r in items if r.status == e.UNRESOLVED and r.effort is not None]
        return {
            "planned_hours": sum(valid) if valid else None,
            "unresolved_hours": sum(unresolved) if unresolved else None,
        }

    out = []
    for (month, project_id), items in sorted(grouped.items()):
        project = snap.projects.get(project_id)
        types = sorted({t for t in (r.contract_type for r in items) if t})
        starts = [r.start_date for r in items if r.start_date]
        ends = [r.end_date for r in items if r.end_date]
        subs: dict[str, list[e.PtRow]] = defaultdict(list)
        for r in items:
            subs[e.sub_project_label(r.sub_project_name)].append(r)
        name = project.name if project else e.NOT_AVAILABLE
        out.append(
            {
                "month": month,
                "label": f"{month_label(month)} | {project_id} - {name}",
                "project_id": project_id,
                "client_bu": project.client_bu if project else e.NOT_AVAILABLE,
                "status": project.status if project else e.NOT_AVAILABLE,
                "contract": (types[0] if len(types) == 1 else "Multiple" if types else "Not specified"),
                "start": _iso(min(starts)) if starts else None,
                "end": _iso(max(ends)) if ends else None,
                **summarise(items),
                "children": [
                    {"sub_project": label, **summarise(sub_items)}
                    for label, sub_items in sorted(subs.items())
                ],
            }
        )
    planned = [r["planned_hours"] for r in out if r["planned_hours"] is not None]
    unresolved = [r["unresolved_hours"] for r in out if r["unresolved_hours"] is not None]
    return {
        "rows": out,
        "totals": {
            "planned_hours": sum(planned) if planned else None,
            "unresolved_hours": sum(unresolved) if unresolved else None,
        },
    }


# --------------------------------------------------------------------------- projects
def _project_stats(snap: e.Snapshot, months: list[int]) -> dict[str, dict[str, Any]]:
    in_months = set(months)
    stats: dict[str, dict[str, Any]] = {}
    for r in snap.rows:
        if not r.named or r.month not in in_months or not r.project_id:
            continue
        s = stats.setdefault(r.project_id, {"employees": set(), "planned": None})
        s["employees"].add(r.employee_key)
        if r.status == e.VALID:
            s["planned"] = (s["planned"] or 0.0) + r.effort
    return stats


def _project_visible(project: e.Project, stats: dict[str, Any] | None, months: list[int]) -> bool:
    n = len(stats["employees"]) if stats else 0
    if not months:
        return False
    period_start, period_end = e.month_start(months[0]), e.month_end(months[-1])
    if project.start is None and project.end is None:
        return n > 0
    return (project.start is None or project.start <= period_end) and (
        project.end is None or project.end >= period_start
    )


def project_options(snap: e.Snapshot) -> dict[str, Any]:
    return {
        "months": availability_options(snap)["months"],
        "contract_categories": list(e.CONTRACT_CATEGORIES),
        "coverage": list(COVERAGE_MODES),
        "projects": [
            {"id": p.id, "label": p.search_label}
            for p in sorted(snap.projects.values(), key=lambda p: (p.name.casefold(), p.id))
        ],
    }


def _projects_overview_rows(
    snap: e.Snapshot,
    f: Filters,
    months: list[int],
    stats: dict[str, dict[str, Any]],
    coverage: str,
) -> list[dict[str, Any]]:
    needle = (f.search or "").strip().casefold()
    rows = []
    for p in snap.projects.values():
        s = stats.get(p.id)
        if not _project_visible(p, s, months):
            continue
        n = len(s["employees"]) if s else 0
        if coverage == "With Allocations" and n == 0:
            continue
        if coverage == "Without Allocations" and n > 0:
            continue
        if f.contract_categories and p.contract_category not in f.contract_categories:
            continue
        if needle and needle not in f"{p.name} {p.id} {p.client_bu}".casefold():
            continue
        rows.append(
            {
                "id": p.id,
                "name": p.name,
                "client_bu": p.client_bu,
                "contract_category": p.contract_category,
                "status": p.status,
                "start": _iso(p.start),
                "end": _iso(p.end),
                "employees": n,
                "planned_hours": s["planned"] if s else None,
            }
        )
    rows.sort(key=lambda r: (r["name"].casefold(), r["id"]))
    return rows


def projects_overview(snap: e.Snapshot, f: Filters, coverage: str = "All Projects") -> dict[str, Any]:
    months = selected_months(snap, f)
    stats = _project_stats(snap, months)
    rows = _projects_overview_rows(snap, f, months, stats, coverage)

    kpi_months = list(snap.window)
    kpi_stats = _project_stats(snap, kpi_months)
    kpi_rows = _projects_overview_rows(snap, f, kpi_months, kpi_stats, coverage)

    assigned: set[str] = set()
    for r in kpi_rows:
        assigned |= kpi_stats[r["id"]]["employees"] if r["id"] in kpi_stats else set()
    active = sum(
        1 for r in kpi_rows
        if (snap.projects[r["id"]].start is not None and snap.projects[r["id"]].end is not None
            and snap.projects[r["id"]].start <= snap.today <= snap.projects[r["id"]].end)
    )
    return {
        "kpis": {
            "total_projects": len(kpi_rows),
            "active_projects": active,
            "projects_with_employees": sum(1 for r in kpi_rows if r["employees"] > 0),
            "employees_assigned": 0 if coverage == "Without Allocations" else len(assigned),
        },
        "rows": rows,
    }


def _project_detail_summary(
    snap: e.Snapshot, project_id: str, months: list[int], project: e.Project
) -> dict[str, Any]:
    in_months = set(months)
    rows = [r for r in snap.rows if r.named and r.project_id == project_id and r.month in in_months]
    by_employee: dict[str, list[e.PtRow]] = defaultdict(list)
    for r in rows:
        by_employee[r.employee_key].append(r)
    trend = []
    for m in months:
        valid = [r.effort for r in rows if r.month == m and r.status == e.VALID]
        trend.append(
            {
                "month": m,
                "label": month_label(m),
                "has_data": m in snap.months_with_data,
                "planned_hours": sum(valid) if valid else None,
            }
        )
    planned_values = [t["planned_hours"] for t in trend if t["planned_hours"] is not None]
    return {
        "employees": len(by_employee),
        "planned_hours": sum(planned_values) if planned_values else None,
        "start": _iso(project.start),
        "end": _iso(project.end),
        "months_with_planned_hours": len(planned_values),
    }


def project_detail(snap: e.Snapshot, project_id: str, f: Filters) -> dict[str, Any] | None:
    project = snap.projects.get(project_id)
    if project is None:
        return None
    months = selected_months(snap, f)
    in_months = set(months)
    rows = [r for r in snap.rows if r.named and r.project_id == project_id and r.month in in_months]

    by_employee: dict[str, dict[int, list[e.PtRow]]] = defaultdict(lambda: defaultdict(list))
    for r in rows:
        by_employee[r.employee_key][r.month].append(r)

    trend = []
    for m in months:
        valid = [r.effort for r in rows if r.month == m and r.status == e.VALID]
        trend.append(
            {
                "month": m,
                "label": month_label(m),
                "has_data": m in snap.months_with_data,
                "planned_hours": sum(valid) if valid else None,
            }
        )

    employees = []
    for key, per_month in by_employee.items():
        emp = snap.employees[key]
        cells = []
        total = None
        for m in months:
            items = per_month.get(m)
            if not items:
                cells.append({"month": m, "state": "blank", "hours": None})
                continue
            valid = [r.effort for r in items if r.status == e.VALID]
            if valid:
                hours = sum(valid)
                total = (total or 0.0) + hours
                cells.append({"month": m, "state": "hours", "hours": hours})
            else:
                cells.append({"month": m, "state": "dash", "hours": None})
        parts = [emp.grade, emp.primary_capability, emp.location, emp.employment_type]
        label = f"{emp.code} – {emp.name}" + "".join(f" | {p}" for p in parts if p)
        employees.append(
            {
                "key": key,
                "code": emp.code,
                "label": label,
                "name": emp.name,
                "grade": emp.grade,
                "capability": emp.primary_capability,
                "location": emp.location,
                "employment_type": emp.employment_type,
                "cells": cells,
                "total": total,
            }
        )
    employees.sort(key=lambda r: r["code"].casefold())

    summary = _project_detail_summary(snap, project_id, list(snap.window), project)
    return {
        "project": {
            "id": project.id,
            "name": project.name,
            "status": project.status,
            "client_bu": project.client_bu,
            "contract_category": project.contract_category,
            "contract_type": project.contract_type,
            "lead": project.lead,
            "description": project.description,
            "start": _iso(project.start),
            "end": _iso(project.end),
        },
        "summary": summary,
        "trend": trend,
        "months": [{"key": m, "label": month_label(m)} for m in months],
        "employees": employees,
    }
