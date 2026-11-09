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

Endpoints (all GET, read-only, localhost):

| Path | Purpose |
|------|---------|
| `/health` | Liveness |
| `/api/database/status` | Azure SQL connectivity check |
| `/api/rv/meta` | Today, capacity, reporting window, data-quality counts |
| `/api/rv/availability/{options,overview,matrix}` | Availability page |
| `/api/rv/employees/search`, `/api/rv/employees/{key}` | Employee 360 |
| `/api/rv/projects/options`, `/api/rv/projects`, `/api/rv/projects/{id}` | Projects page |

Environment (optional): `RV_DATA_SOURCE` (`azure` default, or `demo`), `RV_CAPACITY_HOURS` (176), `RV_CACHE_SECONDS` (60).

## Tests

```bash
python -m pytest tests -q
```
