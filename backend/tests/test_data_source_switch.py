"""Runtime data source switch and DBTEZ environment loading. Synthetic data only."""

from __future__ import annotations

import tempfile
from datetime import date
from pathlib import Path
from pathlib import Path

import pytest
from fastapi import Response

from app.dbtez import ConfigError, DbtezError, ProjectTrackFields
from app.dbtez.config import DbtezConfig
from app.dbtez.env import dbtez_environment, is_configured
from app.dbtez.project_track import map_project_track_rows
from app.rv import engine as e
from app.rv import service
from app.rv.demo_data import build_demo
from tests.dbtez_fakes import pt_record

TODAY = date(2026, 11, 20)


def demo_snapshot() -> e.Snapshot:
    pt, hr = build_demo(TODAY)
    return e.build_snapshot(pt, hr, TODAY, 176.0)


@pytest.fixture(autouse=True)
def clean_service(monkeypatch):
    monkeypatch.setenv("RV_DATA_SOURCE", "azure")
    monkeypatch.setenv("RV_ALLOWED_SOURCES", "azure,dbtez")
    monkeypatch.setattr(service, "_state", {"snapshot": None, "version": None, "checked": 0.0, "day": None, "meta": {}})
    monkeypatch.setattr(service, "_override", {"source": None})
    monkeypatch.setattr(service, "date", type("D", (), {"today": staticmethod(lambda: TODAY)}), raising=False)
    azure_snapshot = demo_snapshot()
    monkeypatch.setattr(service, "load_snapshot_from_facts", lambda: (azure_snapshot, {
        "Version": 7, "RefreshedUtc": None,
    }))
    return azure_snapshot


def test_switch_to_dbtez_loads_it_and_switch_back_restores_azure(monkeypatch, clean_service):
    api_snapshot = demo_snapshot()
    monkeypatch.setattr(service, "dbtez_configured", lambda: True)
    monkeypatch.setattr(service, "_load_dbtez", lambda today: (api_snapshot, {"project_track_rows": 5}))

    service.set_data_source("dbtez")
    assert service.data_source() == "dbtez"
    assert service._state["snapshot"] is api_snapshot
    assert service.data_info()["load_summary"] == {"project_track_rows": 5}

    service.set_data_source("azure")
    assert service.data_source() == "azure"
    assert service._state["snapshot"] is clean_service


def test_unconfigured_dbtez_cannot_be_selected(monkeypatch):
    monkeypatch.setattr(service, "dbtez_configured", lambda: False)
    with pytest.raises(service.SourceSwitchError):
        service.set_data_source("dbtez")
    assert service.data_source() == "azure"
    options = {o["id"]: o["available"] for o in service.source_options()["options"]}
    assert options == {"azure": True, "dbtez": False}


def test_failed_switch_keeps_the_previous_source_and_data(monkeypatch, clean_service):
    service.set_data_source("azure")
    before = service._state["snapshot"]
    monkeypatch.setattr(service, "dbtez_configured", lambda: True)

    def broken(today):
        raise DbtezError("synthetic failure")

    monkeypatch.setattr(service, "_load_dbtez", broken)
    with pytest.raises(service.SourceSwitchError) as err:
        service.set_data_source("dbtez")
    assert "DbtezError: synthetic failure" in str(err.value)  # safe, redacted reason shown to the operator
    assert service.data_source() == "azure"
    assert service._state["snapshot"] is before


@pytest.mark.parametrize("name", ["demo", "azure_raw", "", "DROP", "dbtez; x"])
def test_only_known_sources_can_be_selected(name):
    with pytest.raises(service.SourceSwitchError):
        service.set_data_source(name)


def test_route_switches_and_reports_meta(monkeypatch):
    from app.rv import routes

    api_snapshot = demo_snapshot()
    monkeypatch.setattr(service, "dbtez_configured", lambda: True)
    monkeypatch.setattr(service, "_load_dbtez", lambda today: (api_snapshot, {"project_track_rows": 1}))
    started = routes.change_data_source(routes.DataSourceChange(source="DBTEZ"))
    assert started["status"] == "loading" and started["target"] == "dbtez"
    service._switch["thread"].join(timeout=10)
    done = routes.data_source_status(Response())
    assert done["status"] == "idle" and done["current"] == "dbtez"

    monkeypatch.setattr(service, "dbtez_configured", lambda: False)
    with pytest.raises(Exception) as err:
        routes.change_data_source(routes.DataSourceChange(source="dbtez"))
    assert getattr(err.value, "status_code", None) == 409


