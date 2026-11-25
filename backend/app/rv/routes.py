"""HTTP API for the three dashboard pages. Read-only; localhost deployment."""

from __future__ import annotations

import re
import unicodedata
from datetime import datetime
from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response
from pydantic import BaseModel, Field

from app.database import DatabaseError
from app.rv import service, skills, views
from app.rv.exports.report import EmployeeReport, build_employee_report

def _short_cache(response: Response) -> None:
    """Let the browser reuse a response briefly; the URL carries every filter."""
    response.headers["Cache-Control"] = "private, max-age=30"


router = APIRouter(prefix="/api/rv", tags=["resource-vision"], dependencies=[Depends(_short_cache)])


def _snapshot():
    try:
        return service.get_snapshot()
    except service.DataSourceUnavailable as error:  # the reason is safe by construction
        raise HTTPException(status_code=503, detail=str(error)) from error
    except DatabaseError as error:  # details are logged server-side only
        raise HTTPException(status_code=503, detail="The data source is currently unavailable.") from error


def _filters(
    months: Annotated[list[int] | None, Query()] = None,
    contract_category: Annotated[list[str] | None, Query()] = None,
    division: Annotated[list[str] | None, Query()] = None,
    capability: Annotated[list[str] | None, Query()] = None,
    grade: Annotated[list[str] | None, Query()] = None,
    location: Annotated[list[str] | None, Query()] = None,
    search: Annotated[str | None, Query(max_length=100)] = None,
    status: Annotated[list[str] | None, Query()] = None,
    skill: Annotated[list[str] | None, Query()] = None,
    skill_level: Annotated[list[str] | None, Query()] = None,
    business_vertical: Annotated[list[str] | None, Query()] = None,
    client: Annotated[list[str] | None, Query()] = None,
    tenure: Annotated[list[str] | None, Query()] = None,
    squad: Annotated[list[str] | None, Query(max_length=100)] = None,
) -> views.Filters:
    # Match Any, same as the Power BI report: Skill Name and Skill Level both narrow the
    # same bridge row (vw_RV_EmployeeSkillsForDashboard), so "Python" + "Advanced" means
    # Python at Advanced, not "has Python, separately has something Advanced".
    skill_codes = skills.matching_codes(skills.get_skills_snapshot(), set(skill or []), set(skill_level or []))
    return views.Filters(
        months=months or None,
        contract_categories=set(contract_category or []),
        divisions=set(division or []),
        capabilities=set(capability or []),
        grades=set(grade or []),
        locations=set(location or []),
        search=search,
        statuses=set(status or []),
        skill_codes=skill_codes,
        business_verticals=set(business_vertical or []),
        clients=set(client or []),
        tenures=set(tenure or []),
        employee_keys={k.strip().upper() for k in (squad or []) if k and k.strip()} or None,
    )


FilterDep = Annotated[views.Filters, Depends(_filters)]


@router.get("/meta")
def meta():
    snap = _snapshot()
    return {
        "today": snap.today.isoformat(),
        "capacity_hours": service.capacity_hours(),
        "window": [
            {"key": m, "label": views.month_label(m), "has_data": m in snap.months_with_data}
            for m in snap.window
        ],
        "data_quality": snap.data_quality,
        "source": service.data_source(),
        "sources": service.source_options(),
        "data": service.data_info(),
    }


class DataSourceChange(BaseModel):
    source: str = Field(max_length=20)


@router.post("/data-source", status_code=202)
def change_data_source(change: DataSourceChange):
    """Start switching between the Azure SQL and DBTEZ API sources. Poll /data-source/status."""
    try:
        return service.start_switch(change.source.strip().lower())
    except service.SourceSwitchError as error:
        raise HTTPException(status_code=409, detail=str(error)) from None


@router.get("/data-source/status")
def data_source_status(response: Response):
    response.headers["Cache-Control"] = "no-store"
    return {**service.switch_status(), "current": service.data_source()}


@router.get("/availability/options")
def availability_options():
    return views.availability_options(_snapshot())


@router.get("/skills/options")
def skills_options():
    return skills.skill_options()


@router.get("/availability/overview")
def availability_overview(f: FilterDep):
    return views.availability_overview(_snapshot(), f)


