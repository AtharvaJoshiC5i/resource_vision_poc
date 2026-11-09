"""Read-only data profiling, part 2 (Step 2b).

Focus: how placeholder (zero-effort / included_default = 0) rows, duplicate
groups, leavers and unmatched employees affect employee-month status.
Aggregates only. No names, e-mails or employee codes are printed.

Run from the backend folder:
    python scripts/profile_data_2.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import DatabaseError, connect  # noqa: E402

V = "dbo.vwl_rv_ProjectTrackKeyed"

QUERIES: list[tuple[str, str]] = [
    (
        "A. Named rows: status x zero/positive effort",
        f"""
        SELECT RowStatus, CASE WHEN Effort = 0 THEN 'zero' ELSE 'positive' END AS effort_kind, COUNT(*) AS row_count
        FROM {V} WHERE EmployeeKeyNorm IS NOT NULL
        GROUP BY RowStatus, CASE WHEN Effort = 0 THEN 'zero' ELSE 'positive' END
        ORDER BY 3 DESC
        """,
    ),
    (
        "B. Named rows: why are rows excluded? (reasons, out-of-tenure, flags)",
        """
        SELECT TOP 25 excluded_reason, skip_reasons, is_out_of_tenure, included_default, COUNT(*) AS row_count
        FROM dbo.project_track_proposals_table
        WHERE dbo.rv_Blank(employee_id) IS NOT NULL
        GROUP BY excluded_reason, skip_reasons, is_out_of_tenure, included_default
        ORDER BY 5 DESC
        """,
    ),
    (
        "C. Named duplicate groups: can one row be selected unambiguously?",
        f"""
        WITH G AS (
          SELECT EmployeeKeyNorm, MonthKey, project_id, ProposalNumber, sub_project_name,
                 SUM(CASE WHEN IncludedDefault = 1 THEN 1 ELSE 0 END) AS inc,
                 SUM(CASE WHEN IncludedDefault = 1 AND Effort > 0 THEN 1 ELSE 0 END) AS inc_pos,
                 COUNT(DISTINCT CASE WHEN Effort > 0 THEN Effort END) AS pos_efforts
          FROM {V}
          WHERE EmployeeKeyNorm IS NOT NULL AND GroupRowCount > 1
          GROUP BY EmployeeKeyNorm, MonthKey, project_id, ProposalNumber, sub_project_name)
        SELECT COUNT(*) AS dup_groups,
               SUM(CASE WHEN inc = 0 THEN 1 ELSE 0 END) AS no_included_row,
               SUM(CASE WHEN inc = 1 THEN 1 ELSE 0 END) AS exactly_one_included_row,
               SUM(CASE WHEN inc > 1 THEN 1 ELSE 0 END) AS several_included_rows,
               SUM(CASE WHEN inc_pos >= 1 THEN 1 ELSE 0 END) AS with_positive_included,
               SUM(CASE WHEN pos_efforts > 1 THEN 1 ELSE 0 END) AS conflicting_positive_efforts
        FROM G
        """,
    ),
    (
        "D. Employee-month composition from 2026-11 on (named rows)",
        f"""
        WITH EM AS (
          SELECT EmployeeKeyNorm, MonthKey,
                 SUM(CASE WHEN RowStatus = 'Valid' THEN 1 ELSE 0 END) AS valid_rows,
                 SUM(CASE WHEN RowStatus <> 'Valid' AND Effort > 0 THEN 1 ELSE 0 END) AS unresolved_pos,
                 SUM(CASE WHEN RowStatus <> 'Valid' AND Effort = 0 THEN 1 ELSE 0 END) AS unresolved_zero
          FROM {V}
          WHERE EmployeeKeyNorm IS NOT NULL AND MonthKey >= 202611
          GROUP BY EmployeeKeyNorm, MonthKey)
        SELECT MonthKey,
               CASE WHEN unresolved_pos > 0 THEN '1 has unresolved positive-effort row'
                    WHEN valid_rows > 0 AND unresolved_zero > 0 THEN '2 valid + zero-effort unresolved'
                    WHEN valid_rows > 0 THEN '3 valid only'
                    ELSE '4 only zero-effort unresolved' END AS composition,
               COUNT(*) AS employee_months
        FROM EM
        GROUP BY MonthKey,
               CASE WHEN unresolved_pos > 0 THEN '1 has unresolved positive-effort row'
                    WHEN valid_rows > 0 AND unresolved_zero > 0 THEN '2 valid + zero-effort unresolved'
                    WHEN valid_rows > 0 THEN '3 valid only'
                    ELSE '4 only zero-effort unresolved' END
        ORDER BY MonthKey, composition
        """,
    ),
    (
        "E. ZingHR status vs resignation / joining dates",
        """
        SELECT EmployeeStatus, COUNT(*) AS employees, COUNT(DateofResignation) AS with_resignation,
               MIN(DateofResignation) AS min_resignation, MAX(DateofResignation) AS max_resignation,
               MIN(DateOfJoining) AS min_joining, MAX(DateOfJoining) AS max_joining
        FROM dbo.zinghr_employee_master GROUP BY EmployeeStatus ORDER BY 2 DESC
        """,
    ),
    (
        "F. FnF-status employees that still have positive effort from 2026-11 on",
        f"""
        SELECT z.EmployeeStatus, COUNT(DISTINCT p.EmployeeKeyNorm) AS employees, COUNT(*) AS positive_rows
        FROM {V} p
        JOIN dbo.zinghr_employee_master z ON dbo.rv_Key(z.EmployeeCode) = p.EmployeeKeyNorm
        WHERE z.EmployeeStatus LIKE 'FnF%' AND p.Effort > 0 AND p.MonthKey >= 202611
        GROUP BY z.EmployeeStatus
        """,
    ),
    (
        "G. Positive effort before the employee's joining month",
        f"""
        SELECT COUNT(DISTINCT p.EmployeeKeyNorm) AS employees, COUNT(*) AS rows_before_joining
        FROM {V} p
        JOIN dbo.zinghr_employee_master z ON dbo.rv_Key(z.EmployeeCode) = p.EmployeeKeyNorm
        WHERE p.Effort > 0 AND z.DateOfJoining IS NOT NULL
          AND p.MonthKey < YEAR(z.DateOfJoining) * 100 + MONTH(z.DateOfJoining)
        """,
    ),
    (
        "H. employee_tagging vs presence of employee_id",
        """
        SELECT employee_tagging,
               CASE WHEN dbo.rv_Blank(employee_id) IS NULL THEN 'blank id' ELSE 'has id' END AS id_state,
               COUNT(*) AS row_count
        FROM dbo.project_track_proposals_table GROUP BY employee_tagging,
               CASE WHEN dbo.rv_Blank(employee_id) IS NULL THEN 'blank id' ELSE 'has id' END
        """,
    ),
    (
        "I. Project Track-only employees (no valid ZingHR record), from 2026-11 on",
        f"""
        SELECT COUNT(DISTINCT p.EmployeeKeyNorm) AS employees,
               SUM(CASE WHEN p.Effort > 0 THEN 1 ELSE 0 END) AS positive_rows,
               COUNT(*) AS all_rows
        FROM {V} p
        WHERE p.EmployeeKeyNorm IS NOT NULL AND p.MonthKey >= 202611
          AND NOT EXISTS (SELECT 1 FROM dbo.vwl_rv_EmployeeKeyed e
                          WHERE e.IdentifierStatus = 'OK' AND e.EmployeeKeyNorm = p.EmployeeKeyNorm)
        """,
    ),
    (
        "J. Project dates (one row per project, aggregated)",
        """
        WITH P AS (SELECT project_id, MIN(start_date) AS s, MAX(end_date) AS e
                   FROM dbo.project_track_proposals_table GROUP BY project_id)
        SELECT COUNT(*) AS projects,
               SUM(CASE WHEN s IS NULL THEN 1 ELSE 0 END) AS no_start,
               SUM(CASE WHEN e IS NULL THEN 1 ELSE 0 END) AS no_end,
               MIN(s) AS earliest_start, MAX(e) AS latest_end
        FROM P
        """,
    ),
]


def main() -> int:
    try:
        with connect() as connection:
            cursor = connection.cursor()
            for title, sql in QUERIES:
                print(f"\n=== {title} ===")
                try:
                    cursor.execute(sql)
                    print(" | ".join(c[0] for c in cursor.description))
                    rows = cursor.fetchall()
                    for row in rows[:80]:
                        print(" | ".join("NULL" if v is None else str(v) for v in row))
                    if len(rows) > 80:
                        print(f"... ({len(rows) - 80} more rows not shown)")
                    if not rows:
                        print("(no rows)")
                except Exception as error:  # noqa: BLE001
                    print(f"QUERY FAILED: {error}")
    except DatabaseError as error:
        print(f"FAILED: {error}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
