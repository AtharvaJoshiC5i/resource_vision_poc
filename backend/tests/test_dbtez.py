"""Synthetic tests for the DBTEZ integration. No network, no credentials, no real records."""

from __future__ import annotations

import json
import logging
import pickle
from datetime import date

import pytest

from app.dbtez import (
    ApiError,
    AuthError,
    ConfigError,
    DbtezClient,
    DbtezConfig,
    DbtezDataSource,
    IncompleteResultError,
    ProjectTrackFields,
    RateLimitError,
    ResponseValidationError,
    SchemaError,
    TransportError,
)
from app.dbtez.config import Secret
from app.dbtez.discovery import discover, parse_schema
from app.dbtez.normalize import clean_employee_code, parse_date
from app.dbtez.project_track import fetch_month, map_project_track_rows
from app.dbtez.ratelimit import SlidingWindowLimiter
from app.dbtez.transport import _NoRedirect
from app.dbtez.zinghr import fetch_employees, map_zinghr_rows
from app.rv import engine as e
from tests.dbtez_fakes import (
    HR_OBJECT,
    PT_OBJECT,
    SENTINEL_CLIENT_ID,
    SENTINEL_CLIENT_SECRET,
    FakeClock,
    FakeDbtez,
    hr_record,
    make_config,
    pt_record,
)

FIELDS = ProjectTrackFields()
PT_COLUMNS = FIELDS.requested_columns()
HR_COLUMNS = list(hr_record("X").keys())


def make_client(fake: FakeDbtez, clock: FakeClock | None = None, **cfg) -> DbtezClient:
    clock = clock or FakeClock()
    return DbtezClient(make_config(**cfg), fake, clock=clock.time, sleep=clock.sleep, jitter=lambda: 0.5)


def seeded_fake(pt_rows=None, hr_rows=None) -> FakeDbtez:
    fake = FakeDbtez()
    fake.add_object(PT_OBJECT, PT_COLUMNS, pt_rows or [])
    fake.add_object(HR_OBJECT, HR_COLUMNS, hr_rows or [], key=["EmployeeCode"])
    return fake


# ----------------------------------------------------------------------------- configuration
def test_config_from_env_reports_only_variable_names():
    with pytest.raises(ConfigError) as err:
        DbtezConfig.from_env({"DBTEZ_BASE_URL": "https://x.invalid"})
    assert "DBTEZ_CLIENT_ID" in str(err.value) and "DBTEZ_CLIENT_SECRET" in str(err.value)


def test_config_never_exposes_secrets():
    cfg = make_config()
    for text in (repr(cfg), str(cfg), f"{cfg.client_secret}", repr(cfg.client_id)):
        assert SENTINEL_CLIENT_SECRET not in text and SENTINEL_CLIENT_ID not in text
    with pytest.raises(TypeError):
        pickle.dumps(cfg.client_secret)


@pytest.mark.parametrize(
    "url",
    ["http://remote.invalid", "https://user:pw@x.invalid", "https://x.invalid/?a=1", "not a url", "ftp://x.invalid"],
)
def test_config_rejects_unsafe_base_urls(url):
    env = {"DBTEZ_BASE_URL": url, "DBTEZ_CLIENT_ID": "a", "DBTEZ_CLIENT_SECRET": "b"}
    with pytest.raises(ConfigError):
        DbtezConfig.from_env(env)


def test_config_allows_http_only_for_localhost_and_validates_limits():
    env = {"DBTEZ_BASE_URL": "http://localhost:9000/", "DBTEZ_CLIENT_ID": "a", "DBTEZ_CLIENT_SECRET": "b"}
    assert DbtezConfig.from_env(env).base_url == "http://localhost:9000"
    for var, value in (("DBTEZ_PAGE_SIZE", "5001"), ("DBTEZ_DATA_CALLS_PER_MINUTE", "121"), ("DBTEZ_MAX_RETRIES", "x")):
        with pytest.raises(ConfigError):
            DbtezConfig.from_env({**env, var: value})


def test_object_names_are_required_lazily_and_validated():
    env = {"DBTEZ_BASE_URL": "https://x.invalid", "DBTEZ_CLIENT_ID": "a", "DBTEZ_CLIENT_SECRET": "b"}
    cfg = DbtezConfig.from_env(env)
    with pytest.raises(ConfigError):
        cfg.require_zinghr_object()
    with pytest.raises(ConfigError):
        DbtezConfig.from_env({**env, "DBTEZ_ZINGHR_OBJECT": "bad/name;drop"})


def test_optional_project_track_columns_come_only_from_env():
    env = {
        "DBTEZ_BASE_URL": "https://x.invalid",
        "DBTEZ_CLIENT_ID": "a",
        "DBTEZ_CLIENT_SECRET": "b",
        "DBTEZ_PT_OVERRIDE_COLUMN": "Is Override",
    }
    assert DbtezConfig.from_env(env).pt_fields.is_override == "Is Override"
    assert FIELDS.is_override is None
    with pytest.raises(ConfigError):
        DbtezConfig.from_env({**env, "DBTEZ_PT_OVERRIDE_COLUMN": "x'] OR 1=1 --"})