# ----------------------------------------------------------------------------- env loading
@pytest.fixture
def tmp_path():
    # pytest's own tmp_path needs the system temp folder; a folder beside the tests always works.
    with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as folder:
        yield Path(folder)


def test_environment_reads_only_dbtez_keys_and_environment_wins(tmp_path):
    env_file = tmp_path / "x.env"
    env_file.write_text("AZURE_SQL_PASSWORD=SYNTHETIC-DB\nDBTEZ_BASE_URL=https://file.invalid\nDBTEZ_CLIENT_ID=file-id\n")
    values = dbtez_environment(env_file, environ={"DBTEZ_CLIENT_ID": "process-id", "OTHER": "x"})
    assert values == {"DBTEZ_BASE_URL": "https://file.invalid", "DBTEZ_CLIENT_ID": "process-id"}


def test_is_configured_needs_credentials_and_both_objects():
    base = {"DBTEZ_BASE_URL": "https://x.invalid", "DBTEZ_CLIENT_ID": "a", "DBTEZ_CLIENT_SECRET": "b"}
    assert not is_configured(base)
    assert not is_configured({**base, "DBTEZ_PROJECT_TRACK_OBJECT": "pt"})
    assert is_configured({**base, "DBTEZ_PROJECT_TRACK_OBJECT": "pt", "DBTEZ_ZINGHR_OBJECT": "hr"})
    assert not is_configured({})


def test_missing_environment_file_means_not_configured(tmp_path):
    assert dbtez_environment(tmp_path / "missing.env", environ={}) == {}


# ----------------------------------------------------------------------------- override decision
def test_no_override_is_the_env_default_but_not_the_code_default():
    env = {"DBTEZ_BASE_URL": "https://x.invalid", "DBTEZ_CLIENT_ID": "a", "DBTEZ_CLIENT_SECRET": "b"}
    assert DbtezConfig.from_env(env).pt_fields.assume_no_override is True
    assert DbtezConfig.from_env({**env, "DBTEZ_PT_ASSUME_NO_OVERRIDE": "false"}).pt_fields.assume_no_override is False
    assert ProjectTrackFields().assume_no_override is False
    with pytest.raises(ConfigError):
        DbtezConfig.from_env({**env, "DBTEZ_PT_ASSUME_NO_OVERRIDE": "maybe"})


def test_assumed_no_override_lets_rows_resolve_in_the_engine():
    fields = ProjectTrackFields(assume_no_override=True)
    rows, report = map_project_track_rows([pt_record("E1", 2026, 11, effort=40)], fields)
    assert rows[0]["is_override"] is False
    assert e.classify_rows(rows)[0].status == e.VALID
    assert any("not an override" in w for w in report.warnings)


def test_a_configured_override_column_beats_the_assumption():
    fields = ProjectTrackFields(is_override="Is Override", assume_no_override=True)
    rows, _ = map_project_track_rows([pt_record("E1", 2026, 11, **{"Is Override": True})], fields)
    assert rows[0]["is_override"] is True


def test_unexpected_crash_also_restores_the_previous_source(monkeypatch, clean_service):
    service.set_data_source("azure")
    monkeypatch.setattr(service, "dbtez_configured", lambda: True)

    def crash(today):
        raise KeyError("SYNTHETIC-VALUE")

    monkeypatch.setattr(service, "_load_dbtez", crash)
    with pytest.raises(service.SourceSwitchError) as err:
        service.set_data_source("dbtez")
    assert "KeyError" in str(err.value) and "SYNTHETIC-VALUE" not in str(err.value)
    assert service.data_source() == "azure"


