from __future__ import annotations

from datetime import date

import pytest

from app.rv import engine as e
from app.rv import views as v
from app.rv.demo_data import build_demo

TODAY = date(2026, 11, 5)  # window = Nov 2026 .. May 2028


def pt(emp, month, effort, project="P1", sub="A", proposal=1, override=False,
       contract="T&M - FTE", row_id=None, name=None, **extra):
    row = {
        "row_id": row_id or f"{emp}-{month}-{project}-{sub}-{effort}",
        "project_id": project, "proposal_number": proposal, "sub_project_name": sub,
        "employee_key": emp.upper() if emp else None, "employee_code": emp,
        "month_key": e.month_start(month), "effort": effort, "is_override": override,
        "contract_type": contract, "project_name": f"Project {project}",
        "parent_account": "Client", "account": None, "bdu": "BU", "project_status": "in_approval",
        "project_lead": "Lead", "notes": None,
        "start_date": date(2026, 1, 1), "end_date": date(2027, 12, 31),
        "employee_name": name, "primary_capability": None, "secondary_capability": None,
        "department": None, "grade": None, "location": None, "country": None,
    }
    row.update(extra)
    return row


def hr(code, joining=date(2020, 1, 1), status="Existing", **extra):
    row = {
        "employee_key": code.upper(), "employee_code": code, "employee_name": f"Name {code}",
        "joining_date": joining, "exit_date": None, "leaving_date": None, "resignation_date": None,
        "employee_status": status, "primary_capability": "Data", "secondary_capability": "Cloud",
        "grade": "C2", "country": "India", "location": "Onshore", "division": "Tech",
        "department": "Eng", "email": "x@example.com", "manager_name": "Boss",
        "manager_code": "M1", "employment_type": "Full Time",
    }
    row.update(extra)
    return row


def snap(pt_rows, hr_rows):
    return e.build_snapshot(pt_rows, hr_rows, TODAY)


def em(s, emp, month):
    return s.employee_months[(emp.upper(), month)]


# ------------------------------------------------------------------ months / helpers
def test_window_is_current_month_plus_18():
    w = e.build_window(TODAY)
    assert len(w) == 19 and w[0] == 202611 and w[-1] == 202805
    assert e.build_window(date(2026, 12, 31))[:2] == [202612, 202701]


@pytest.mark.parametrize("text,expected", [
    ("T&M - FTE", "FTE"), ("t&m – fte", "FTE"), ("T&M - Hrs", "Program"),
    ("Output - Effort based", "Program"), ("Output - Fixed spread", "Program"),
    ("Fixed bid", "Unclassified"), (None, "Unclassified"),
])
def test_contract_class(text, expected):
    assert e.contract_class(text) == expected


def test_display_status():
    assert e.display_status("in_approval") == "In Approval"
    assert e.display_status(None) == e.NOT_AVAILABLE


# ------------------------------------------------------------------ status rules
def test_single_positive_row_partially_available():
    s = snap([pt("e1", 202611, 80.0)], [hr("e1")])
    m = em(s, "e1", 202611)
    assert (m.capacity, m.planned, m.remaining, m.status) == (176.0, 80.0, 96.0, e.PARTIALLY_AVAILABLE)


def test_fully_committed_and_over_allocated():
    s = snap([pt("e1", 202611, 176.0), pt("e2", 202611, 200.0)], [hr("e1"), hr("e2")])
    assert em(s, "e1", 202611).status == e.FULLY_COMMITTED
    over = em(s, "e2", 202611)
    assert over.status == e.OVER_ALLOCATED and over.remaining == -24.0


def test_two_rows_sum():
    s = snap([pt("e1", 202611, 60.0, project="P1"), pt("e1", 202611, 40.0, project="P2")], [hr("e1")])
    m = em(s, "e1", 202611)
    assert m.planned == 100.0 and m.project_count == 2 and m.remaining == 76.0


def test_placeholder_only_is_unverified():
    s = snap([pt("e1", 202611, 0.0)], [hr("e1")])
    m = em(s, "e1", 202611)
    assert m.status == e.UNVERIFIED and m.planned is None and m.remaining is None
    assert m.placeholder_rows == 1 and "zero" in m.status_reason.lower()


def test_placeholder_next_to_valid_row_is_ignored():
    rows = [pt("e1", 202611, 80.0, sub="A"), pt("e1", 202611, 0.0, sub="B")]
    m = em(snap(rows, [hr("e1")]), "e1", 202611)
    assert m.status == e.PARTIALLY_AVAILABLE and m.planned == 80.0 and m.placeholder_rows == 1


