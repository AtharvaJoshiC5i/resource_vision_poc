"""Read-only data profiling for Resource Vision (Step 2).

Prints aggregates, categorical value counts and the source code of the rv_*
helper functions. It never prints names, e-mails, employee codes or any other
personal data. Fixed queries only (no user input). Never prints credentials.

Run from the backend folder:
    python scripts/profile_data.py
Paste the full output back into the chat.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import DatabaseError, connect  # noqa: E402

QUERIES: list[tuple[str, str]] = [
    (
        "1. Numeric precision/scale of decimal columns (fractional hours must survive)",
        """
        SELECT COLUMN_NAME, DATA_TYPE, NUMERIC_PRECISION, NUMERIC_SCALE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'project_track_proposals_table'
          AND COLUMN_NAME IN ('effort_value', 'accrual_value', 'effort_value_mp')
        """,
    ),
    (
        "2. Source of helper functions rv_Blank / rv_Clean / rv_Key / rv_Trim",
        """
        SELECT o.name AS function_name, m.definition
        FROM sys.sql_modules m
        JOIN sys.objects o ON o.object_id = m.object_id
        WHERE o.name IN ('rv_Blank', 'rv_Clean', 'rv_Key', 'rv_Trim')
        ORDER BY o.name
        """,
    ),
    ("3a. rv_Settings (all rows)", "SELECT * FROM dbo.rv_Settings"),
    (
        "3b. rv_CapacityRule: rule counts",
        """
        SELECT RuleScope, IsActive, COUNT(*) AS rules
        FROM dbo.rv_CapacityRule GROUP BY RuleScope, IsActive
        """,
    ),
    (
        "3c. rv_CapacityRule: Default-scope rules (all columns)",
        "SELECT * FROM dbo.rv_CapacityRule WHERE RuleScope = 'Default'",
    ),
    ("3d. rv_AssignmentDate: row count", "SELECT COUNT(*) AS rows_in_table FROM dbo.rv_AssignmentDate"),
    ("3e. rv_RefreshLog (5 rows)", "SELECT TOP 5 * FROM dbo.rv_RefreshLog"),
    (
        "4. Staleness: materialised tb_* vs live views over the source tables",
        """
        SELECT
          (SELECT COUNT(*) FROM dbo.tb_rv_ProjectTrackKeyed) AS tb_pt_rows,
          (SELECT COUNT(*) FROM dbo.vwl_rv_ProjectTrackKeyed) AS live_pt_rows,
          (SELECT COUNT(*) FROM dbo.tb_rv_EmployeeKeyed) AS tb_emp_rows,
          (SELECT COUNT(*) FROM dbo.vwl_rv_EmployeeKeyed) AS live_emp_rows
        """,
    ),
    (
        "5. Project Track rows per month_key (rows, rows with an employee_id)",
        """
        SELECT month_key, COUNT(*) AS row_count,
               SUM(CASE WHEN employee_id IS NULL OR LTRIM(RTRIM(employee_id)) = '' THEN 0 ELSE 1 END) AS named_rows
        FROM dbo.project_track_proposals_table
        GROUP BY month_key ORDER BY month_key
        """,
    ),
    (
        "6. Row status ladder (live view): status, rows, rows with employee key",
        """
        SELECT RowStatus, COUNT(*) AS row_count,
               SUM(CASE WHEN EmployeeKeyNorm IS NULL THEN 0 ELSE 1 END) AS named_rows
        FROM dbo.vwl_rv_ProjectTrackKeyed GROUP BY RowStatus ORDER BY COUNT(*) DESC
        """,
    ),
    (
        "7a. employee_tagging values",
        "SELECT employee_tagging, COUNT(*) AS row_count FROM dbo.project_track_proposals_table GROUP BY employee_tagging ORDER BY 2 DESC",
    ),
    (
        "7b. included_default / is_override combinations",
        "SELECT included_default, is_override, COUNT(*) AS row_count FROM dbo.project_track_proposals_table GROUP BY included_default, is_override ORDER BY 3 DESC",
    ),
    (
        "7c. current_version_number distribution",
        "SELECT current_version_number, COUNT(*) AS row_count FROM dbo.project_track_proposals_table GROUP BY current_version_number ORDER BY 2 DESC",
    ),
    (
        "7d. Duplicate-group sizes (GroupRowCount)",
        "SELECT GroupRowCount, COUNT(*) AS row_count FROM dbo.vwl_rv_ProjectTrackKeyed GROUP BY GroupRowCount ORDER BY 1",
    ),
    (
        "8a. project_status values",
        "SELECT project_status, COUNT(DISTINCT project_id) AS projects, COUNT(*) AS row_count FROM dbo.project_track_proposals_table GROUP BY project_status ORDER BY 3 DESC",
    ),
    (
        "8b. contract_type values",
        "SELECT contract_type, COUNT(DISTINCT project_id) AS projects, COUNT(*) AS row_count FROM dbo.project_track_proposals_table GROUP BY contract_type ORDER BY 3 DESC",
    ),
    (
        "8c. Project totals",
        """
        SELECT COUNT(DISTINCT project_id) AS distinct_projects,
               SUM(CASE WHEN project_id IS NULL OR LTRIM(RTRIM(project_id)) = '' THEN 1 ELSE 0 END) AS rows_without_project_id
        FROM dbo.project_track_proposals_table
        """,
    ),
    (
        "9. Effort statistics (live view)",
        """
        SELECT COUNT(*) AS total_rows,
               SUM(CASE WHEN Effort IS NULL THEN 1 ELSE 0 END) AS null_effort,
               SUM(CASE WHEN Effort = 0 THEN 1 ELSE 0 END) AS zero_effort,
               SUM(CASE WHEN Effort < 0 THEN 1 ELSE 0 END) AS negative_effort,
               MIN(Effort) AS min_effort, MAX(Effort) AS max_effort,
               SUM(CASE WHEN Effort <> ROUND(Effort, 0) THEN 1 ELSE 0 END) AS fractional_effort_rows
        FROM dbo.vwl_rv_ProjectTrackKeyed
        """,
    ),
    (
        "10. Valid rows: employee-month planned-hour buckets vs 176",
        """
        WITH S AS (
          SELECT EmployeeKeyNorm, MonthKey, SUM(Effort) AS h
          FROM dbo.vwl_rv_ProjectTrackKeyed
          WHERE RowStatus = 'Valid' AND EmployeeKeyNorm IS NOT NULL
          GROUP BY EmployeeKeyNorm, MonthKey)
        SELECT CASE WHEN h = 0 THEN '=0' WHEN h < 176 THEN '0<h<176' WHEN h = 176 THEN '=176' ELSE '>176' END AS bucket,
               COUNT(*) AS employee_months
        FROM S
        GROUP BY CASE WHEN h = 0 THEN '=0' WHEN h < 176 THEN '0<h<176' WHEN h = 176 THEN '=176' ELSE '>176' END
        """,
    ),
    (
        "11. ZingHR keyed-employee diagnostics",
        "SELECT IdentifierStatus, DateStatus, COUNT(*) AS employees FROM dbo.vwl_rv_EmployeeKeyed GROUP BY IdentifierStatus, DateStatus ORDER BY 3 DESC",
    ),
    (
        "12. ZingHR date columns populated (catalog uses ExitDate)",
        """
        SELECT COUNT(*) AS total, COUNT(DateOfJoining) AS joining, COUNT(ExitDate) AS exit_date,
               COUNT(DateOfLeaving) AS date_of_leaving, COUNT(DateofResignation) AS resignation
        FROM dbo.zinghr_employee_master
        """,
    ),
    (
        "13. EmployeeStatus values",
        "SELECT EmployeeStatus, COUNT(*) AS employees FROM dbo.zinghr_employee_master GROUP BY EmployeeStatus ORDER BY 2 DESC",
    ),
    (
        "14. Project Track employee keys matched to valid ZingHR keys",
        """
        SELECT COUNT(DISTINCT p.EmployeeKeyNorm) AS pt_employee_keys,
               COUNT(DISTINCT CASE WHEN e.EmployeeKeyNorm IS NOT NULL THEN p.EmployeeKeyNorm END) AS matched_to_zinghr
        FROM dbo.vwl_rv_ProjectTrackKeyed p
        LEFT JOIN (SELECT DISTINCT EmployeeKeyNorm FROM dbo.vwl_rv_EmployeeKeyed WHERE IdentifierStatus = 'OK') e
               ON e.EmployeeKeyNorm = p.EmployeeKeyNorm
        WHERE p.EmployeeKeyNorm IS NOT NULL
        """,
    ),
    (
        "15. Slicer cardinalities (distinct non-blank values in ZingHR)",
        """
        SELECT COUNT(DISTINCT dbo.rv_Clean(Division)) AS divisions,
               COUNT(DISTINCT dbo.rv_Clean([Primary Practice])) AS primary_practices,
               COUNT(DISTINCT dbo.rv_Clean([Grade Code])) AS grades,
               COUNT(DISTINCT dbo.rv_Clean(Location)) AS locations
        FROM dbo.zinghr_employee_master
        """,
    ),
    (
        "16. Existing materialised capacity fact (reference for later parity checks)",
        """
        SELECT AvailabilityStatus, COUNT(*) AS employee_months,
               MIN(MonthKey) AS min_month, MAX(MonthKey) AS max_month
        FROM dbo.tb_FactEmployeeMonthCapacity GROUP BY AvailabilityStatus ORDER BY 2 DESC
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
                    columns = [c[0] for c in cursor.description]
                    print(" | ".join(columns))
                    rows = cursor.fetchall()
                    for row in rows[:60]:
                        print(" | ".join("NULL" if v is None else str(v) for v in row))
                    if len(rows) > 60:
                        print(f"... ({len(rows) - 60} more rows not shown)")
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