def test_background_switch_reports_failure_and_never_sticks_on_loading(monkeypatch):
    monkeypatch.setattr(service, "_switch", {"status": "idle", "target": None, "error": None, "thread": None})
    monkeypatch.setattr(service, "dbtez_configured", lambda: True)

    def broken(today):
        raise DbtezError("synthetic failure")

    monkeypatch.setattr(service, "_load_dbtez", broken)
    service.start_switch("dbtez")
    service._switch["thread"].join(timeout=10)
    status = service.switch_status()
    assert status["status"] == "failed" and "DbtezError: synthetic failure" in status["error"]
    assert service.data_source() == "azure"


def test_live_source_does_not_change_until_the_new_one_has_loaded(monkeypatch, clean_service):
    import threading

    gate = threading.Event()
    monkeypatch.setattr(service, "_switch", {"status": "idle", "target": None, "error": None, "thread": None})
    monkeypatch.setattr(service, "dbtez_configured", lambda: True)
    api_snapshot = demo_snapshot()

    def slow(today):
        gate.wait(10)
        return api_snapshot, {}

    monkeypatch.setattr(service, "_load_dbtez", slow)
    service.start_switch("dbtez")
    assert service.data_source() == "azure"  # still serving the old source while loading
    with pytest.raises(service.SourceSwitchError):
        service.start_switch("azure")  # one change at a time
    gate.set()
    service._switch["thread"].join(timeout=10)
    assert service.data_source() == "dbtez"


def test_meta_route_builds_with_the_switch_fields(clean_service):
    from app.rv import routes

    meta = routes.meta()
    assert meta["capacity_hours"] == service.capacity_hours() == 176.0
    assert meta["sources"]["current"] == "azure" and meta["sources"]["switch"]["status"] in ("idle", "failed", "loading")


def test_dbtez_is_the_default_and_only_source(monkeypatch):
    monkeypatch.delenv("RV_DATA_SOURCE", raising=False)
    monkeypatch.delenv("RV_ALLOWED_SOURCES", raising=False)
    assert service.data_source() == "dbtez" and service.allowed_sources() == ["dbtez"]
    assert [o["id"] for o in service.source_options()["options"]] == ["dbtez"]
    with pytest.raises(service.SourceSwitchError):
        service.set_data_source("azure")  # not allowed while DBTEZ is the only source
    monkeypatch.setenv("RV_ALLOWED_SOURCES", "azure,dbtez")
    assert [o["id"] for o in service.source_options()["options"]] == ["azure", "dbtez"]


def test_first_load_failure_gives_a_safe_reason_and_fails_fast_afterwards(monkeypatch):
    monkeypatch.setenv("RV_DATA_SOURCE", "dbtez")
    monkeypatch.setattr(service, "_failure", {"at": 0.0, "message": None})
    calls = {"n": 0}

    def broken(today):
        calls["n"] += 1
        raise DbtezError("The server did not answer in time (read timeout) during the token request")

    monkeypatch.setattr(service, "_load_dbtez", broken)
    with pytest.raises(service.DataSourceUnavailable) as first:
        service.get_snapshot()
    assert "read timeout" in str(first.value) and "token" not in str(first.value).replace("token request", "")
    with pytest.raises(service.DataSourceUnavailable):
        service.get_snapshot()
    assert calls["n"] == 1  # the second request did not retry the slow load


def test_workstream_name_is_the_default_sub_project_and_can_be_turned_off():
    env = {"DBTEZ_BASE_URL": "https://x.invalid", "DBTEZ_CLIENT_ID": "a", "DBTEZ_CLIENT_SECRET": "b"}
    assert DbtezConfig.from_env(env).pt_fields.sub_project == "Workstream Name"
    assert DbtezConfig.from_env({**env, "DBTEZ_PT_SUBPROJECT_COLUMN": "none"}).pt_fields.sub_project is None
    assert DbtezConfig.from_env({**env, "DBTEZ_PT_SUBPROJECT_COLUMN": "Other"}).pt_fields.sub_project == "Other"