def test_duplicate_group_with_single_positive_row_uses_it():
    rows = [pt("e1", 202611, 0.0, row_id="a"), pt("e1", 202611, 0.0, row_id="b"), pt("e1", 202611, 80.0, row_id="c")]
    m = em(snap(rows, [hr("e1")]), "e1", 202611)
    assert m.planned == 80.0 and m.unresolved_rows == 0 and m.status == e.PARTIALLY_AVAILABLE


def test_duplicate_group_with_two_positive_rows_is_unresolved():
    rows = [pt("e1", 202611, 80.0, row_id="a"), pt("e1", 202611, 40.0, row_id="b")]
    m = em(snap(rows, [hr("e1")]), "e1", 202611)
    assert m.status == e.UNVERIFIED and m.unresolved_rows == 2
    assert m.unresolved_hours == 120.0 and m.verified_hours is None and m.planned is None


def test_unresolved_row_blocks_status_but_verified_hours_are_shown():
    rows = [pt("e1", 202611, 80.0, project="P1", row_id="a"), pt("e1", 202611, 40.0, project="P1", row_id="b"),
            pt("e1", 202611, 40.0, project="P2")]
    m = em(snap(rows, [hr("e1")]), "e1", 202611)
    assert m.status == e.UNVERIFIED and m.verified_hours == 40.0 and m.planned is None


def test_override_row_is_unresolved_and_flag_none_too():
    s = snap([pt("e1", 202611, 50.0, override=True), pt("e2", 202611, 50.0, override=None)], [hr("e1"), hr("e2")])
    assert em(s, "e1", 202611).unresolved_rows == 1 and em(s, "e2", 202611).status == e.UNVERIFIED


def test_negative_effort_and_not_first_of_month_are_unresolved():
    bad_day = pt("e2", 202611, 10.0)
    bad_day["month_key"] = date(2026, 11, 15)
    s = snap([pt("e1", 202611, -5.0), bad_day], [hr("e1"), hr("e2")])
    assert em(s, "e1", 202611).unresolved_rows == 1
    assert em(s, "e2", 202611).unresolved_rows == 1


def test_included_default_is_ignored():
    row = pt("e1", 202611, 80.0, included_default=False)
    assert em(snap([row], [hr("e1")]), "e1", 202611).status == e.PARTIALLY_AVAILABLE


# ------------------------------------------------------------------ employees / scope
def test_missing_hr_match_is_unverified_and_named():
    s = snap([pt("x1", 202611, 40.0)], [])
    m = em(s, "x1", 202611)
    assert m.status == e.UNVERIFIED and m.capacity is None
    assert s.employees["X1"].name == "(Missing HR match)" and not s.employees["X1"].hr_matched
    assert s.data_quality["missing_hr_match_employees"] == 1


def test_project_track_name_wins_over_hr():
    s = snap([pt("e1", 202611, 40.0, name="PT Real Name", grade="C9")], [hr("e1")])
    assert s.employees["E1"].name == "PT Real Name" and s.employees["E1"].grade == "C9"


def test_leaver_out_of_scope_after_resignation():
    leaver = hr("e1", status="FnF Locked", resignation_date=date(2026, 8, 31))
    s = snap([pt("e1", 202611, 0.0), pt("e2", 202611, 80.0)], [leaver, hr("e2")])
    assert ("E1", 202611) not in s.employee_months and ("E2", 202611) in s.employee_months
    assert s.data_quality["rows_outside_employment"] == 1


def test_resignation_date_ignored_for_existing_status():
    s = snap([pt("e1", 202611, 80.0)], [hr("e1", status="Existing", resignation_date=date(2026, 10, 14))])
    assert ("E1", 202611) in s.employee_months


def test_joiner_out_of_scope_before_joining_and_full_capacity_in_joining_month():
    s = snap([pt("e1", 202611, 40.0), pt("e1", 202702, 40.0)], [hr("e1", joining=date(2027, 2, 10))])
    assert ("E1", 202611) not in s.employee_months
    assert em(s, "e1", 202702).capacity == 176.0


def test_invalid_employment_dates_unverified():
    s = snap([pt("e1", 202611, 40.0)], [hr("e1", joining=date(2026, 12, 1), exit_date=date(2026, 6, 1))])
    m = em(s, "e1", 202611)
    assert m.status == e.UNVERIFIED and m.capacity is None


