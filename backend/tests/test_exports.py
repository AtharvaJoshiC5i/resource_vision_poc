"""Employee exports: report figures, the Excel workbook and the client slide. Synthetic data only."""

from __future__ import annotations

import io
from datetime import datetime

import openpyxl
import pytest
from fastapi.testclient import TestClient
from pptx import Presentation

from app.main import app
from app.rv import engine as e
from app.rv import service, skills
from app.rv.exports.report import build_employee_report
from app.rv.exports.slide import build_slide
from app.rv.exports.xlsx import build_workbook
from app.rv.skills import SkillRecord, SkillsSnapshot
from tests.test_engine import hr, pt, snap

NOV, DEC, JAN, FEB = 202611, 202612, 202701, 202702
GENERATED = datetime(2026, 11, 5, 9, 30)
SKILLS = SkillsSnapshot(by_code={"E1": [SkillRecord("Python", "Expert"), SkillRecord("SQL", "Beginner")]}, available=True)


def sample_snapshot(**hr_extra):
    rows = [
        pt("e1", NOV, 100, project="P1"),
        pt("e1", DEC, 176, project="P1"),
        pt("e1", DEC, 40, project="P2", sub="B"),
        pt("e1", JAN, 0, project="P1"),
        pt("e1", FEB, 30, project="P2", override=True),
        pt("e2", NOV, 10, project="P1"),
    ]
    return snap(rows, [hr("e1", **hr_extra), hr("e2")])


def report_for(s=None, key="e1", **kw):
    return build_employee_report(
        s or sample_snapshot(), key, source_label="Synthetic", generated_at=GENERATED, skills_snapshot=SKILLS, **kw
    )


# --------------------------------------------------------------------------- report
def test_report_figures_match_the_engine():
    r = report_for()
    assert r.window[0] == NOV and len(r.months) == e.WINDOW_MONTHS
    assert r.planned_total == pytest.approx(316)  # Feb has rows to review, so no planned figure
    assert r.free_total == pytest.approx(76 - 40 + 176)
    assert r.review_total == pytest.approx(30)
    assert r.next_available.month == NOV
    assert r.average_utilisation == pytest.approx(316 / (176 * 3))
    assert r.peak.month == DEC and r.count_status(e.OVER_ALLOCATED) == 1
    assert [p.id for p in r.projects] == ["P1", "P2"]
    assert r.projects[0].planned == pytest.approx(276)
    assert r.projects[1].review_by_month == {FEB: 30}
    assert {(d.month, d.project_id, d.sub_project) for d in r.details} >= {(DEC, "P1", "A"), (DEC, "P2", "B")}
    assert r.skills == [{"name": "Python", "level": "Expert"}, {"name": "SQL", "level": "Beginner"}]


def test_unknown_employee_has_no_report():
    assert report_for(key="nobody") is None


def test_next_available_skips_fully_booked_months():
    s = snap([pt("e1", NOV, 176), pt("e1", DEC, 100)], [hr("e1")])
    assert report_for(s).next_available.month == DEC


def test_next_available_stops_at_a_month_without_a_record():
    s = snap([pt("e1", NOV, 176), pt("e2", DEC, 10), pt("e1", JAN, 0)], [hr("e1"), hr("e2")])
    assert report_for(s).next_available is None  # December is unknown, never assumed free


# --------------------------------------------------------------------------- workbook
def load(report):
    return openpyxl.load_workbook(io.BytesIO(build_workbook(report)))


def test_workbook_sheets_and_monthly_values():
    wb = load(report_for())
    assert wb.sheetnames == ["Overview", "Monthly availability", "Project allocation", "Allocation detail", "Profile and skills", "Notes", "ChartData"]
    assert wb["ChartData"].sheet_state == "hidden"
    ws = wb["Monthly availability"]
    header = next(r for r in range(1, 20) if ws.cell(r, 2).value == "Month")
    assert [ws.cell(header, c).value for c in range(2, 9)] == ["Month", "Status", "Basis", "Capacity h", "Planned h", "Needs review h", "Free h"]
    nov = header + 1
    assert ws.cell(nov, 3).value == e.PARTIALLY_AVAILABLE and ws.cell(nov, 6).value == 100 and ws.cell(nov, 8).value == 76
    total = header + 1 + e.WINDOW_MONTHS
    assert ws.cell(total, 2).value == "Window total"
    assert str(ws.cell(total, 6).value).startswith("=SUM(")


