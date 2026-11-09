"""Create the rv2_* tables (idempotent) and rebuild them. Run this on a schedule (e.g. every 5 minutes).

    python scripts/refresh_facts.py            # install/upgrade SQL, then refresh
    python scripts/refresh_facts.py --no-install   # refresh only (fast, for the scheduler)

Needs permission to create tables and procedures. The web API itself never writes.
"""

from __future__ import annotations

import os
import re
import sys
import time
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import connect  # noqa: E402

SQL_FILE = Path(__file__).resolve().parents[1] / "sql" / "rv2_schema.sql"


def main() -> None:
    install = "--no-install" not in sys.argv
    capacity = float(os.environ.get("RV_CAPACITY_HOURS", "176"))
    with connect() as conn:
        conn.autocommit = True
        cur = conn.cursor()
        if install:
            batches = re.split(r"^\s*GO\s*$", SQL_FILE.read_text(encoding="utf-8"), flags=re.M | re.I)
            for batch in (b.strip() for b in batches):
                if batch:
                    cur.execute(batch)
            print("Installed rv2 tables and procedure.")
        started = time.monotonic()
        cur.execute("EXEC dbo.rv2_Refresh @Today = ?, @CapacityHours = ?", date.today(), capacity)
        while cur.nextset():
            pass
        cur.execute("SELECT Version, RefreshedUtc FROM dbo.rv2_Meta WHERE MetaId = 1")
        version, at = cur.fetchone()
        print(f"Refreshed to version {version} at {at} UTC in {time.monotonic() - started:.1f}s.")
        for table in ("rv2_Employee", "rv2_EmployeeMonth", "rv2_Allocation", "rv2_Project"):
            cur.execute(f"SELECT COUNT(*) FROM dbo.{table}")  # fixed names, no user input
            print(f"  {table}: {cur.fetchone()[0]} rows")


if __name__ == "__main__":
    main()
