"""Compare the SQL-computed tables with the Python reference engine. Prints counts only.

    python scripts/check_facts.py

Run after refresh_facts.py. Any non-zero difference means SQL and the spec disagree.
"""

from __future__ import annotations

import sys
from collections import Counter
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.rv import engine as e  # noqa: E402
from app.rv.facts import load_snapshot_from_facts  # noqa: E402
from app.rv.service import _load_raw  # noqa: E402


def main() -> int:
    sql_snap, meta = load_snapshot_from_facts()
    py_snap = _load_raw(meta["TodayDate"] if isinstance(meta["TodayDate"], date) else date.today())

    problems = 0

    def report(label: str, a: object, b: object) -> None:
        nonlocal problems
        ok = a == b
        problems += 0 if ok else 1
        print(f"{'OK  ' if ok else 'DIFF'} {label}: sql={a} python={b}")

    report("window", sql_snap.window, py_snap.window)
    report("employees", len(sql_snap.employees), len(py_snap.employees))
    report("employee-months", len(sql_snap.employee_months), len(py_snap.employee_months))
    report(
        "status counts",
        dict(sorted(Counter(m.status for m in sql_snap.employee_months.values()).items())),
        dict(sorted(Counter(m.status for m in py_snap.employee_months.values()).items())),
    )
    report(
        "contract categories",
        dict(sorted(Counter(m.contract_category for m in sql_snap.employee_months.values()).items())),
        dict(sorted(Counter(m.contract_category for m in py_snap.employee_months.values()).items())),
    )
    report("projects", len(sql_snap.projects), len(py_snap.projects))
    report("data quality", sql_snap.data_quality, py_snap.data_quality)

    mismatched = [
        k for k, m in sql_snap.employee_months.items()
        if k in py_snap.employee_months
        and (m.status, round(m.planned or -1, 4), round(m.capacity or -1, 4))
        != (py_snap.employee_months[k].status, round(py_snap.employee_months[k].planned or -1, 4),
            round(py_snap.employee_months[k].capacity or -1, 4))
    ]
    report("employee-months with different status/planned/capacity", len(mismatched), 0)
    if mismatched:
        print("  first keys:", mismatched[:5])
    print("PASS" if problems == 0 else f"{problems} difference(s)")
    return 0 if problems == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