def test_duplicate_hr_code_treated_as_unmatched():
    s = snap([pt("e1", 202611, 40.0)], [hr("e1"), hr("e1")])
    assert not s.employees["E1"].hr_matched


def test_contract_category_precedence_over_all_rows():
    rows = [pt("e1", 202611, 10.0, contract="T&M - Hrs", project="P1"),
            pt("e1", 202611, 0.0, contract="T&M - FTE", project="P2")]
    assert em(snap(rows, [hr("e1")]), "e1", 202611).contract_category == e.FTE_BASED
    rows = [pt("e2", 202611, 10.0, contract="Output - Fixed spread"), ]
    assert em(snap(rows, [hr("e2")]), "e2", 202611).contract_category == e.PROGRAM_BASED
    rows = [pt("e3", 202611, 10.0, contract=None)]
    assert em(snap(rows, [hr("e3")]), "e3", 202611).contract_category == e.NOT_SPECIFIED


def test_rows_outside_window_ignored():
    s = snap([pt("e1", 202610, 80.0), pt("e1", 202806, 80.0)], [hr("e1")])
    assert s.employee_months == {}


# ------------------------------------------------------------------ availability page
def availability_fixture():
    rows = [
        pt("e1", 202611, 80.0), pt("e1", 202612, 100.0),            # P, P (distinct count = 1)
        pt("e2", 202611, 176.0),                                    # C
        pt("e3", 202611, 0.0),                                      # U (placeholder)
        pt("e4", 202611, 10.0, contract="T&M - Hrs", project="P9"),  # P, program
        pt("e5", 202701, 60.0),                                     # month with data, but e5 has no Nov row
    ]
    return snap(rows, [hr(f"e{i}", division="Tech" if i < 4 else "Ops") for i in range(1, 6)])


def test_overview_kpis_are_distinct_counts():
    k = v.availability_overview(availability_fixture(), v.Filters())["kpis"]
    assert k == {"employees_with_records": 5, "fully_available": 0, "partially_available": 3,
                 "fully_committed": 1, "over_allocated": 0, "unverified": 1}


def test_overview_by_month_and_blank_months():
    months = {m["month"]: m for m in v.availability_overview(availability_fixture(), v.Filters())["months"]}
    nov = months[202611]
    assert nov["total"] == 4 and nov["statuses"][e.PARTIALLY_AVAILABLE] == 2 and nov["statuses"][e.UNVERIFIED] == 1
    assert nov["contracts"][e.PROGRAM_BASED] == 1 and nov["contracts"][e.FTE_BASED] == 3
    feb = months[202702]
    assert feb["has_data"] is False and feb["total"] is None and feb["statuses"][e.UNVERIFIED] is None


def test_filters_division_month_and_contract():
    s = availability_fixture()
    assert v.availability_overview(s, v.Filters(divisions={"Ops"}))["kpis"]["employees_with_records"] == 2
    assert v.availability_overview(s, v.Filters(months=[202612]))["kpis"]["employees_with_records"] == 1
    prog = v.availability_overview(s, v.Filters(contract_categories={e.PROGRAM_BASED}))
    assert prog["kpis"]["employees_with_records"] == 1


def test_matrix_cell_states():
    s = availability_fixture()
    m = v.availability_matrix(s, v.Filters(months=[202611, 202612, 202702, 202701]))
    assert [c["key"] for c in m["months"]] == [202611, 202612, 202701, 202702]
    rows = {r["key"]: {c["month"]: c for c in r["cells"]} for r in m["rows"]}
    assert rows["E1"][202611]["letter"] == "P"
    assert rows["E2"][202611]["letter"] == "C"
    assert rows["E3"][202611]["letter"] == "U"
    assert rows["E5"][202611]["state"] == "none"       # data exists for the month, no record
    assert rows["E1"][202702]["state"] == "blank"      # no Project Track data for the month at all
    assert [r["code"] for r in m["rows"]] == sorted(r["code"] for r in m["rows"])


def test_matrix_pagination_and_search():
    s = availability_fixture()
    page = v.availability_matrix(s, v.Filters(), page=2, page_size=2)
    assert page["total"] == 5 and page["pages"] == 3 and len(page["rows"]) == 2
    found = v.availability_matrix(s, v.Filters(search="name e3"))
    assert [r["code"] for r in found["rows"]] == ["e3"]


