# DBTEZ integration: operator guide

For an **authorised operator**. The integration was built and tested by a coding agent using synthetic data only. It has never contacted the real API. The first live run is yours, on your own machine.

## What was built

| Piece | Location |
|---|---|
| Client, auth, retries, rate limits | `backend/app/dbtez/client.py`, `ratelimit.py`, `transport.py` |
| Environment configuration | `backend/app/dbtez/config.py` |
| Object schema discovery | `backend/app/dbtez/discovery.py` |
| Project Track monthly retrieval and partitioning | `backend/app/dbtez/project_track.py` |
| ZingHR cursor retrieval | `backend/app/dbtez/zinghr.py` |
| Adapter that yields the engine's existing row dicts | `backend/app/dbtez/datasource.py` |
| Synthetic tests (70) | `backend/tests/test_dbtez.py`, `backend/tests/dbtez_fakes.py` |
| Operator check | `backend/scripts/dbtez_operator_check.py` |
| Placeholder settings | `backend/dbtez.env.example` |

The availability engine is unchanged. The adapter is **not** wired into `RV_DATA_SOURCE`, writes nothing, and does not touch the Resource Vision tables.

## How exposure is prevented

- No code path reads `.env` files. Settings come only from the process environment.
- Credentials sit in a `Secret` wrapper. `print`, `repr`, f-strings and pickling show `***` or fail.
- Tokens, request bodies and response bodies are never logged or placed in exception messages. Errors carry status codes, counts and field names only.
- Redirects are refused, so the bearer token cannot be forwarded to another host.
- Base URL must be `https` (plain `http` only for localhost), with no embedded credentials.
- Only GET and the documented read-only query POST can be sent; the code rejects anything else.
- Tests use obviously fake values (`SYN-...`, `.invalid` host) and assert that the fake secrets and tokens never appear in logs or errors.
- The operator script prints counts and field names only and writes no files.

## Running the check locally

1. Use a machine and shell that are yours. Do **not** run this inside an AI agent session, and do not paste its output anywhere except to confirm the counts.
2. Set the variables in your shell (see `backend/dbtez.env.example` for the names).

```powershell
$env:DBTEZ_BASE_URL = Read-Host "Base URL"
$env:DBTEZ_CLIENT_ID = Read-Host "Client ID"
$secure = Read-Host "Client secret" -AsSecureString
$env:DBTEZ_CLIENT_SECRET = [System.Net.NetworkCredential]::new("", $secure).Password
$env:DBTEZ_PROJECT_TRACK_OBJECT = Read-Host "Project Track object"
$env:DBTEZ_ZINGHR_OBJECT = Read-Host "ZingHR object"
```

3. Run the schema check (health, credential, object and field presence):

```powershell
python backend/scripts/dbtez_operator_check.py
```

4. Run the full window fetch, printing counts only:

```powershell
python backend/scripts/dbtez_operator_check.py --counts
```

5. Close the shell, or clear the variables, when finished.

Expected output is a list of status words and counts. If anything prints a name, a code, a token or a record, stop and report it.

## Things to confirm on the first live run

The brief did not specify these, so the code does not assume them. The check reports most of them.

1. **Schema response shape.** `GET /v1/objects/{object}` is parsed defensively (`columns` or `fields`, items as strings or `{name}`, key under `key_columns`, `keys`, `key` or `primary_key`). If the shape differs the check fails with the top-level key names, and `discovery.py` needs a one-line change.
2. **Token response field.** Looks for `access_token`, `accessToken` or `token`.
3. **`row_count`** is treated as the number of rows in that response. If it means something else, the strict check fails; tell the developer.
4. **Optional Project Track columns.** The brief's field list has no override flag, sub-project, contract type or start and end dates. **If no override column exists, the engine marks every named row `unresolved`** (its rule for a missing `is_override`), so the dashboard would show every employee as Unverified. Decide with the Project Track team what that field is called, then set `DBTEZ_PT_OVERRIDE_COLUMN` (and the others). Do not switch to this source until this is resolved.
5. **ZingHR gaps.** The brief's list has no exit date, resignation date, country, email or manager. Those stay empty; capacity and filters that use them will differ from the current SQL path.
6. **Employee key rule.** The production key comes from the SQL function `dbo.rv_Key`, which is not in this repository. The adapter uses trim plus upper-case. Confirm it gives the same keys, or pass a different `key_fn` to `DbtezDataSource`.
7. **Project Track has no declared key**, so months are split by `Employee Code` prefix when a month exceeds the page size. A month that cannot be split completely raises `IncompleteResultError`; nothing partial is used.
8. **Rate limits.** The client throttles to 120 data calls and 10 token requests per minute. A full 19-month window needs at least 19 calls, more if months are partitioned.
9. **Parity.** Before replacing the SQL pipeline, compare counts and a sample of employee-month hours between this path and the current `rv2_*` tables, as `scripts/check_facts.py` does for SQL against Python.

## Using it from code later

```python
config = DbtezConfig.from_env()
client = DbtezClient(config)
result = DbtezDataSource(client, config).load()
# result.pt_rows and result.hr_rows are the dict rows the engine already accepts.
print(result.summary())   # counts only, safe to log
```

Never print `result.pt_rows` or `result.hr_rows`: they contain employee records.