# ----------------------------------------------------------------------------- authentication
def test_authenticates_with_client_credentials_and_sends_bearer():
    fake = seeded_fake()
    client = make_client(fake)
    assert client.me() == {"client": "synthetic"}
    token_call = fake.token_requests()[0]
    assert token_call["method"] == "POST"
    assert json.loads(token_call["body"]) == {"client_id": SENTINEL_CLIENT_ID, "client_secret": SENTINEL_CLIENT_SECRET}
    assert fake.data_requests()[0]["headers"]["Authorization"] == "Bearer synthetic-token-1"


def test_token_is_reused_across_calls():
    fake = seeded_fake()
    client = make_client(fake)
    client.me()
    client.me()
    assert len(fake.token_requests()) == 1


def test_401_refreshes_token_once_and_retries():
    fake = seeded_fake()
    client = make_client(fake)
    client.me()
    fake.expire_all_tokens()
    assert client.me() == {"client": "synthetic"}
    assert len(fake.token_requests()) == 2
    assert fake.data_requests()[-1]["headers"]["Authorization"] == "Bearer synthetic-token-2"


def test_persistent_401_raises_instead_of_looping():
    fake = seeded_fake()
    client = make_client(fake)
    client.me()
    for _ in range(3):
        fake.fail_next("/v1/me", 401)
    with pytest.raises(AuthError):
        client.me()
    assert len(fake.token_requests()) <= 2


def test_rejected_credentials_raise_auth_error():
    fake = seeded_fake()
    fake.reject_credentials = True
    with pytest.raises(AuthError):
        make_client(fake).me()


def test_token_refreshes_after_idle_and_max_age():
    fake = seeded_fake()
    clock = FakeClock()
    client = make_client(fake, clock)
    client.me()
    clock.now += 56 * 60  # idle beyond 55 minutes
    client.me()
    assert len(fake.token_requests()) == 2
    for _ in range(9):  # stay active, but cross the 8 hour age limit
        clock.now += 54 * 60
        client.me()
    assert len(fake.token_requests()) >= 3


def test_token_response_without_token_is_rejected():
    fake = seeded_fake()
    original = fake.send

    def send(method, url, headers, body, timeout):
        if url.endswith("/auth/token/client"):
            return fake._json(200, {"unexpected": "shape"})
        return original(method, url, headers, body, timeout)

    fake.send = send
    with pytest.raises(ResponseValidationError):
        make_client(fake).me()


def test_no_secret_or_token_appears_in_logs_or_errors(caplog):
    caplog.set_level(logging.DEBUG, logger="rv.dbtez")
    fake = seeded_fake()
    client = make_client(fake)
    client.me()
    fake.expire_all_tokens()
    client.me()
    fake.fail_next("/v1/me", 500)
    fake.fail_next("/v1/me", 429, {"Retry-After": "1"})
    client.me()
    fake.reject_credentials = True
    fake.expire_all_tokens()
    with pytest.raises(AuthError) as err:
        client.me()
    haystack = caplog.text + str(err.value) + repr(client.__dict__)
    for forbidden in (SENTINEL_CLIENT_ID, SENTINEL_CLIENT_SECRET, "synthetic-token-"):
        assert forbidden not in haystack


# ----------------------------------------------------------------------------- retries and limits
def test_429_honours_retry_after_then_succeeds():
    fake = seeded_fake()
    clock = FakeClock()
    client = make_client(fake, clock)
    fake.fail_next("/v1/me", 429, {"Retry-After": "7"})
    assert client.me() == {"client": "synthetic"}
    assert 7.0 in clock.sleeps


def test_retry_after_is_capped():
    fake = seeded_fake()
    clock = FakeClock()
    client = make_client(fake, clock)
    fake.fail_next("/v1/me", 429, {"Retry-After": "99999"})
    client.me()
    assert max(clock.sleeps) <= 60.0


def test_retries_are_bounded():
    fake = seeded_fake()
    client = make_client(fake, max_retries=2)
    for _ in range(10):
        fake.fail_next("/v1/me", 429)
    with pytest.raises(RateLimitError):
        client.me()
    assert len([r for r in fake.data_requests() if r["path"] == "/v1/me"]) == 3

    fake2 = seeded_fake()
    client2 = make_client(fake2, max_retries=1)
    for _ in range(10):
        fake2.fail_next("/v1/me", 503)
    with pytest.raises(ApiError):
        client2.me()


def test_transport_errors_are_retried_then_raised():
    fake = seeded_fake()
    calls = {"n": 0}
    original = fake.send

    def flaky(method, url, headers, body, timeout):
        if url.endswith("/v1/me"):
            calls["n"] += 1
            raise TransportError("Network error (TimeoutError)")
        return original(method, url, headers, body, timeout)

    fake.send = flaky
    with pytest.raises(TransportError):
        make_client(fake, max_retries=2).me()
    assert calls["n"] == 3