def test_matrix_lists_whole_employee_dimension():
    """Like Power BI: employees without any Project Track record still appear, with 'no record' cells."""
    rows = [pt("e1", 202611, 80.0)]
    s = snap(rows, [hr("e1"), hr("bench", division="Delivery")])
    m = v.availability_matrix(s, v.Filters(months=[202611, 202612]))
    by_code = {r["code"]: r for r in m["rows"]}
    assert set(by_code) == {"e1", "bench"} and m["total"] == 2
    assert by_code["bench"]["cells"][0]["state"] == "none"       # month has data, employee has no record
    assert by_code["bench"]["cells"][1]["state"] == "blank"      # month has no data at all
    # KPIs still count only employees with records
    assert v.availability_overview(s, v.Filters())["kpis"]["employees_with_records"] == 1
    # a dimension filter keeps the bench employee; a fact-side (contract) filter narrows to employees with records
    assert [r["code"] for r in v.availability_matrix(s, v.Filters(divisions={"Delivery"}))["rows"]] == ["bench"]
    narrowed = v.availability_matrix(s, v.Filters(contract_categories={e.FTE_BASED, e.PROGRAM_BASED, e.NOT_SPECIFIED}))
    assert [r["code"] for r in narrowed["rows"]] == ["e1"]
    assert "Delivery" in v.availability_options(s)["divisions"]
    assert {r["code"] for r in v.employee_search(s, None)} == {"e1", "bench"}


# ------------------------------------------------------------------ employee 360
def test_employee_detail_months_totals_and_allocations():
    rows = [
        pt("e1", 202611, 80.0, project="P1", sub="A"), pt("e1", 202611, 40.0, project="P2", contract="T&M - Hrs"),
        pt("e1", 202612, 80.0, project="P1", contract="T&M - Hrs"),
    ]
    d = v.employee_detail(snap(rows, [hr("e1")]), "e1")
    assert len(d["months"]) == 19
    nov, dec, jan = d["months"][0], d["months"][1], d["months"][2]
    assert (nov["project_count"], nov["planned_hours"], nov["remaining_hours"]) == (2, 120.0, 56.0)
    assert nov["contract_category"] == e.FTE_BASED and dec["contract_category"] == e.PROGRAM_BASED
    assert jan["present"] is False and jan["planned_hours"] is None
    assert d["totals"]["planned_hours"] == 200.0 and d["totals"]["project_count"] == 3
    assert d["totals"]["contract_category"] == e.FTE_BASED
    first = d["allocations"]["rows"][0]
    assert first["label"].startswith("Nov 2026 | P1") and first["planned_hours"] == 80.0
    assert first["children"][0]["sub_project"] == "A"
    assert d["allocations"]["totals"]["planned_hours"] == 200.0
    assert d["profile"]["initials"] == "NE" and v.employee_detail(snap(rows, [hr("e1")]), "nobody") is None


def test_employee_directory_rows_kpis_and_lists():
    rows = [
        pt("over", 202611, 200.0),                       # over capacity now
        pt("busy", 202611, 160.0), pt("busy", 202612, 40.0),  # 16 h free now, 136 h free in Dec
        pt("ph", 202611, 0.0),                           # placeholder -> unverified
    ]
    s = snap(rows, [hr("over"), hr("busy"), hr("ph"), hr("bench")])
    d = v.employee_directory(s)
    k = d["kpis"]
    assert (k["total"], k["over_allocated"], k["unverified"], k["partially_available"], k["no_record"]) == (4, 1, 1, 1, 1)
    by_code = {r["code"]: r for r in d["rows"]}
    assert by_code["bench"]["status"] is None and by_code["bench"]["utilisation"] is None
    assert by_code["busy"]["available_from"]["month"] == 202611
    assert round(by_code["over"]["utilisation"], 3) == round(200 / 176, 3)
    assert [i["code"] for i in d["attention"]["items"]] == ["over", "ph"]
    assert d["attention"]["items"][0]["reason"] == "24 h over capacity"
    assert [i["code"] for i in d["freeing"]["items"]] == ["busy"] and d["freeing"]["items"][0]["hours_freed"] == 120.0


def test_employee_search():
    s = availability_fixture()
    assert [r["code"] for r in v.employee_search(s, "E4")] == ["e4"]
    assert len(v.employee_search(s, None)) == 5


