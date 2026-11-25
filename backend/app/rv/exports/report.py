"""One employee's figures, gathered once for every export format.

Pure: reads a Snapshot and returns plain dataclasses. The Excel workbook and the slide both
render from this, so the two files can never disagree with each other or with the dashboard.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime

from app.rv import engine as e
from app.rv import skills as skills_mod
from app.rv import views

ESTIMATED_PREFIX = "Estimated:"


@dataclass
class MonthLine:
    month: int
    label: str
    has_data: bool
    present: bool
    capacity: float | None
    planned: float | None
    review: float | None
    free: float | None
    projects: int | None
    contract_category: str | None
    status: str | None
    reason: str | None

    @property
    def estimated(self) -> bool:
        return bool(self.reason and self.reason.startswith(ESTIMATED_PREFIX))

    @property
    def utilisation(self) -> float | None:
        if self.planned is None or not self.capacity:
            return None
        return self.planned / self.capacity

    @property
    def first_day(self) -> date:
        return e.month_start(self.month)


@dataclass
class ProjectLine:
    id: str
    name: str
    client_bu: str
    status: str
    contract: str
    start: date | None
    end: date | None
    planned_by_month: dict[int, float] = field(default_factory=dict)
    review_by_month: dict[int, float] = field(default_factory=dict)
    sub_projects: set[str] = field(default_factory=set)

    @property
    def planned(self) -> float:
        return sum(self.planned_by_month.values())

    @property
    def review(self) -> float:
        return sum(self.review_by_month.values())

    @property
    def months(self) -> list[int]:
        return sorted(set(self.planned_by_month) | set(self.review_by_month))


@dataclass
class DetailLine:
    month: int
    project_id: str
    project_name: str
    client_bu: str
    project_status: str
    contract: str
    sub_project: str
    planned: float | None
    review: float | None
    start: date | None
    end: date | None


@dataclass
class EmployeeReport:
    generated_at: datetime
    source_label: str
    sample_note: str | None
    capacity_hours: float
    window: list[int]
    profile: dict
    exit_date: date | None
    manager_code: str | None
    months: list[MonthLine]
    projects: list[ProjectLine]
    details: list[DetailLine]
    skills: list[dict] | None

    # ------------------------------------------------------------------ headline figures
    @property
    def window_label(self) -> str:
        if not self.window:
            return "No months in view"
        return f"{views.month_label(self.window[0])} to {views.month_label(self.window[-1])}"

    @property
    def records(self) -> list[MonthLine]:
        return [m for m in self.months if m.present]

    @property
    def current(self) -> MonthLine | None:
        return self.months[0] if self.months else None

    @property
    def planned_total(self) -> float | None:
        values = [m.planned for m in self.records if m.planned is not None]
        return sum(values) if values else None

    @property
    def free_total(self) -> float | None:
        values = [m.free for m in self.records if m.free is not None]
        return sum(values) if values else None

    @property
    def review_total(self) -> float | None:
        values = [m.review for m in self.records if m.review]
        return sum(values) if values else None

    @property
    def capacity_total(self) -> float | None:
        values = [m.capacity for m in self.records if m.capacity is not None and m.planned is not None]
        return sum(values) if values else None

    @property
    def average_utilisation(self) -> float | None:
        cap = self.capacity_total
        planned = sum(m.planned for m in self.records if m.capacity is not None and m.planned is not None)
        return planned / cap if cap else None

    @property
    def peak(self) -> MonthLine | None:
        scored = [m for m in self.records if m.utilisation is not None]
        return max(scored, key=lambda m: (m.utilisation, -m.month)) if scored else None

    @property
    def next_available(self) -> MonthLine | None:
        """First month in the window with free hours above zero."""
        for m in self.months:
            if m.present and m.free is not None and m.free > e.EPS:
                return m
            if m.has_data and not m.present:
                return None  # no record means unknown, never assume free
        return None

    def count_status(self, status: str) -> int:
        return sum(1 for m in self.records if m.status == status)

    @property
    def estimated_months(self) -> int:
        return sum(1 for m in self.records if m.estimated)

    @property
    def project_months(self) -> int:
        return sum(m.projects or 0 for m in self.records)

    @property
    def contract_category(self) -> str:
        return views._combine_categories([m.contract_category for m in self.records if m.contract_category])


def build_employee_report(
    snap: e.Snapshot,
    key: str,
    *,
    source_label: str,
    sample_note: str | None = None,
    generated_at: datetime | None = None,
    skills_snapshot: skills_mod.SkillsSnapshot | None = None,
    capacity_hours: float | None = None,
) -> EmployeeReport | None:
    emp = snap.employees.get(key.strip().upper())
    if emp is None:
        return None
    detail = views.employee_detail(snap, emp.key)
    if detail is None:
        return None

    months: list[MonthLine] = []
    capacity_seen: list[float] = []
    for m in snap.window:
        em = snap.employee_months.get((emp.key, m))
        if em is not None and em.capacity is not None:
            capacity_seen.append(em.capacity)
        months.append(
            MonthLine(
                month=m,
                label=views.month_label(m),
                has_data=m in snap.months_with_data,
                present=em is not None,
                capacity=em.capacity if em else None,
                planned=em.planned if em else None,
                review=em.unresolved_hours if em else None,
                free=em.remaining if em else None,
                projects=em.project_count if em else None,
                contract_category=em.contract_category if em else None,
                status=em.status if em else None,
                reason=em.status_reason if em else None,
            )
        )

    projects: dict[str, ProjectLine] = {}
    sub_hours: dict[tuple[int, str, str], list[float | None]] = defaultdict(lambda: [None, None])
    sub_dates: dict[tuple[int, str, str], list[date]] = defaultdict(list)
    for r in snap.rows_by_employee().get(emp.key, []):
        if (emp.key, r.month) not in snap.employee_months or r.month is None:
            continue
        pid = r.project_id or ""
        project = snap.projects.get(pid)
        line = projects.get(pid)
        if line is None:
            line = ProjectLine(
                id=pid or e.NOT_AVAILABLE,
                name=project.name if project else e.NOT_AVAILABLE,
                client_bu=project.client_bu if project else e.NOT_AVAILABLE,
                status=project.status if project else e.NOT_AVAILABLE,
                contract=project.contract_type if project else e.NOT_AVAILABLE,
                start=project.start if project else None,
                end=project.end if project else None,
            )
            projects[pid] = line
        sub = e.sub_project_label(r.sub_project_name)
        line.sub_projects.add(sub)
        slot = sub_hours[(r.month, pid, sub)]
        if r.status == e.VALID and r.effort is not None:
            line.planned_by_month[r.month] = line.planned_by_month.get(r.month, 0.0) + r.effort
            slot[0] = (slot[0] or 0.0) + r.effort
        elif r.status == e.UNRESOLVED and r.effort is not None:
            line.review_by_month[r.month] = line.review_by_month.get(r.month, 0.0) + r.effort
            slot[1] = (slot[1] or 0.0) + r.effort
        elif r.status == e.PLACEHOLDER:
            line.planned_by_month.setdefault(r.month, 0.0)
            slot[0] = slot[0] or 0.0
        sub_dates[(r.month, pid, sub)] += [d for d in (r.start_date, r.end_date) if d]

    details = []
    for (month, pid, sub), (planned, review) in sorted(sub_hours.items(), key=lambda kv: (kv[0][0], projects[kv[0][1]].name.casefold(), kv[0][2])):
        line = projects[pid]
        dates = sub_dates[(month, pid, sub)]
        details.append(
            DetailLine(
                month=month,
                project_id=line.id,
                project_name=line.name,
                client_bu=line.client_bu,
                project_status=line.status,
                contract=line.contract,
                sub_project=sub,
                planned=planned,
                review=review,
                start=min(dates) if dates else line.start,
                end=max(dates) if dates else line.end,
            )
        )

    ordered = sorted(projects.values(), key=lambda p: (-p.planned, -p.review, p.name.casefold()))
    snapshot = skills_snapshot if skills_snapshot is not None else skills_mod.get_skills_snapshot()
    return EmployeeReport(
        generated_at=generated_at or datetime.now(),
        source_label=source_label,
        sample_note=sample_note,
        capacity_hours=capacity_hours or (capacity_seen[0] if capacity_seen else e.CAPACITY_HOURS),
        window=list(snap.window),
        profile=detail["profile"],
        exit_date=emp.exit,
        manager_code=emp.manager_code,
        months=months,
        projects=ordered,
        details=details,
        skills=skills_mod.employee_skills(snapshot, emp.code),
    )