def test_client_errors_are_not_retried():
    fake = seeded_fake()
    fake.fail_next("/v1/me", 400)
    with pytest.raises(ApiError):
        make_client(fake).me()
    assert len([r for r in fake.data_requests() if r["path"] == "/v1/me"]) == 1


def test_sliding_window_limiter_blocks_until_a_slot_frees():
    clock = FakeClock()
    limiter = SlidingWindowLimiter(3, 60.0, clock=clock.time, sleep=clock.sleep)
    for _ in range(3):
        limiter.acquire()
    assert clock.sleeps == []
    limiter.acquire()
    assert sum(clock.sleeps) >= 59.9


def test_client_stays_under_the_documented_call_budget():
    fake = seeded_fake()
    clock = FakeClock()
    client = make_client(fake, clock, data_calls_per_minute=5)
    start = clock.now
    for _ in range(11):
        client.me()
    assert clock.now - start >= 60.0  # 11 calls at 5 per minute cannot finish inside one window


def test_only_reads_are_possible():
    client = make_client(seeded_fake())
    with pytest.raises(ValueError):
        client._call("POST", "/v1/objects/x")
    with pytest.raises(ValueError):
        client._call("DELETE", "/v1/objects/x")


def test_redirects_are_refused():
    assert _NoRedirect().redirect_request(None, None, 302, "Found", {}, "https://elsewhere.invalid") is None


# ----------------------------------------------------------------------------- response validation
@pytest.mark.parametrize(
    "payload",
    [
        {"data": "x", "row_count": 0, "next_cursor": None, "truncated": False},
        {"data": [], "row_count": "0", "next_cursor": None, "truncated": False},
        {"data": [{"a": 1}], "row_count": 2, "next_cursor": None, "truncated": False},
        {"data": [], "row_count": 0, "next_cursor": None},
        {"data": [], "row_count": 0, "next_cursor": 5, "truncated": False},
        {"data": [1], "row_count": 1, "next_cursor": None, "truncated": False},
    ],
)
def test_malformed_query_responses_are_rejected(payload):
    fake = seeded_fake()
    original = fake.send

    def send(method, url, headers, body, timeout):
        if url.endswith("/query"):
            return fake._json(200, payload)
        return original(method, url, headers, body, timeout)

    fake.send = send
    with pytest.raises(ResponseValidationError):
        make_client(fake).query(PT_OBJECT, columns=["a"])


def test_non_json_response_is_rejected_without_echoing_it():
    fake = seeded_fake()
    original = fake.send
    marker = "SYNTHETIC-BODY-MARKER"

    def send(method, url, headers, body, timeout):
        if url.endswith("/v1/me"):
            from app.dbtez.transport import HttpResponse

            return HttpResponse(200, {}, marker.encode())
        return original(method, url, headers, body, timeout)

    fake.send = send
    with pytest.raises(ResponseValidationError) as err:
        make_client(fake).me()
    assert marker not in str(err.value)


def test_query_limit_is_bounded():
    client = make_client(seeded_fake())
    with pytest.raises(ValueError):
        client.query(PT_OBJECT, columns=["a"], limit=5001)
    with pytest.raises(ValueError):
        client.query(PT_OBJECT, columns=[])


# ----------------------------------------------------------------------------- discovery
def test_discovery_reads_columns_and_declared_key():
    client = make_client(seeded_fake())
    schema = discover(client, HR_OBJECT)
    assert "EmployeeCode" in schema.columns
    assert schema.key_columns == ("EmployeeCode",)
    assert discover(client, PT_OBJECT).key_columns == ()


def test_missing_required_fields_raise_schema_error():
    schema = parse_schema("o", {"columns": ["Year"]})
    with pytest.raises(SchemaError) as err:
        schema.require(["Year", "Effort"])
    assert "Effort" in str(err.value)


def test_unrecognised_schema_shape_reports_only_key_names():
    with pytest.raises(SchemaError) as err:
        parse_schema("o", {"weird": "SYNTHETIC-VALUE"})
    assert "SYNTHETIC-VALUE" not in str(err.value) and "weird" in str(err.value)


# ----------------------------------------------------------------------------- Project Track
def _month_rows(year, month, count, code_for=lambda i: f"E{i:04d}"):
    return [pt_record(code_for(i), year, month, effort=8) for i in range(count)]


def test_month_that_fits_is_fetched_in_one_call():
    fake = seeded_fake(_month_rows(2026, 11, 20) + _month_rows(2026, 12, 5))
    client = make_client(fake, page_size=50)
    result = fetch_month(client, PT_OBJECT, 2026, 11, FIELDS)
    assert len(result.rows) == 20 and result.calls == 1 and result.partitions == 0
    assert "Year = 2026 AND [Month Number] = 11" in json.loads(fake.data_requests()[0]["body"])["where"]


