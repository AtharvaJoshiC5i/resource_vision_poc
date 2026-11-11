"""HTTP API for the three dashboard pages. Read-only; localhost deployment."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response

from app.database import DatabaseError
from app.rv import service, views

def _short_cache(response: Response) -> None:
    """Let the browser reuse a response briefly; the URL carries every filter."""
    response.headers["Cache-Control"] = "private, max-age=30"


router = APIRouter(prefix="/api/rv", tags=["resource-vision"], dependencies=[Depends(_short_cache)])


def _snapshot():
    try:
        return service.get_snapshot()
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
) -> views.Filters:
    return views.Filters(
        months=months or None,
        contract_categories=set(contract_category or []),
        divisions=set(division or []),
        capabilities=set(capability or []),
        grades=set(grade or []),
        locations=set(location or []),
        search=search,
        statuses=set(status or []),
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
        "data": service.data_info(),
    }


@router.get("/availability/options")
def availability_options():
    return views.availability_options(_snapshot())


@router.get("/availability/overview")
def availability_overview(f: FilterDep):
    return views.availability_overview(_snapshot(), f)


@router.get("/availability/matrix")
def availability_matrix(f: FilterDep, page: int = 1, page_size: int = 50):
    return views.availability_matrix(_snapshot(), f, page, page_size)


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