# ------------------------------------------------------------------ projects
def projects_fixture():
    rows = [
        pt("e1", 202611, 80.0, project="P1"), pt("e2", 202611, 0.0, project="P1"),
        pt("e1", 202612, 40.0, project="P1"),
        pt("e3", 202611, 50.0, project="P2", contract="T&M - Hrs"),
        pt(None, 202611, 100.0, project="P3", employee_code=None),
        pt("e1", 202611, 10.0, project="P4", start_date=date(2025, 1, 1), end_date=date(2025, 6, 30)),
    ]
    rows.append(pt("e1", 202701, 5.0, project="P2", contract="T&M - FTE"))
    for r in rows:
        if r["project_id"] == "P3":
            r["employee_key"] = None
            r["project_name"] = "null"
    return snap(rows, [hr("e1"), hr("e2"), hr("e3")])


def test_project_dimension():
    s = projects_fixture()
    assert s.projects["P1"].client_bu == "Client / BU" and s.projects["P1"].contract_category == e.FTE_BASED
    assert s.projects["P2"].contract_category == "Mixed Contracts" and s.projects["P2"].contract_type == "Multiple contract types"
    assert s.projects["P3"].name == e.NOT_AVAILABLE and s.projects["P1"].status == "In Approval"


def test_projects_overview_kpis_visibility_and_coverage():
    s = projects_fixture()
    out = v.projects_overview(s, v.Filters())
    ids = [r["id"] for r in out["rows"]]
    assert "P4" not in ids and set(ids) == {"P1", "P2", "P3"}          # P4 ended before the window
    k = out["kpis"]
    assert k["total_projects"] == 3 and k["projects_with_employees"] == 2
    assert k["employees_assigned"] == 3 and k["active_projects"] == 3  # all dated around today
    p1 = next(r for r in out["rows"] if r["id"] == "P1")
    assert p1["employees"] == 2 and p1["planned_hours"] == 120.0
    assert [r["id"] for r in v.projects_overview(s, v.Filters(), "Without Allocations")["rows"]] == ["P3"]
    assert v.projects_overview(s, v.Filters(), "Without Allocations")["kpis"]["employees_assigned"] == 0
    assert [r["id"] for r in v.projects_overview(s, v.Filters(search="p2"))["rows"]] == ["P2"]
    only_dec = v.projects_overview(s, v.Filters(months=[202612]))
    assert [r["id"] for r in only_dec["rows"] if r["employees"]] == ["P1"]


def test_active_projects_are_date_based():
    row = pt("e1", 202611, 10.0, project="P5", start_date=date(2027, 3, 1), end_date=date(2027, 9, 1))
    out = v.projects_overview(snap([row], [hr("e1")]), v.Filters())
    assert out["kpis"]["total_projects"] == 1 and out["kpis"]["active_projects"] == 0


def test_project_detail_matrix_states():
    s = projects_fixture()
    d = v.project_detail(s, "P1", v.Filters(months=[202611, 202612, 202701]))
    assert d["summary"] == {"employees": 2, "planned_hours": 120.0, "start": "2026-01-01", "end": "2027-12-31"}
    rows = {r["code"]: r for r in d["employees"]}
    assert [c["state"] for c in rows["e1"]["cells"]] == ["hours", "hours", "blank"] and rows["e1"]["total"] == 120.0
    assert [c["state"] for c in rows["e2"]["cells"]] == ["dash", "blank", "blank"] and rows["e2"]["total"] is None
    assert [t["planned_hours"] for t in d["trend"]] == [80.0, 40.0, None]
    assert v.project_detail(s, "nope", v.Filters()) is None


# ------------------------------------------------------------------ demo data invariants
def test_demo_snapshot_invariants():
    s = e.build_snapshot(*build_demo(TODAY), TODAY)
    assert s.employee_months
    for m in s.employee_months.values():
        if m.status == e.UNVERIFIED:
            assert m.planned is None or m.capacity is None
        else:
            assert m.remaining == pytest.approx(m.capacity - m.planned)
        assert m.raw_hours >= (m.verified_hours or 0.0)
    ov = v.availability_overview(s, v.Filters())
    for month in ov["months"]:
        if month["has_data"]:
            assert sum(month["statuses"].values()) == month["total"] == sum(month["contracts"].values())
    assert ov["kpis"]["employees_with_records"] <= len(s.employees)
    assert not any(k in {"E1038", "E1039", "E1040"} for k, _ in s.employee_months)