def test_truncated_month_is_partitioned_and_complete():
    rows = _month_rows(2026, 11, 130) + _month_rows(2026, 12, 7)
    rows += [pt_record(None, 2026, 11), pt_record("", 2026, 11), pt_record("-odd", 2026, 11), pt_record("lower1", 2026, 11)]
    fake = seeded_fake(rows)
    client = make_client(fake, page_size=40)
    result = fetch_month(client, PT_OBJECT, 2026, 11, FIELDS)
    assert len(result.rows) == 134
    assert result.partitions > 0
    assert all(r["Month Number"] == 11 for r in result.rows)


def test_deep_partitioning_handles_shared_prefixes():
    rows = [pt_record(f"AB{i:03d}", 2026, 11) for i in range(120)]  # all share prefix 'AB'
    client = make_client(seeded_fake(rows), page_size=30)
    assert len(fetch_month(client, PT_OBJECT, 2026, 11, FIELDS).rows) == 120


def test_duplicate_rows_are_preserved_not_deduplicated():
    rows = [pt_record("E0001", 2026, 11, effort=8)] * 3
    client = make_client(seeded_fake(rows), page_size=50)
    assert len(fetch_month(client, PT_OBJECT, 2026, 11, FIELDS).rows) == 3


def test_unsplittable_truncation_raises_instead_of_returning_partial_data():
    rows = [pt_record("E0001", 2026, 11) for _ in range(120)]  # identical code: cannot be split
    client = make_client(seeded_fake(rows), page_size=30)
    with pytest.raises(IncompleteResultError):
        fetch_month(client, PT_OBJECT, 2026, 11, FIELDS)


def test_full_page_without_truncated_flag_is_still_treated_as_incomplete():
    rows = _month_rows(2026, 11, 40)
    fake = seeded_fake(rows)
    original = fake._query

    def lying(obj, request):
        response = original(obj, request)
        payload = json.loads(response.body)
        payload["truncated"] = False  # the API forgets to flag it
        return fake._json(200, payload)

    fake._query = lying
    client = make_client(fake, page_size=40)  # exactly a full page, then partitions of < 40 each
    result = fetch_month(client, PT_OBJECT, 2026, 11, FIELDS)
    assert len(result.rows) == 40 and result.partitions > 0


def test_server_ignoring_the_month_filter_is_detected():
    fake = seeded_fake(_month_rows(2026, 12, 5))
    fake.ignore_where = True
    with pytest.raises(ResponseValidationError):
        fetch_month(make_client(fake), PT_OBJECT, 2026, 11, FIELDS)


def test_unexpected_cursor_on_unkeyed_object_is_rejected():
    fake = seeded_fake(_month_rows(2026, 11, 3))
    original = fake._query

    def with_cursor(obj, request):
        payload = json.loads(original(obj, request).body)
        payload["next_cursor"] = "abc"
        return fake._json(200, payload)

    fake._query = with_cursor
    with pytest.raises(ResponseValidationError):
        fetch_month(make_client(fake), PT_OBJECT, 2026, 11, FIELDS)


def test_call_budget_stops_runaway_partitioning():
    rows = _month_rows(2026, 11, 200)
    with pytest.raises(IncompleteResultError):
        fetch_month(make_client(seeded_fake(rows), page_size=10), PT_OBJECT, 2026, 11, FIELDS, max_calls=5)


def test_partitioning_uses_few_calls():
    fake = seeded_fake(_month_rows(2026, 11, 400))
    result = fetch_month(make_client(fake, page_size=100), PT_OBJECT, 2026, 11, FIELDS)
    assert len(result.rows) == 400
    assert result.calls <= 20  # tens at worst (sorted input is the worst case), not hundreds


def test_where_clause_uses_only_integers_and_a_safe_alphabet():
    fake = seeded_fake(_month_rows(2026, 11, 100))
    fetch_month(make_client(fake, page_size=30), PT_OBJECT, 2026, 11, FIELDS)
    for request in fake.data_requests():
        where = json.loads(request["body"]).get("where", "")
        assert ";" not in where and "--" not in where and '"' not in where


def test_mapping_handles_missing_and_invalid_employee_identifiers():
    records = [
        pt_record("syn-001", 2026, 11),
        pt_record(None, 2026, 11),
        pt_record("   ", 2026, 11),
        pt_record("null", 2026, 11),
        pt_record({"x": 1}, 2026, 11),
        pt_record("A" * 500, 2026, 11),
        pt_record("bad\x00code", 2026, 11),
    ]
    rows, report = map_project_track_rows(records, FIELDS)
    assert rows[0]["employee_key"] == "SYN-001" and rows[0]["employee_code"] == "syn-001"
    assert all(r["employee_key"] is None for r in rows[1:])
    assert report.blank_employee == 3 and report.invalid_employee == 3


