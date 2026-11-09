"""Resource Vision calculation engine (pure functions, no I/O).

Implements docs/CALCULATION_SPEC.md. Input is plain dict rows produced by the
queries in ``sql.py`` (or by ``demo_data.py``), so everything here is unit tested
without a database.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any

CAPACITY_HOURS = 176.0
WINDOW_MONTHS = 19
EPS = 1e-6

# Availability statuses
FULLY_AVAILABLE = "Fully Available"
PARTIALLY_AVAILABLE = "Partially Available"
FULLY_COMMITTED = "Fully Committed"
OVER_ALLOCATED = "Over-allocated"
UNVERIFIED = "Unverified"
STATUSES = (FULLY_AVAILABLE, PARTIALLY_AVAILABLE, FULLY_COMMITTED, OVER_ALLOCATED, UNVERIFIED)

# Contract categories
FTE_BASED = "FTE-Based"
PROGRAM_BASED = "Program-Based"
NOT_SPECIFIED = "Contract Not Specified"
CONTRACT_CATEGORIES = (FTE_BASED, PROGRAM_BASED, NOT_SPECIFIED)

NOT_AVAILABLE = "Not available"
NO_SUB_PROJECT = "(No sub-project)"

# Row statuses
VALID = "valid"
PLACEHOLDER = "placeholder"
UNRESOLVED = "unresolved"
UNTAGGED = "untagged"


# --------------------------------------------------------------------------- months
def month_int(value: date) -> int:
    return value.year * 100 + value.month


def month_start(key: int) -> date:
    return date(key // 100, key % 100, 1)


def month_end(key: int) -> date:
    nxt = add_months(key, 1)
    return month_start(nxt) - timedelta(days=1)


def add_months(key: int, count: int) -> int:
    index = (key // 100) * 12 + (key % 100 - 1) + count
    return (index // 12) * 100 + index % 12 + 1


def build_window(today: date, months: int = WINDOW_MONTHS) -> list[int]:
    first = month_int(today)
    return [add_months(first, i) for i in range(months)]


# --------------------------------------------------------------------------- text helpers
def _blank_null(value: Any) -> str | None:
    """Catalog rule: the literal text 'null' counts as blank."""
    if value is None:
        return None
    text = str(value).strip()
    if text == "" or text.lower() == "null":
        return None
    return text


def contract_class(contract_type: str | None) -> str:
    text = (contract_type or "").lower()
    for dash in ("–", "—"):
        text = text.replace(dash, "-")
    text = text.replace(" ", "").replace(" ", "")
    if text == "t&m-fte":
        return "FTE"
    if text in ("t&m-hrs", "output-effortbased", "output-fixedspread"):
        return "Program"
    return "Unclassified"


def contract_category_of(classes: set[str]) -> str:
    if "FTE" in classes:
        return FTE_BASED
    if "Program" in classes:
        return PROGRAM_BASED
    return NOT_SPECIFIED


def sub_project_label(value: Any) -> str:
    text = _blank_null(value)
    return text if text is not None else NO_SUB_PROJECT


def display_status(raw: str | None) -> str:
    """'in_approval' -> 'In Approval'."""
    text = _blank_null(raw)
    if text is None:
        return NOT_AVAILABLE
    return " ".join(part.capitalize() for part in text.replace("_", " ").split())


# --------------------------------------------------------------------------- Project Track rows
@dataclass
class PtRow:
    row_id: str | None
    project_id: str | None
    proposal_number: int | None
    sub_project_name: str | None
    employee_key: str | None
    employee_code: str | None
    month: int | None
    month_valid: bool
    effort: float | None
    is_override: bool | None
    contract_type: str | None
    start_date: date | None
    end_date: date | None
    status: str = UNTAGGED
    reason: str | None = None
    raw: dict[str, Any] = field(default_factory=dict, repr=False)

    @property
    def named(self) -> bool:
        return self.employee_key is not None


def classify_rows(pt_rows: list[dict[str, Any]]) -> list[PtRow]:
    """Row preparation (spec section 1). ``included_default`` is never used."""
    rows: list[PtRow] = []
    for raw in pt_rows:
        month_value = raw.get("month_key")
        month = month_int(month_value) if month_value is not None else None
        effort = raw.get("effort")
        rows.append(
            PtRow(
                row_id=raw.get("row_id"),
                project_id=raw.get("project_id"),
                proposal_number=raw.get("proposal_number"),
                sub_project_name=raw.get("sub_project_name"),
                employee_key=raw.get("employee_key"),
                employee_code=raw.get("employee_code"),
                month=month,
                month_valid=month_value is not None and month_value.day == 1,
                effort=float(effort) if effort is not None else None,
                is_override=raw.get("is_override"),
                contract_type=raw.get("contract_type"),
                start_date=raw.get("start_date"),
                end_date=raw.get("end_date"),
                raw=raw,
            )
        )

    positives: dict[tuple, int] = defaultdict(int)
    for row in rows:
        if row.named and row.effort is not None and row.effort > 0:
            positives[_group_key(row)] += 1

    for row in rows:
        if not row.named:
            row.status = UNTAGGED
            continue
        if row.month is None:
            row.status, row.reason = UNRESOLVED, "month_key missing"
        elif not row.month_valid:
            row.status, row.reason = UNRESOLVED, "month_key is not the first day of a month"
        elif row.effort is None:
            row.status, row.reason = UNRESOLVED, "effort missing"
        elif row.effort < 0:
            row.status, row.reason = UNRESOLVED, "negative effort"
        elif row.is_override is None or row.is_override:
            row.status, row.reason = UNRESOLVED, "override flag missing or manual override"
        elif positives.get(_group_key(row), 0) >= 2:
            row.status, row.reason = UNRESOLVED, "duplicate records with conflicting hours"
        elif row.effort == 0:
            row.status = PLACEHOLDER
        else:
            row.status = VALID
    return rows


def _group_key(row: PtRow) -> tuple:
    return (row.employee_key, row.month, row.project_id, row.proposal_number, row.sub_project_name)


# --------------------------------------------------------------------------- employees
@dataclass
class Employee:
    key: str
    code: str
    name: str
    name_source: str
    hr_matched: bool
    dates_valid: bool
    joining: date | None
    exit: date | None
    employee_status: str | None
    primary_capability: str | None
    secondary_capability: str | None
    grade: str | None
    country: str | None
    location: str | None
    division: str | None
    department: str | None
    email: str | None
    manager_name: str | None
    manager_code: str | None
    employment_type: str | None

    @property
    def hr_match_status(self) -> str:
        return "Matched to ZingHR" if self.hr_matched else "Missing HR match - Project Track only"

    @property
    def initials(self) -> str:
        parts = self.name.replace("(", "").replace(")", "").split()
        if not parts:
            return ""
        return (parts[0][0] + (parts[-1][0] if len(parts) > 1 else "")).upper()


def effective_exit(hr: dict[str, Any]) -> date | None:
    """ExitDate, else DateOfLeaving, else resignation date for FnF statuses."""
    if hr.get("exit_date"):
        return hr["exit_date"]
    if hr.get("leaving_date"):
        return hr["leaving_date"]
    status = (hr.get("employee_status") or "").upper()
    if status.startswith("FNF") and hr.get("resignation_date"):
        return hr["resignation_date"]
    return None


def build_employees(hr_rows: list[dict[str, Any]], rows: list[PtRow]) -> dict[str, Employee]:
    key_counts: dict[str, int] = defaultdict(int)
    for hr in hr_rows:
        if hr.get("employee_key"):
            key_counts[hr["employee_key"]] += 1
    valid_hr = {
        hr["employee_key"]: hr
        for hr in hr_rows
        if hr.get("employee_key") and key_counts[hr["employee_key"]] == 1
    }

    named_rows: dict[str, list[PtRow]] = defaultdict(list)
    for row in rows:
        if row.named:
            named_rows[row.employee_key].append(row)

    keys = set(valid_hr) | set(named_rows)
    employees: dict[str, Employee] = {}
    for key in keys:
        hr = valid_hr.get(key)
        lookup = _lookup(key, named_rows.get(key, []))
        code = (hr or {}).get("employee_code") or _first_code(named_rows.get(key, [])) or key

        joining = hr.get("joining_date") if hr else None
        exit_date = effective_exit(hr) if hr else None
        dates_valid = bool(hr) and joining is not None and (exit_date is None or exit_date >= joining)

        def pick(pt_name: str | None, hr_name: str | None) -> str | None:
            return lookup.get(pt_name) if pt_name and lookup.get(pt_name) else (hr or {}).get(hr_name)

        name = lookup.get("employee_name") or (hr or {}).get("employee_name")
        if name:
            name_source = "Project Track" if lookup.get("employee_name") else "ZingHR"
        else:
            name = "(Missing HR match)" if not hr else "-"
            name_source = "Unavailable"

        employees[key] = Employee(
            key=key,
            code=code,
            name=name,
            name_source=name_source,
            hr_matched=hr is not None,
            dates_valid=dates_valid,
            joining=joining,
            exit=exit_date,
            employee_status=(hr or {}).get("employee_status"),
            primary_capability=pick("primary_capability", "primary_capability"),
            secondary_capability=pick("secondary_capability", "secondary_capability"),
            grade=pick("grade", "grade"),
            country=pick("country", "country"),
            location=pick("location", "location"),
            division=(hr or {}).get("division"),
            department=pick("department", "department"),
            email=(hr or {}).get("email"),
            manager_name=(hr or {}).get("manager_name"),
            manager_code=(hr or {}).get("manager_code"),
            employment_type=(hr or {}).get("employment_type"),
        )
    return employees


def _first_code(rows: list[PtRow]) -> str | None:
    for row in sorted(rows, key=lambda r: (r.row_id is None, r.row_id or "")):
        if row.employee_code:
            return row.employee_code
    return None


def _lookup(key: str, rows: list[PtRow]) -> dict[str, str | None]:
    """Latest-month Project Track row with a real name wins per attribute (catalog EmployeeLookup)."""
    real = [
        r for r in rows
        if r.raw.get("employee_name") and r.raw["employee_name"].upper() != key
    ]
    real.sort(key=lambda r: (r.month is None, -(r.month or 0), r.row_id is None, r.row_id or ""))
    result: dict[str, str | None] = {}
    for attr in (
        "employee_name", "primary_capability", "secondary_capability",
        "department", "grade", "location", "country",
    ):
        result[attr] = next((r.raw[attr] for r in real if r.raw.get(attr)), None)
    return result


# --------------------------------------------------------------------------- employee-month fact
@dataclass
class EmployeeMonth:
    key: str
    month: int
    capacity: float | None
    named_rows: int
    valid_rows: int
    placeholder_rows: int
    unresolved_rows: int
    project_count: int
    raw_hours: float
    verified_hours: float | None
    unresolved_hours: float | None
    planned: float | None
    remaining: float | None
    status: str
    status_reason: str
    contract_category: str


def _employed(emp: Employee, month: int) -> bool:
    if emp.joining is None:
        return False
    if emp.joining > month_end(month):
        return False
    return emp.exit is None or emp.exit >= month_start(month)


def build_employee_months(
    rows: list[PtRow],
    employees: dict[str, Employee],
    window: list[int],
    capacity_hours: float = CAPACITY_HOURS,
) -> dict[tuple[str, int], EmployeeMonth]:
    in_window = set(window)
    groups: dict[tuple[str, int], list[PtRow]] = defaultdict(list)
    for row in rows:
        if row.named and row.month in in_window:
            groups[(row.employee_key, row.month)].append(row)

    result: dict[tuple[str, int], EmployeeMonth] = {}
    for (key, month), group in groups.items():
        emp = employees[key]
        if emp.hr_matched and emp.dates_valid and not _employed(emp, month):
            continue  # not employed this month: out of scope

        valid = [r for r in group if r.status == VALID]
        placeholders = [r for r in group if r.status == PLACEHOLDER]
        unresolved = [r for r in group if r.status == UNRESOLVED]

        capacity = capacity_hours if emp.hr_matched and emp.dates_valid else None
        verified = sum(r.effort for r in valid) if valid else None
        unresolved_vals = [r.effort for r in unresolved if r.effort is not None]
        unresolved_hours = sum(unresolved_vals) if unresolved_vals else None
        raw_hours = sum(r.effort for r in group if r.effort is not None)

        planned = verified if (not unresolved and valid and emp.hr_matched) else None
        remaining = capacity - planned if capacity is not None and planned is not None else None

        if capacity is None or planned is None:
            status = UNVERIFIED
            if not emp.hr_matched:
                reason = "Missing HR match: capacity not established"
            elif capacity is None:
                reason = "Employment dates invalid: capacity not established"
            elif unresolved:
                reason = f"{len(unresolved)} record(s) need review"
            else:
                reason = "Only zero-effort records: effort marked 0, not verified"
        else:
            reason = "Capacity and allocation resolved"
            rounded_remaining = round(remaining, 6)
            if rounded_remaining < 0:
                status = OVER_ALLOCATED
            elif rounded_remaining == 0:
                status = FULLY_COMMITTED
            elif round(planned, 6) == 0:
                status = FULLY_AVAILABLE
            else:
                status = PARTIALLY_AVAILABLE

        result[(key, month)] = EmployeeMonth(
            key=key,
            month=month,
            capacity=capacity,
            named_rows=len(group),
            valid_rows=len(valid),
            placeholder_rows=len(placeholders),
            unresolved_rows=len(unresolved),
            project_count=len({r.project_id for r in group if r.project_id}),
            raw_hours=raw_hours,
            verified_hours=verified,
            unresolved_hours=unresolved_hours,
            planned=planned,
            remaining=remaining,
            status=status,
            status_reason=reason,
            contract_category=contract_category_of({contract_class(r.contract_type) for r in group}),
        )
    return result


# --------------------------------------------------------------------------- projects
@dataclass
class Project:
    id: str
    name: str
    client_bu: str
    status_raw: str | None
    status: str
    lead: str
    contract_type: str
    contract_category: str
    start: date | None
    end: date | None
    description: str

    @property
    def search_label(self) -> str:
        return f"{self.id}: {self.name}"


def build_projects(pt_rows: list[dict[str, Any]]) -> dict[str, Project]:
    by_project: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for raw in pt_rows:
        project_id = raw.get("project_id")
        if project_id and str(project_id).strip():
            by_project[project_id].append(raw)

    projects: dict[str, Project] = {}
    for project_id, group in by_project.items():
        group = sorted(group, key=lambda r: (r.get("row_id") is None, r.get("row_id") or ""))

        def first(attr: str) -> str | None:
            return next((v for v in (_blank_null(r.get(attr)) for r in group) if v), None)

        client = first("parent_account") or first("account")
        bdu = first("bdu")
        client_bu = (
            NOT_AVAILABLE if client is None and bdu is None
            else f"{client} / {bdu}" if client and bdu
            else client or bdu or NOT_AVAILABLE
        )

        types = sorted({t for t in (_blank_null(r.get("contract_type")) for r in group) if t})
        categories = {
            {"FTE": FTE_BASED, "Program": PROGRAM_BASED}.get(contract_class(t), NOT_SPECIFIED)
            for t in types
        }
        contract_type = NOT_AVAILABLE if not types else types[0] if len(types) == 1 else "Multiple contract types"
        contract_category = (
            NOT_SPECIFIED if not categories else next(iter(categories)) if len(categories) == 1 else "Mixed Contracts"
        )
        starts = [r["start_date"] for r in group if r.get("start_date")]
        ends = [r["end_date"] for r in group if r.get("end_date")]
        status_raw = first("project_status")

        projects[project_id] = Project(
            id=project_id,
            name=first("project_name") or NOT_AVAILABLE,
            client_bu=client_bu,
            status_raw=status_raw,
            status=display_status(status_raw),
            lead=first("project_lead") or NOT_AVAILABLE,
            contract_type=contract_type,
            contract_category=contract_category,
            start=min(starts) if starts else None,
            end=max(ends) if ends else None,
            description=first("notes") or NOT_AVAILABLE,
        )
    return projects


# --------------------------------------------------------------------------- snapshot
@dataclass
class Snapshot:
    today: date
    window: list[int]
    months_with_data: set[int]
    rows: list[PtRow]
    employees: dict[str, Employee]
    employee_months: dict[tuple[str, int], EmployeeMonth]
    projects: dict[str, Project]
    data_quality: dict[str, int]

    def rows_by_employee(self) -> dict[str, list[PtRow]]:
        cache = getattr(self, "_rows_by_employee", None)
        if cache is None:
            cache = defaultdict(list)
            for row in self.rows:
                if row.named and row.month in set(self.window):
                    cache[row.employee_key].append(row)
            self._rows_by_employee = cache  # type: ignore[attr-defined]
        return cache


def build_snapshot(
    pt_rows: list[dict[str, Any]],
    hr_rows: list[dict[str, Any]],
    today: date,
    capacity_hours: float = CAPACITY_HOURS,
    window_months: int = WINDOW_MONTHS,
) -> Snapshot:
    window = build_window(today, window_months)
    rows = classify_rows(pt_rows)
    employees = build_employees(hr_rows, rows)
    employee_months = build_employee_months(rows, employees, window, capacity_hours)
    months_with_data = {r.month for r in rows if r.month is not None}

    in_window = set(window)
    windowed_named = [r for r in rows if r.named and r.month in in_window]
    quality = {
        "unresolved_rows": sum(1 for r in windowed_named if r.status == UNRESOLVED),
        "placeholder_rows": sum(1 for r in windowed_named if r.status == PLACEHOLDER),
        "missing_hr_match_employees": len(
            {r.employee_key for r in windowed_named if not employees[r.employee_key].hr_matched}
        ),
        "rows_outside_employment": sum(
            1 for r in windowed_named if (r.employee_key, r.month) not in employee_months
        ),
    }
    return Snapshot(
        today=today,
        window=window,
        months_with_data=months_with_data,
        rows=rows,
        employees=employees,
        employee_months=employee_months,
        projects=build_projects(pt_rows),
        data_quality=quality,
    )
