"""Load the precomputed rv2_* tables (see backend/sql/rv2_schema.sql) into a Snapshot.

The heavy rules run in SQL during dbo.rv2_Refresh. This module only reads the
small result tables, so a reload is fast and happens only when the version changes.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from app.database import fetch_rows
from app.rv import engine as e

META = "SELECT TOP 1 Version, RefreshedUtc, TodayDate, CapacityHours FROM dbo.rv2_Meta WHERE MetaId = 1"
MONTHS = "SELECT MonthKey, HasData FROM dbo.rv2_MonthInfo ORDER BY MonthKey"
QUALITY = "SELECT Name, Value FROM dbo.rv2_Quality"
EMPLOYEES = """
SELECT EmployeeKey, EmployeeCode, Name, NameSource, HrMatched, DatesValid, JoiningDate, ExitDate,
       EmployeeStatus, PrimaryCapability, SecondaryCapability, Grade, Country, Location, Division,
       Department, Email, ManagerName, ManagerCode, EmploymentType
FROM dbo.rv2_Employee"""
EMPLOYEE_MONTHS = """
SELECT EmployeeKey, MonthKey, Capacity, NamedRows, ValidRows, PlaceholderRows, UnresolvedRows,
       ProjectCount, RawHours, VerifiedHours, UnresolvedHours, Planned, Remaining, Status,
       StatusReason, ContractCategory
FROM dbo.rv2_EmployeeMonth"""
ALLOCATIONS = """
SELECT SourceRowId, EmployeeKey, MonthKey, ProjectId, ProposalNumber, SubProject, Effort,
       RowStatus, Reason, ContractType, StartDate, EndDate
FROM dbo.rv2_Allocation"""
PROJECTS = """
SELECT ProjectId, ProjectName, ClientBU, ProjectStatus, ProjectLead, ContractType, ContractCategory,
       StartDate, EndDate, Description
FROM dbo.rv2_Project"""


def read_meta() -> dict[str, Any] | None:
    rows = fetch_rows(META)
    return rows[0] if rows else None


def _f(value: Any) -> float | None:
    return None if value is None else float(value)


def load_snapshot_from_facts() -> tuple[e.Snapshot, dict[str, Any]]:
    meta = read_meta()
    if meta is None:
        raise RuntimeError("rv2 tables are empty: run backend/scripts/refresh_facts.py first")

    months = fetch_rows(MONTHS)
    window = [int(m["MonthKey"]) for m in months]

    employees = {
        r["EmployeeKey"]: e.Employee(
            key=r["EmployeeKey"], code=r["EmployeeCode"], name=r["Name"], name_source=r["NameSource"],
            hr_matched=bool(r["HrMatched"]), dates_valid=bool(r["DatesValid"]),
            joining=r["JoiningDate"], exit=r["ExitDate"], employee_status=r["EmployeeStatus"],
            primary_capability=r["PrimaryCapability"], secondary_capability=r["SecondaryCapability"],
            grade=r["Grade"], country=r["Country"], location=r["Location"], division=r["Division"],
            department=r["Department"], email=r["Email"], manager_name=r["ManagerName"],
            manager_code=r["ManagerCode"], employment_type=r["EmploymentType"],
        )
        for r in fetch_rows(EMPLOYEES)
    }

    employee_months = {
        (r["EmployeeKey"], int(r["MonthKey"])): e.EmployeeMonth(
            key=r["EmployeeKey"], month=int(r["MonthKey"]), capacity=_f(r["Capacity"]),
            named_rows=r["NamedRows"], valid_rows=r["ValidRows"], placeholder_rows=r["PlaceholderRows"],
            unresolved_rows=r["UnresolvedRows"], project_count=r["ProjectCount"],
            raw_hours=float(r["RawHours"]), verified_hours=_f(r["VerifiedHours"]),
            unresolved_hours=_f(r["UnresolvedHours"]), planned=_f(r["Planned"]),
            remaining=_f(r["Remaining"]), status=r["Status"], status_reason=r["StatusReason"],
            contract_category=r["ContractCategory"],
        )
        for r in fetch_rows(EMPLOYEE_MONTHS)
    }

    rows = [
        e.PtRow(
            row_id=r["SourceRowId"], project_id=r["ProjectId"], proposal_number=r["ProposalNumber"],
            sub_project_name=r["SubProject"], employee_key=r["EmployeeKey"], employee_code=None,
            month=int(r["MonthKey"]), month_valid=True, effort=_f(r["Effort"]), is_override=False,
            contract_type=r["ContractType"], start_date=r["StartDate"], end_date=r["EndDate"],
            status=r["RowStatus"], reason=r["Reason"],
        )
        for r in fetch_rows(ALLOCATIONS)
    ]

    projects = {}
    for r in fetch_rows(PROJECTS):
        na = e.NOT_AVAILABLE
        projects[r["ProjectId"]] = e.Project(
            id=r["ProjectId"], name=r["ProjectName"] or na, client_bu=r["ClientBU"] or na,
            status_raw=r["ProjectStatus"], status=e.display_status(r["ProjectStatus"]),
            lead=r["ProjectLead"] or na, contract_type=r["ContractType"] or na,
            contract_category=r["ContractCategory"] or e.NOT_SPECIFIED,
            start=r["StartDate"], end=r["EndDate"], description=r["Description"] or na,
        )

    snapshot = e.Snapshot(
        today=meta["TodayDate"] if isinstance(meta["TodayDate"], date) else date.today(),
        window=window,
        months_with_data={int(m["MonthKey"]) for m in months if m["HasData"]},
        rows=rows,
        employees=employees,
        employee_months=employee_months,
        projects=projects,
        data_quality={r["Name"]: int(r["Value"]) for r in fetch_rows(QUALITY)},
    )
    return snapshot, meta