def test_project_matrix_rows_and_totals():
    ws = load(report_for())["Project allocation"]
    ids = [ws.cell(r, 2).value for r in range(1, ws.max_row + 1)]
    assert ids.index("P1") < ids.index("P2")
    assert "Total planned" in ids and "Hours needing review (not counted above)" in ids


def test_text_that_looks_like_a_formula_stays_text():
    s = snap([pt("e1", NOV, 10)], [hr("e1", employee_name='=HYPERLINK("http://x.invalid","x")')])
    ws = load(report_for(s))["Profile and skills"]
    cells = [c for row in ws.iter_rows() for c in row if isinstance(c.value, str) and "HYPERLINK" in c.value]
    assert cells and all(c.data_type == "s" for c in cells)


def test_workbook_handles_an_employee_with_no_allocations():
    r = report_for(snap([pt("e1", NOV, 0)], [hr("e1")]))
    assert r.planned_total == 0 and r.projects[0].planned == 0
    wb = load(r)
    assert wb["Overview"]["B3"].value == "Name e1"
    assert build_slide(r)[:2] == b"PK"


def test_sample_note_appears_on_overview_and_notes():
    wb = load(report_for(sample_note="Limited sample: first 1,000 Project Track rows a month."))
    texts = {c.value for name in ("Overview", "Notes") for row in wb[name].iter_rows() for c in row if c.value}
    assert "Limited sample: first 1,000 Project Track rows a month." in texts


# --------------------------------------------------------------------------- slide
def slide_text(report) -> str:
    prs = Presentation(io.BytesIO(build_slide(report)))
    assert len(prs.slides) == 1
    return "\n".join(
        para.text for shape in prs.slides[0].shapes if shape.has_text_frame for para in shape.text_frame.paragraphs
    )


def test_slide_shows_safe_client_facing_content():
    text = slide_text(report_for())
    assert "Name e1" in text and "Availability outlook" in text and "Python" in text
    assert "43%" in text  # November: 76 of 176 hours free, rounded
    for private in ("x@example.com", "Boss", "Project P1", "Client", "176", "Over-allocated", "review"):
        assert private not in text


def test_slide_marks_unverified_months_tentative_or_unconfirmed():
    s = snap([pt("e1", NOV, 50, override=True)], [hr("e1")])
    assert "TBC" in slide_text(report_for(s))


# --------------------------------------------------------------------------- endpoints
@pytest.fixture
def client(monkeypatch):
    s = sample_snapshot()
    monkeypatch.setattr(service, "get_snapshot", lambda: s)
    monkeypatch.setattr(service, "data_source", lambda: "azure")
    monkeypatch.setattr(service, "data_info", lambda: {"load_summary": {"sampled": True, "sample_rows_per_month": 1000}})
    monkeypatch.setattr(skills, "get_skills_snapshot", lambda: SKILLS)
    return TestClient(app)


@pytest.mark.parametrize("ext, media", [
    ("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    ("pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"),
])
def test_export_endpoints_return_named_attachments(client, ext, media):
    res = client.get(f"/api/rv/employees/e1/export.{ext}")
    assert res.status_code == 200
    assert res.headers["content-type"] == media
    assert res.headers["cache-control"] == "no-store"
    disposition = res.headers["content-disposition"]
    assert disposition.startswith("attachment;") and f"Name-e1_e1_" in disposition and disposition.count(f".{ext}") == 2
    assert res.content[:2] == b"PK"


def test_workbook_endpoint_carries_the_sample_note(client):
    wb = openpyxl.load_workbook(io.BytesIO(client.get("/api/rv/employees/e1/export.xlsx").content))
    texts = {c.value for row in wb["Notes"].iter_rows() for c in row if c.value}
    assert any(isinstance(t, str) and t.startswith("Limited sample: first 1,000 Project Track rows a month") for t in texts)


def test_export_of_unknown_employee_is_404(client):
    assert client.get("/api/rv/employees/nobody/export.xlsx").status_code == 404
    assert client.get("/api/rv/employees/nobody/export.pptx").status_code == 404