@router.get("/availability/matrix")
def availability_matrix(f: FilterDep, page: int = 1, page_size: int = 50):
    return views.availability_matrix(_snapshot(), f, page, page_size)


@router.get("/accounts/utilization")
def accounts_utilization(f: FilterDep):
    return views.account_utilization(_snapshot(), f)


@router.get("/employees/search")
def employees_search(q: Annotated[str | None, Query(max_length=100)] = None):
    return views.employee_search(_snapshot(), q)


@router.get("/employees/directory")
def employees_directory(month: int | None = None):
    return views.employee_directory(_snapshot(), month)


@router.get("/employees/{key}")
def employee_detail(key: Annotated[str, Path(max_length=100)]):
    detail = views.employee_detail(_snapshot(), key)
    if detail is None:
        raise HTTPException(status_code=404, detail="Employee not found.")
    return detail


XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
PPTX_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation"


def _sample_note() -> str | None:
    summary = service.data_info().get("load_summary") or {}
    if not summary.get("sampled"):
        return None
    parts = []
    if summary.get("sample_rows_per_month"):
        parts.append(f"first {summary['sample_rows_per_month']:,} Project Track rows a month")
    if summary.get("sample_hr_rows"):
        parts.append(f"first {summary['sample_hr_rows']:,} ZingHR rows")
    if summary.get("months_loaded") and summary.get("months_in_window"):
        parts.append(f"{summary['months_loaded']} of {summary['months_in_window']} months loaded")
    detail = ", ".join(parts) if parts else "not every record was loaded"
    return f"Limited sample: {detail}. Totals may be incomplete."


def _employee_report(key: str) -> EmployeeReport:
    snap = _snapshot()
    report = build_employee_report(
        snap,
        key,
        source_label=service.SOURCE_LABELS.get(service.data_source(), service.data_source()),
        sample_note=_sample_note(),
        generated_at=datetime.now(),
        capacity_hours=service.capacity_hours(),
    )
    if report is None:
        raise HTTPException(status_code=404, detail="Employee not found.")
    return report


def _download_name(report: EmployeeReport, kind: str, extension: str) -> str:
    name = unicodedata.normalize("NFKD", str(report.profile.get("name") or "Employee"))
    name = re.sub(r"[^A-Za-z0-9]+", "-", name.encode("ascii", "ignore").decode()).strip("-") or "Employee"
    code = re.sub(r"[^A-Za-z0-9]+", "", str(report.profile.get("code") or ""))
    stem = "_".join(part for part in (name, code, kind, report.generated_at.strftime("%Y-%m-%d")) if part)
    return f"{stem}.{extension}"


def _file(content: bytes, media_type: str, filename: str) -> Response:
    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f"attachment; filename=\"{filename}\"; filename*=UTF-8''{quote(filename)}",
            "X-Content-Type-Options": "nosniff",
            "Cache-Control": "no-store",  # employee data: never keep a copy in the browser cache
        },
    )


@router.get("/employees/{key}/export.xlsx")
def employee_workbook(key: Annotated[str, Path(max_length=100)]):
    from app.rv.exports.xlsx import build_workbook

    report = _employee_report(key)
    return _file(build_workbook(report), XLSX_TYPE, _download_name(report, "availability", "xlsx"))


@router.get("/employees/{key}/export.pptx")
def employee_slide(key: Annotated[str, Path(max_length=100)]):
    from app.rv.exports.slide import build_slide

    report = _employee_report(key)
    return _file(build_slide(report), PPTX_TYPE, _download_name(report, "profile", "pptx"))


@router.get("/projects/options")
def project_options():
    return views.project_options(_snapshot())


@router.get("/projects")
def projects(f: FilterDep, coverage: str = "All Projects"):
    if coverage not in views.COVERAGE_MODES:
        raise HTTPException(status_code=422, detail="Invalid coverage mode.")
    return views.projects_overview(_snapshot(), f, coverage)


@router.get("/projects/{project_id}")
def project_detail(project_id: Annotated[str, Path(max_length=100)], f: FilterDep):
    detail = views.project_detail(_snapshot(), project_id, f)
    if detail is None:
        raise HTTPException(status_code=404, detail="Project not found.")
    return detail
