"""Business Vertical, tenure (Fresher / Lateral), client tags and account utilization."""

from __future__ import annotations

from datetime import date

import pytest

from app.rv import engine as e
from app.rv import views as v
from tests.test_engine import TODAY, hr, pt, snap


@pytest.mark.parametrize(
    "joining, months, band",
    [
        (date(2026, 11, 5), 0, e.FRESHER),
        (date(2025, 5, 5), 18, e.FRESHER),  # exactly 18 completed months is still Fresher
        (date(2025, 5, 6), 17, e.FRESHER),  # one day short of 18 months
        (date(2025, 4, 30), 18, e.FRESHER),
        (date(2025, 4, 5), 19, e.LATERAL),
        (date(2020, 1, 1), 82, e.LATERAL),
        (None, None, e.TENURE_UNKNOWN),
        (date(2027, 1, 1), None, e.TENURE_UNKNOWN),  # joining in the future
    ],
)
def test_tenure_band_uses_completed_months_since_joining(joining, months, band):
    assert e.tenure_months(joining, TODAY) == months
    assert e.tenure_band(joining, TODAY) == band


def tagged_snapshot():
    rows = [
        pt("e1", 202611, 80, project="P1", parent_account="Acme"),
        pt("e1", 202612, 40, project="P2", parent_account="Globex"),
        pt("e2", 202611, 100, project="P2", parent_account="Globex"),
        pt("e3", 202611, 50, project="P3", parent_account=None, account="Initech"),
        pt("x9", 202611, 40, project="P1", parent_account="Acme"),  # no HR match
    ]
    hrs = [
        hr("e1", joining=date(2026, 1, 10), business_vertical="HLS"),
        hr("e2", joining=date(2019, 3, 1), business_vertical="RCM"),
        hr("e3", joining=date(2021, 6, 1), business_vertical=None),
    ]
    return snap(rows, hrs)


def test_project_client_prefers_parent_account_then_account():
    s = tagged_snapshot()
    assert s.projects["P1"].client == "Acme"
    assert s.projects["P3"].client == "Initech"


def test_options_list_verticals_clients_and_tenure_bands():
    o = v.availability_options(tagged_snapshot())
    assert o["business_verticals"] == ["HLS", "RCM"]
    assert o["clients"] == ["Acme", "Globex", "Initech"]
    assert o["tenures"] == ["Fresher", "Lateral", "Unknown"]


def test_matrix_rows_carry_tags_with_current_month_clients():
    rows = {r["key"]: r for r in v.availability_matrix(tagged_snapshot(), v.Filters())["rows"]}
    assert rows["E1"]["business_vertical"] == "HLS"
    assert rows["E1"]["tenure"] == "Fresher"
    assert rows["E1"]["clients"] == ["Acme"]  # Globex is next month, not current
    assert rows["E2"]["tenure"] == "Lateral"
    assert rows["X9"]["tenure"] == "Unknown"
    assert rows["X9"]["business_vertical"] is None


def test_vertical_tenure_and_client_filters_narrow_people():
    s = tagged_snapshot()

    def keys(**kw):
        return {r["key"] for r in v.availability_matrix(s, v.Filters(**kw))["rows"]}

    assert keys(business_verticals={"HLS"}) == {"E1"}
    assert keys(tenures={"Lateral"}) == {"E2", "E3"}
    assert keys(tenures={"Unknown"}) == {"X9"}
    # Client filter matches anyone with the client anywhere in the window.
    assert keys(clients={"Globex"}) == {"E1", "E2"}
    k = v.availability_overview(s, v.Filters(business_verticals={"RCM"}))["kpis"]
    assert k["total_employees"] == 1 and k["employee_months"]["total"] == 1


def test_employee_detail_profile_has_tenure_and_clients():
    p = v.employee_detail(tagged_snapshot(), "e1")["profile"]
    assert p["business_vertical"] == "HLS"
    assert p["tenure"] == "Fresher"
    assert p["tenure_months"] == 9
    assert p["current_clients"] == ["Acme"]


def test_account_utilization_sums_verified_hours_per_client():
    out = v.account_utilization(tagged_snapshot(), v.Filters())
    by = {r["client"]: r for r in out["rows"]}
    assert by["Globex"]["planned_hours"] == 140 and by["Globex"]["employees"] == 2
    # x9 has no HR match so its month is Unverified, but its row is still a valid 40 h row.
    assert by["Acme"]["planned_hours"] == 120 and by["Acme"]["employees"] == 2
    assert out["rows"][0]["client"] == "Globex"  # sorted by planned hours
    assert out["totals"]["planned_hours"] == 310
    assert abs(sum(r["share"] for r in out["rows"]) - 1) < 1e-9


def test_account_utilization_respects_filters_and_months():
    s = tagged_snapshot()
    only_nov = v.account_utilization(s, v.Filters(months=[202611]))
    assert {r["client"]: r["planned_hours"] for r in only_nov["rows"]}["Globex"] == 100
    hls = v.account_utilization(s, v.Filters(business_verticals={"HLS"}))
    assert {r["client"] for r in hls["rows"]} == {"Acme", "Globex"}
    assert hls["totals"]["employees"] == 1
    one = v.account_utilization(s, v.Filters(clients={"Initech"}))
    assert [r["client"] for r in one["rows"]] == ["Initech"]