def test_rows_in_different_workstreams_are_not_duplicates_but_the_same_workstream_is():
    fields = ProjectTrackFields(sub_project="Workstream Name", assume_no_override=True)
    same_project = [
        pt_record("E1", 2026, 11, effort=40, **{"Workstream Name": "Build"}),
        pt_record("E1", 2026, 11, effort=40, **{"Workstream Name": "Run"}),
    ]
    rows, _ = map_project_track_rows(same_project, fields)
    assert [r.status for r in e.classify_rows(rows)] == [e.VALID, e.VALID]

    clash = [pt_record("E1", 2026, 11, effort=40, **{"Workstream Name": "Build"})] * 2
    rows, _ = map_project_track_rows(clash, fields)
    assert all(r.status == e.UNRESOLVED for r in e.classify_rows(rows))

    no_workstream, _ = map_project_track_rows(same_project, ProjectTrackFields(assume_no_override=True))
    assert all(r.status == e.UNRESOLVED for r in e.classify_rows(no_workstream))  # why the default matters


# ----------------------------------------------------------------------------- estimated availability
def _snapshot_with_gaps():
    from tests.dbtez_fakes import hr_record
    from app.dbtez.normalize import parse_date

    key = e.build_window(TODAY)[0]
    fields = ProjectTrackFields(sub_project="Workstream Name", assume_no_override=True)
    records = [
        pt_record("HRLESS", key // 100, key % 100, effort=60, **{"Workstream Name": "A"}),
        pt_record("DUPE", key // 100, key % 100, effort=40, **{"Workstream Name": "A"}),
        pt_record("DUPE", key // 100, key % 100, effort=40, **{"Workstream Name": "A"}),
        pt_record("OVER", key // 100, key % 100, effort=200, **{"Workstream Name": "A"}),
        pt_record("OVER", key // 100, key % 100, effort=-5, **{"Workstream Name": "B"}),
        pt_record("GOOD", key // 100, key % 100, effort=80, **{"Workstream Name": "A"}),
    ]
    rows, _ = map_project_track_rows(records, fields)
    hr = [
        {"employee_key": c, "employee_code": c, "employee_name": c, "joining_date": parse_date("2020-01-01"),
         "exit_date": None, "leaving_date": None, "resignation_date": None, "employee_status": "Existing"}
        for c in ("DUPE", "OVER", "GOOD")
    ]
    return e.build_snapshot(rows, hr, TODAY, 176.0), key


def test_engine_alone_leaves_these_people_unverified():
    snap, key = _snapshot_with_gaps()
    statuses = {k: snap.employee_months[(k, key)].status for k in ("HRLESS", "DUPE", "OVER", "GOOD")}
    assert statuses["HRLESS"] == e.UNVERIFIED and statuses["DUPE"] == e.UNVERIFIED
    assert statuses["OVER"] == e.UNVERIFIED and statuses["GOOD"] == e.PARTIALLY_AVAILABLE


def test_estimation_gives_everyone_an_availability_and_says_so():
    from app.rv.estimate import estimate_unverified

    snap, key = _snapshot_with_gaps()
    count = estimate_unverified(snap, 176.0)
    months = {k: snap.employee_months[(k, key)] for k in ("HRLESS", "DUPE", "OVER", "GOOD")}
    assert count == 3
    assert all(m.status != e.UNVERIFIED for m in months.values())
    assert months["HRLESS"].capacity == 176.0 and months["HRLESS"].planned == 60.0 and months["HRLESS"].remaining == 116.0
    assert months["HRLESS"].status == e.PARTIALLY_AVAILABLE and "no HR match" in months["HRLESS"].status_reason
    assert months["DUPE"].planned == 80.0 and "needing review" in months["DUPE"].status_reason
    assert months["OVER"].status == e.OVER_ALLOCATED and months["OVER"].remaining < 0
    assert months["GOOD"].status_reason == "Capacity and allocation resolved"  # verified months untouched
    assert months["GOOD"].planned == 80.0


def test_estimation_can_be_turned_off(monkeypatch):
    from app.rv import estimate

    monkeypatch.setenv("RV_ESTIMATE_UNVERIFIED", "false")
    assert estimate.enabled() is False
    monkeypatch.delenv("RV_ESTIMATE_UNVERIFIED")
    assert estimate.enabled() is True
