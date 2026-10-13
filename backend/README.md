# Resource Vision — Azure SQL API

Python read-only API that loads Famstack and Project Track tables from Azure SQL and returns JSON shaped for the Resource Vision POC frontend.

## Prerequisites

- Python 3.11+
- [Microsoft ODBC Driver for SQL Server](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server) (17 or 18)

## Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Edit `.env` with either:

1. **Connection string** — set `AZURE_SQL_CONNECTION_STRING`, or  
2. **SQL Server authentication** — set `AZURE_SQL_SERVER`, `AZURE_SQL_DATABASE`, `AZURE_SQL_USERNAME`, `AZURE_SQL_PASSWORD`.

If TLS certificate errors occur in development, set:

```env
AZURE_SQL_TRUST_SERVER_CERTIFICATE=yes
```

## Run

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | API liveness |
| GET | `/api/database/status` | Tests Azure SQL connection |
| GET | `/api/data/resource-vision` | Mapped Famstack, Project Track, derived ZingHR |

## Tables

- `dbo.famstack_billable`
- `dbo.famstack_non_billable`
- `dbo.project_track_proposals_table`

## SQL layer

Production bundle queries in `app/queries/resource_vision_sql.py` follow the
read patterns in the repo root file **`resource_vision_queries.sql`** (Q14/Q15
historical Famstack, Q18 provisional Project Track lines, Q19 employee
dimensions). They emit the same JSON shape as `src/data/famstack.json`,
`projectTrack.json`, and derived `zinghr.json`.

| Query | Mock target | Azure source |
|-------|-------------|--------------|
| `FAMSTACK_BILLABLE_AGGREGATED` | `FamstackRecord` (billable) | `dbo.famstack_billable` |
| `FAMSTACK_NON_BILLABLE_AGGREGATED` | `FamstackRecord` (non-billable) | `dbo.famstack_non_billable` |
| `PROJECT_TRACK_RESOURCE_VISION` | `ProjectTrackRecord` | `dbo.project_track_proposals_table` |
| `EMPLOYEE_MASTER_FROM_SOURCES` | `ZingHREmployee` (partial) | PT + Famstack employee codes |

`project_id` uses **proposal number** when present so historical Famstack rows
and planned Project Track rows share the same project key (as in the POC mock).

The API response includes `planning` (`currentMonth`, `monthKeys`, …) for the
Famstack / Project Track month boundary on the frontend.

Capacity configuration still comes from the frontend mock JSON (no Azure table in scope).