def test_mapping_flags_bad_months_and_efforts_without_echoing_values():
    records = [
        pt_record("E1", 2026, 13),
        pt_record("E2", None, 5),
        pt_record("E3", 2026, 5, effort="abc"),
        pt_record("E4", 2026, 5, effort=float("nan")),
        pt_record("E5", 2026, 5, effort="12.5"),
        pt_record("E6", 2026, 5, effort=None),
    ]
    rows, report = map_project_track_rows(records, FIELDS)
    assert report.invalid_month == 2 and report.invalid_effort == 2
    assert rows[4]["effort"] == 12.5 and rows[5]["effort"] is None
    assert rows[0]["month_key"] is None and rows[2]["month_key"] == date(2026, 5, 1)


def test_mapping_never_defaults_fields_the_api_does_not_supply():
    rows, report = map_project_track_rows([pt_record("E1", 2026, 5)], FIELDS)
    row = rows[0]
    assert row["is_override"] is None and row["sub_project_name"] is None and row["contract_type"] is None
    assert any("is_override" in w for w in report.warnings)


def test_mapping_uses_configured_optional_columns():
    fields = ProjectTrackFields(is_override="Is Override", sub_project="Sub Project")
    record = pt_record("E1", 2026, 5, **{"Is Override": 0, "Sub Project": "Build"})
    row = map_project_track_rows([record], fields)[0][0]
    assert row["is_override"] is False and row["sub_project_name"] == "Build"


def test_mapped_rows_feed_the_unchanged_engine():
    fields = ProjectTrackFields(is_override="Is Override")
    records = [pt_record("E1", 2026, 5, **{"Is Override": False}), pt_record(None, 2026, 5, **{"Is Override": False})]
    rows, _ = map_project_track_rows(records, fields)
    classified = e.classify_rows(rows)
    assert classified[0].status == e.VALID
    assert classified[1].status == e.UNTAGGED


def test_without_override_column_the_engine_marks_rows_unresolved():
    rows, _ = map_project_track_rows([pt_record("E1", 2026, 5)], FIELDS)
    status = e.classify_rows(rows)[0]
    assert status.status == e.UNRESOLVED  # documented consequence of not assuming is_override


# ----------------------------------------------------------------------------- ZingHR
def test_zinghr_follows_cursors_until_null():
    rows = [hr_record(f"S{i:03d}") for i in range(23)]
    fake = seeded_fake(hr_rows=rows)
    records, pages = fetch_employees(make_client(fake, page_size=10), HR_OBJECT, columns=HR_COLUMNS)
    assert len(records) == 23 and pages == 3


def test_zinghr_repeated_cursor_is_an_error():
    fake = seeded_fake(hr_rows=[hr_record("S1"), hr_record("S2")])

    def looping(obj, request):
        return fake._json(200, {"data": [hr_record("S1")], "row_count": 1, "next_cursor": "same", "truncated": False})

    fake._query = looping
    with pytest.raises(IncompleteResultError):
        fetch_employees(make_client(fake), HR_OBJECT, columns=HR_COLUMNS)


def test_zinghr_truncated_final_page_is_an_error():
    fake = seeded_fake()
    fake._query = lambda obj, request: fake._json(
        200, {"data": [hr_record("S1")], "row_count": 1, "next_cursor": None, "truncated": True}
    )
    with pytest.raises(IncompleteResultError):
        fetch_employees(make_client(fake), HR_OBJECT, columns=HR_COLUMNS)


def test_zinghr_mapping_matches_engine_shape_and_handles_bad_values():
    records = [
        hr_record("S1", DateOfJoining="2021-03-01T00:00:00", DateOfLeaving="March, 05 2026 00:00:00"),
        hr_record("S1"),
        hr_record("S2", DateOfJoining="not a date"),
        hr_record(None),
        hr_record("S3", **{"Business Vertical": "null"}),
    ]
    rows, report = map_zinghr_rows(records)
    assert rows[0]["joining_date"] == date(2021, 3, 1) and rows[0]["leaving_date"] == date(2026, 3, 5)
    assert rows[2]["joining_date"] is None and report.unparseable_dates == 1
    assert report.duplicate_codes == 1 and report.blank_code == 1
    assert rows[4]["business_vertical"] is None
    assert rows[0]["exit_date"] is None and rows[0]["resignation_date"] is None  # blank in the source stays blank

    employees = e.build_employees(rows, [])
    assert "S1" not in employees  # duplicate HR keys are dropped by the unchanged engine
    assert employees["S3"].hr_matched


