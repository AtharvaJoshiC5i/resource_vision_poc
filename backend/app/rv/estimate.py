"""Estimated availability for employee-months the engine could not verify.

The engine marks an employee-month "Unverified" when capacity or planned hours cannot be established:
no HR match, invalid employment dates, or rows that need review. For the DBTEZ source the data is a
partial extract (and lacks some HR and project fields), so that leaves many people with no availability
at all. This step, applied only when ``RV_ESTIMATE_UNVERIFIED`` is on, fills the gaps with stated
assumptions and says so in each month's status reason:

- capacity: the standard capacity when it could not be established;
- planned: all hours recorded for the month (verified plus those on rows needing review, never negative).

The engine itself is unchanged and still reports Unverified; only the DBTEZ load calls this.
"""

from __future__ import annotations

import os

from app.rv import engine as e


def enabled() -> bool:
    return os.environ.get("RV_ESTIMATE_UNVERIFIED", "true").strip().lower() in ("1", "true", "yes", "on")


def estimate_unverified(snapshot: e.Snapshot, capacity_hours: float) -> int:
    """Rewrites Unverified employee-months in place. Returns how many were estimated."""
    estimated = 0
    for month in snapshot.employee_months.values():
        if month.status != e.UNVERIFIED:
            continue
        employee = snapshot.employees.get(month.key)
        notes = []
        if month.capacity is None:
            month.capacity = capacity_hours
            notes.append("capacity assumed" + (" (no HR match)" if employee and not employee.hr_matched else ""))
        if month.planned is None:
            month.planned = max(month.raw_hours, 0.0)
            if month.unresolved_rows:
                notes.append(f"{month.unresolved_rows} record(s) needing review counted")
        month.remaining = month.capacity - month.planned

        rounded = round(month.remaining, 6)
        if rounded < 0:
            month.status = e.OVER_ALLOCATED
        elif rounded == 0:
            month.status = e.FULLY_COMMITTED
        elif round(month.planned, 6) == 0:
            month.status = e.FULLY_AVAILABLE
        else:
            month.status = e.PARTIALLY_AVAILABLE
        month.status_reason = "Estimated: " + "; ".join(notes or ["figures completed"])
        estimated += 1
    return estimated