## Switching the dashboard between Azure SQL and the API

- **Configuration:** the running backend reads the `DBTEZ_*` lines from `backend/.env` (process environment variables win). The values are never printed. The switch shows DBTEZ as unavailable until the credentials and both object names are present.
- **Control:** the sidebar footer has a "Data source" switch, Azure SQL or DBTEZ API. Choosing one calls `POST /api/rv/data-source`. The server loads the new source first. If that fails, the previous source and its data stay in use and the error is shown under the switch. On success the page reloads, and a cache stamp stops data from the old source being reused.
- **Startup source:** `RV_DATA_SOURCE` still sets the source at startup (`azure` by default). The switch overrides it until the backend restarts.
- **Refresh:** the API source is cached for `RV_DBTEZ_CACHE_SECONDS` (default 900), because the API has no version number like `rv2_Meta.Version`. Switching sources, or restarting, forces a fresh load.
- **No override column:** by decision, with no override column configured every Project Track row is treated as not an override (`DBTEZ_PT_ASSUME_NO_OVERRIDE`, default true). Set it to `false` to go back to the strict behaviour. A configured `DBTEZ_PT_OVERRIDE_COLUMN` always wins.
- **Employee key:** the trim plus upper-case rule is accepted for now.
- **Gaps in API data:** project status, lead, account and BU, contract type, and project dates are not in the field list, so project pages show "Not available" for them on this source.
- **Limited sample:** by default the API source loads only the first 1000 rows of each month and the first 100 ZingHR rows (`DBTEZ_SAMPLE_HR_ROWS`) for the first 6 months of the window (`DBTEZ_SAMPLE_ROWS_PER_MONTH`, `DBTEZ_SAMPLE_MONTHS`), one call per month, so it renders in seconds. Totals are partial and the sidebar says so. Set both to `0` or `off` for a full load.
- **Estimated availability:** on the DBTEZ source, employee-months the engine cannot verify (no HR match, invalid dates, or rows needing review) are completed instead of shown as Unverified. Capacity is assumed to be the standard 176 hours, and planned hours are all recorded hours for the month, including rows that need review. Each such month's status reason starts with "Estimated:" and says what was assumed. The engine is unchanged. Set `RV_ESTIMATE_UNVERIFIED=false` to see Unverified again.

## Alignment with the Client Guide v1.1 (migration handoff, 24 Nov 2026)

| Guide rule | Implementation |
|---|---|
| `/v1/health` is unauthenticated | Called without a token |
| Token: `access_token`, `expires_in` | Token reused; refreshed early from `expires_in`, or after 1 h idle / 8 h age |
| 401 `invalid_client` on the token call | Stops at once, no retry loop; error names the code |
| 401 on data calls | Refresh once, replay once |
| 400 `unknown_field`/`invalid_query`, 403 `denied_columns`, 404 `not_found` | Not retried; error names the code and the call |
| 429 `rate_limited` | Waits `details.retry_after_seconds` (or `Retry-After`), bounded retries, shared limiter |
| 504 `query_timeout` | Not retried blindly; error names the call |
| Discovery `{"objects":[{"object": ...}]}` | Object names read from `object` |
| Keyed objects (ZingHR, key `EmployeeCode`) | Read in full with `order_by [EmployeeCode] ASC`; same body each page apart from `cursor` |
| Keyless objects (Project Track) | Year and month filter, then exhaustive non-null code ranges plus a NULL bucket; any truncated slice stops the load |
| Bracketed names in `where`/`order_by`, raw names in `columns` | As specified |

## Mapping matrix (Azure source to API object)

Project Track: Azure `dbo.project_track_proposals_table` to API `dbo.vw_pt_latest_project_effort_accrual_records_v6` (keyless).

| Azure column | API column | Status |
|---|---|---|
| row_id | Row ID | VERIFIED |
| project_id | project_id | VERIFIED (uniqueidentifier) |
| proposal_number | Proposal Number | VERIFIED (text in the API; kept as text when not numeric) |
| employee_id | Employee Code | VERIFIED |
| month_key | Year + Month Number | VERIFIED |
| effort_value | Effort | VERIFIED |
| project_name, employee_name, primary_capability, secondary_capability, department, grade, location, country | same names, title case | VERIFIED |
| sub_project_name | Workstream Name | NEEDS CLARIFICATION (assumed equivalent) |
| is_override | none | MISSING (treated as not overridden by decision) |
| contract_type, start_date, end_date, project_status, project_lead_name, parent_account_name, account_name, bdu_name, notes | none | MISSING |

ZingHR: Azure `dbo.zinghr_employee_master` to API `dbo.viewZingEmployeeTagging` (key `EmployeeCode`).

| Azure column | API column | Status |
|---|---|---|
| EmployeeCode, EmployeeName, DateOfJoining, ExitDate, DateOfLeaving, DateofResignation, EmployeeStatus, EmploymentType, Primary Practice, Secondary Practice, Grade Code, COUNTRY, Location, Division, Department, Email, ReportingManagerName, ReportingManagerCode, Business Vertical | same names | VERIFIED (all 19) |

Dates in the ZingHR view are text. The load summary reports `zinghr_unparseable_dates`, `zinghr_missing_joining_date` and `employees_matched_to_zinghr`, so a format problem is visible at once.