# ----------------------------------------------------------------------------- end to end
def test_end_to_end_load_with_synthetic_data():
    today = date(2026, 11, 20)
    window = e.build_window(today)
    pt = []
    for key in window[:3]:
        pt += [pt_record(f"E{i:03d}", key // 100, key % 100, effort=40) for i in range(35)]
    hr = [hr_record(f"E{i:03d}") for i in range(35)]
    fake = seeded_fake(pt, hr)
    config = make_config(page_size=50)
    source = DbtezDataSource(DbtezClient(config, fake, sleep=lambda s: None), config)

    report = source.verify_schemas()
    assert report["zinghr"]["declared_key"] == ["EmployeeCode"]

    result = source.load(today)
    assert len(result.pt_rows) == 105 and len(result.hr_rows) == 35
    assert len(result.window) == 19
    summary = result.summary()
    assert summary["project_track_rows"] == 105 and "E000" not in json.dumps(summary)
    assert all(not r["path"].startswith("/auth") or r["method"] == "POST" for r in fake.requests)
    assert {r["method"] for r in fake.data_requests()} <= {"GET", "POST"}


def test_load_requests_only_columns_the_object_has():
    fake = FakeDbtez()
    fake.add_object(PT_OBJECT, ["Employee Code", "Year", "Month Number", "Effort"], [])
    fake.add_object(HR_OBJECT, ["EmployeeCode", "EmployeeName"], [], key=["EmployeeCode"])
    config = make_config()
    DbtezDataSource(DbtezClient(config, fake, sleep=lambda s: None), config).load(date(2026, 11, 20))
    query = json.loads(next(r for r in fake.data_requests() if r["path"].endswith("/query"))["body"])
    assert set(query["columns"]) == {"Employee Code", "Year", "Month Number", "Effort"}


def test_load_stops_when_required_fields_are_absent():
    fake = FakeDbtez()
    fake.add_object(PT_OBJECT, ["Year"], [])
    fake.add_object(HR_OBJECT, ["EmployeeCode", "EmployeeName"], [], key=["EmployeeCode"])
    config = make_config()
    with pytest.raises(SchemaError):
        DbtezDataSource(DbtezClient(config, fake, sleep=lambda s: None), config).load(date(2026, 11, 20))


def test_wrong_declared_zinghr_key_stops_the_load():
    fake = seeded_fake()
    fake.objects[HR_OBJECT]["key"] = ["EmployeeID"]
    config = make_config()
    with pytest.raises(SchemaError):
        DbtezDataSource(DbtezClient(config, fake, sleep=lambda s: None), config).verify_schemas()


# ----------------------------------------------------------------------------- helpers
@pytest.mark.parametrize(
    "value,expected",
    [("2026-03-01", date(2026, 3, 1)), ("2026-03-01T10:00:00Z", date(2026, 3, 1)), ("junk", None), (None, None), ("null", None)],
)
def test_parse_date(value, expected):
    assert parse_date(value) == expected


def test_clean_employee_code_numeric_values():
    assert clean_employee_code(1234.0) == ("1234", False)
    assert clean_employee_code(float("inf")) == (None, True)
    assert clean_employee_code(True) == (None, True)


def test_secret_formats_hide_value():
    secret = Secret("SYNTHETIC")
    assert "SYNTHETIC" not in f"{secret} {secret!r} {secret:>20}"


# ----------------------------------------------------------------------------- tolerance to API shape
def test_schema_accepts_mapping_columns_and_any_key_case():
    schema = parse_schema("o", {"COLUMNS": {"EmployeeCode": "text", "EmployeeName": "text"}, "KEY": "EmployeeCode"})
    assert schema.columns == ("EmployeeCode", "EmployeeName") and schema.key_columns == ("EmployeeCode",)


def test_upper_case_envelope_and_token_keys_are_accepted():
    fake = seeded_fake(_month_rows(2026, 11, 3))
    original = fake._query

    def upper(obj, request):
        payload = json.loads(original(obj, request).body)
        return fake._json(200, {k.upper(): v for k, v in payload.items()})

    fake._query = upper
    assert len(fetch_month(make_client(fake), PT_OBJECT, 2026, 11, FIELDS).rows) == 3

    fake2 = seeded_fake()
    original_send = fake2.send

    def send(method, url, headers, body, timeout):
        response = original_send(method, url, headers, body, timeout)
        if url.endswith("/auth/token/client"):
            return fake2._json(200, {k.upper(): v for k, v in json.loads(response.body).items()})
        return response

    fake2.send = send
    assert make_client(fake2).me() == {"client": "synthetic"}


def test_load_continues_when_the_schema_endpoint_has_an_unknown_shape():
    today = date(2026, 11, 20)
    key = e.build_window(today)[0]
    fake = seeded_fake([pt_record("E001", key // 100, key % 100)], [hr_record("E001")])
    original = fake.send

    def send(method, url, headers, body, timeout):
        if method == "GET" and url.split("invalid")[1].startswith("/v1/objects/") and "/query" not in url:
            return fake._json(200, {"something": "else"})
        return original(method, url, headers, body, timeout)

    fake.send = send
    config = make_config()
    result = DbtezDataSource(DbtezClient(config, fake, sleep=lambda s: None), config).load(today)
    assert len(result.pt_rows) == 1 and len(result.hr_rows) == 1


# ----------------------------------------------------------------------------- limited sample mode
def test_sample_mode_takes_one_call_per_month_and_flags_the_cut():
    fake = seeded_fake(_month_rows(2026, 11, 300))
    result = fetch_month(make_client(fake), PT_OBJECT, 2026, 11, FIELDS, sample_rows=50)
    assert len(result.rows) == 50 and result.calls == 1 and result.sampled and result.partitions == 0


def test_sample_mode_not_flagged_when_the_month_is_smaller_than_the_limit():
    fake = seeded_fake(_month_rows(2026, 11, 10))
    result = fetch_month(make_client(fake), PT_OBJECT, 2026, 11, FIELDS, sample_rows=50)
    assert len(result.rows) == 10 and not result.sampled


def test_sample_limits_come_from_env_by_default_and_can_be_switched_off():
    env = {"DBTEZ_BASE_URL": "https://x.invalid", "DBTEZ_CLIENT_ID": "a", "DBTEZ_CLIENT_SECRET": "b"}
    cfg = DbtezConfig.from_env(env)
    assert cfg.sample_rows_per_month == 1000 and cfg.sample_months == 6 and cfg.sample_hr_rows == 100
    off = DbtezConfig.from_env({**env, "DBTEZ_SAMPLE_ROWS_PER_MONTH": "off", "DBTEZ_SAMPLE_MONTHS": "0"})
    assert off.sample_rows_per_month is None and off.sample_months is None
    assert make_config().sample_rows_per_month is None  # direct construction stays unlimited
    with pytest.raises(ConfigError):
        DbtezConfig.from_env({**env, "DBTEZ_SAMPLE_MONTHS": "20"})


def test_load_in_sample_mode_limits_months_and_reports_it():
    today = date(2026, 11, 20)
    window = e.build_window(today)
    pt = []
    for key in window[:5]:
        pt += [pt_record(f"E{i:03d}", key // 100, key % 100) for i in range(40)]
    fake = seeded_fake(pt, [hr_record(f"E{i:03d}") for i in range(40)])
    config = make_config(sample_rows_per_month=25, sample_months=3)
    result = DbtezDataSource(DbtezClient(config, fake, sleep=lambda s: None), config).load(today)
    assert len(result.pt_rows) == 75  # 3 months x 25 rows
    summary = result.summary()
    assert summary["sampled"] and summary["months_loaded"] == 3 and summary["months_cut_short"] == 3
    assert len(result.window) == 19  # the reporting window itself is unchanged


# ----------------------------------------------------------------------------- timeouts
def test_read_timeouts_are_retried_once_and_name_the_failing_call():
    fake = seeded_fake()
    calls = {"n": 0}
    original = fake.send

    def silent(method, url, headers, body, timeout):
        if url.endswith("/v1/me"):
            calls["n"] += 1
            raise TransportError("The server did not answer in time (read timeout)", "timeout")
        return original(method, url, headers, body, timeout)

    fake.send = silent
    with pytest.raises(TransportError) as err:
        make_client(fake, max_retries=3).me()
    assert calls["n"] == 2
    assert "read timeout" in str(err.value) and "GET /v1/me" in str(err.value) and err.value.kind == "timeout"


def test_token_request_timeout_is_labelled_as_the_token_request():
    fake = seeded_fake()

    def silent(method, url, headers, body, timeout):
        raise TransportError("The server did not answer in time (read timeout)", "timeout")

    fake.send = silent
    with pytest.raises(TransportError) as err:
        make_client(fake, max_retries=3).me()
    assert "token request" in str(err.value)
    assert SENTINEL_CLIENT_SECRET not in str(err.value)


def test_zinghr_sample_is_one_limited_call():
    fake = seeded_fake(hr_rows=[hr_record(f"S{i:03d}") for i in range(250)])
    records, pages = fetch_employees(make_client(fake), HR_OBJECT, columns=HR_COLUMNS, max_rows=100)
    assert len(records) == 100 and pages == 1
    queries = [r for r in fake.data_requests() if r["path"].endswith("/query")]
    assert len(queries) == 1 and json.loads(queries[0]["body"])["limit"] == 100


def test_zinghr_exit_resignation_country_email_and_manager_are_now_mapped():
    record = hr_record(
        "S9",
        ExitDate="2026-02-10",
        DateofResignation="25-12-2025",
        COUNTRY="Synthetic Land",
        Email="synthetic@example.invalid",
        ReportingManagerName="Synthetic Manager",
        ReportingManagerCode="M1",
    )
    row = map_zinghr_rows([record])[0][0]
    assert row["exit_date"] == date(2026, 2, 10) and row["resignation_date"] == date(2025, 12, 25)
    assert row["country"] == "Synthetic Land" and row["manager_code"] == "M1"
    from app.dbtez.zinghr import ZINGHR_COLUMNS

    for column in ("ExitDate", "DateofResignation", "COUNTRY", "Email", "ReportingManagerName", "ReportingManagerCode"):
        assert column in ZINGHR_COLUMNS


def test_text_dates_in_common_formats_parse():
    assert parse_date("10-02-2026") == date(2026, 2, 10)
    assert parse_date("10/02/2026 00:00:00") == date(2026, 2, 10)
    assert parse_date("10-Feb-2026") == date(2026, 2, 10)
    assert parse_date("2026-02-10 00:00:00.000") == date(2026, 2, 10)


# ----------------------------------------------------------------------------- Client Guide v1.1 alignment
def _error(fake, status, payload):
    return fake._json(status, payload)


def test_health_is_unauthenticated():
    fake = seeded_fake()
    assert make_client(fake).health() == {"status": "ok"}
    assert fake.token_requests() == []
    assert "Authorization" not in fake.requests[0]["headers"]


def test_token_lifetime_from_expires_in_triggers_early_refresh():
    fake = seeded_fake()
    fake.expires_in = 300
    clock = FakeClock()
    client = make_client(fake, clock)
    client.me()
    clock.now += 250  # past expires_in minus the safety margin
    client.me()
    assert len(fake.token_requests()) == 2


def test_invalid_client_is_not_retried_and_names_the_code():
    fake = seeded_fake()
    original = fake.send

    calls = {"n": 0}

    def send(method, url, headers, body, timeout):
        if url.endswith("/auth/token/client"):
            calls["n"] += 1
            return _error(fake, 401, {"error": "invalid_client", "message": "SYNTHETIC-DETAIL"})
        return original(method, url, headers, body, timeout)

    fake.send = send
    with pytest.raises(AuthError) as err:
        make_client(fake).me()
    assert "invalid_client" in str(err.value) and "SYNTHETIC-DETAIL" not in str(err.value)
    assert calls["n"] == 1


@pytest.mark.parametrize(
    "status,code",
    [(400, "unknown_field"), (400, "invalid_query"), (403, "denied_columns"), (404, "not_found")],
)
def test_documented_client_errors_are_reported_with_their_code_and_not_retried(status, code):
    fake = seeded_fake()
    original = fake.send
    calls = {"n": 0}

    def send(method, url, headers, body, timeout):
        if url.endswith("/query"):
            calls["n"] += 1
            return _error(fake, status, {"error": code, "message": "SYNTHETIC-DETAIL"})
        return original(method, url, headers, body, timeout)

    fake.send = send
    with pytest.raises(ApiError) as err:
        make_client(fake).query(PT_OBJECT, columns=["Year"])
    assert code in str(err.value) and "SYNTHETIC-DETAIL" not in str(err.value)
    assert calls["n"] == 1


def test_query_timeout_is_not_retried_blindly():
    from app.dbtez.errors import QueryTimeoutError

    fake = seeded_fake()
    original = fake.send
    calls = {"n": 0}

    def send(method, url, headers, body, timeout):
        if url.endswith("/query"):
            calls["n"] += 1
            return _error(fake, 504, {"error": "query_timeout"})
        return original(method, url, headers, body, timeout)

    fake.send = send
    with pytest.raises(QueryTimeoutError) as err:
        make_client(fake).query(PT_OBJECT, columns=["Year"])
    assert "query_timeout" in str(err.value)
    assert calls["n"] == 1


def test_rate_limit_waits_details_retry_after_seconds():
    fake = seeded_fake()
    clock = FakeClock()
    original = fake.send
    state = {"n": 0}

    def send(method, url, headers, body, timeout):
        if url.endswith("/v1/me") and state["n"] == 0:
            state["n"] += 1
            return _error(fake, 429, {"error": "rate_limited", "details": {"retry_after_seconds": 9}})
        return original(method, url, headers, body, timeout)

    fake.send = send
    make_client(fake, clock).me()
    assert 9.0 in clock.sleeps


def test_object_list_uses_the_documented_object_field():
    from app.dbtez.discovery import list_object_names

    names = list_object_names(make_client(seeded_fake()))
    assert set(names) == {PT_OBJECT, HR_OBJECT}


def test_zinghr_cursor_query_is_ordered_by_the_key_and_reads_everyone():
    rows = [hr_record(f"S{i:03d}") for i in range(23)]
    fake = seeded_fake(hr_rows=rows)
    records, _ = fetch_employees(make_client(fake, page_size=10), HR_OBJECT, columns=HR_COLUMNS)
    bodies = [json.loads(r["body"]) for r in fake.requests if r["path"].endswith("/query")]
    assert len(records) == 23
    assert all(b["order_by"] == "[EmployeeCode] ASC" for b in bodies)
    assert all(set(b) - {"cursor"} == set(bodies[0]) - {"cursor"} for b in bodies)  # same body apart from cursor


def test_text_proposal_numbers_stay_distinct():
    fields = ProjectTrackFields(assume_no_override=True, sub_project="Workstream Name")
    records = [
        pt_record("E1", 2026, 11, effort=40, **{"Proposal Number": "PRP-001", "Workstream Name": "A"}),
        pt_record("E1", 2026, 11, effort=40, **{"Proposal Number": "PRP-002", "Workstream Name": "A"}),
        pt_record("E1", 2026, 11, effort=40, **{"Proposal Number": "7", "Workstream Name": "A"}),
    ]
    rows, _ = map_project_track_rows(records, fields)
    assert [r["proposal_number"] for r in rows] == ["PRP-001", "PRP-002", 7]
    assert all(r.status == e.VALID for r in e.classify_rows(rows))
