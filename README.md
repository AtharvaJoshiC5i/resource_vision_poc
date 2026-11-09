# Resource Vision

Workforce availability dashboard. React + TypeScript (Vite) frontend and a read-only FastAPI backend over Azure SQL.

Three pages: **Availability**, **Employee 360**, **Projects**.

Colours are defined once in `src/index.css` and documented in [`docs/DESIGN_SYSTEM_COLOR.md`](docs/DESIGN_SYSTEM_COLOR.md).

## Page structure

Every dashboard page uses the same top-to-bottom zones so users always know where filters, counts, and the main table live. Filters stay on each page (not global); data-as-of and data quality sit in the sidebar.

| Zone | Role |
|------|------|
| 1. Page title | `PageHeader`: workspace name and one-line data definition (e.g. planned allocation, not utilization). |
| 2. Scope and filters | One **Filters** card (Availability, Projects) or inline filters inside the primary table card (Employee 360 list). |
| 3. Summary | KPI strip; informational only except Employee 360 status cards, which filter the directory table directly below. |
| 4. Primary work surface | The main table: availability matrix, employee directory, or project portfolio. |
| 5. Secondary insight | Supporting charts or detail blocks (Availability trends; Projects selected project; Employee profile sections). |

**Employee 360** has two modes on one route: list (`/employee`) and profile (`?emp=`). The list uses zones 1–4; the profile uses a back link plus identity bar instead of repeating the workspace title, then summary KPIs, availability over time, projects, and HR details.

Layout helpers live in [`src/components/layout/pageZones.tsx`](src/components/layout/pageZones.tsx).

## How it works

- The backend reads only two tables, `dbo.project_track_proposals_table` and `dbo.zinghr_employee_master`
  (normalised with the existing `dbo.rv_*` functions), and computes everything in `backend/app/rv/engine.py`.
- Calculation rules are written down in [`docs/CALCULATION_SPEC.md`](docs/CALCULATION_SPEC.md). Read it before changing any number.
- Reporting window: the current month plus the next 18 months. Months with no Project Track data are blank.
- Capacity is 176 h per employed employee-month (`RV_CAPACITY_HOURS`).
- The frontend holds no business logic; filters live in the URL.

## Fast path: precomputed tables

The heavy rules run **once per refresh in SQL**, not on every request.

1. `backend/sql/rv2_schema.sql` defines the `rv2_*` tables and `dbo.rv2_Refresh`.
2. `python backend/scripts/refresh_facts.py` installs them and rebuilds the data. Schedule it (e.g. every 5 minutes) with
   `--no-install`. It needs permission to create tables; the web API stays read-only.
3. `python backend/scripts/check_facts.py` compares the SQL result with the Python engine (prints counts only).
   Run it once after the first refresh; it must print `PASS`.
4. The API reloads its in-memory copy only when `rv2_Meta.Version` changes. `RV_DATA_SOURCE=azure_raw` recomputes
   everything in Python (slow, reference only); `demo` uses synthetic data.

The frontend caches responses per URL for 30 s, so switching pages is instant.

## Run locally

Backend (needs the Microsoft ODBC driver and `backend/.env` with your Azure SQL settings; see `backend/README.md`):

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Frontend:

```bash
npm install
npm run dev
```

No database? Run the backend with synthetic data: set `RV_DATA_SOURCE=demo` before starting uvicorn.

## Checks

```bash
npm run lint
npm run build
cd backend && python -m pytest tests -q
```

## Diagnostics (read-only, print aggregates only)

`backend/scripts/inspect_schema.py`, `profile_data.py`, `profile_data_2.py`.
