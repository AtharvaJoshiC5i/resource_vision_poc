"""Read-only schema introspection for Resource Vision (Step 1).

Prints ONLY metadata: object names, column names/types, row counts and whether
helper objects exist. It never prints row data (no employee/project values) and
never prints connection settings.

Run from the backend folder:
    python scripts/inspect_schema.py
Paste the full output back into the chat.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import DatabaseError, connect  # noqa: E402

SOURCE_TABLES = ("project_track_proposals_table", "zinghr_employee_master")

# Fixed, hard-coded identifiers only (never user input).
COUNT_QUERIES = {
    "project_track_proposals_table": "SELECT COUNT(*) FROM dbo.project_track_proposals_table",
    "zinghr_employee_master": "SELECT COUNT(*) FROM dbo.zinghr_employee_master",
}

HELPER_NAMES = (
    "rv_Blank", "rv_Clean", "rv_Key", "rv_Trim",
    "rv_CapacityRule", "rv_Settings", "rv_AssignmentDate",
)


def section(title: str) -> None:
    print(f"\n=== {title} ===")


def main() -> int:
    try:
        with connect() as connection:
            cursor = connection.cursor()

            section("Server / database")
            cursor.execute("SELECT DB_NAME(), SCHEMA_NAME()")
            row = cursor.fetchone()
            print(f"database={row[0]}  default_schema={row[1]}")

            section("Columns of the two source tables")
            cursor.execute(
                """
                SELECT TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION, COLUMN_NAME,
                       DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_NAME IN (?, ?)
                ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION
                """,
                SOURCE_TABLES,
            )
            current = None
            for schema, table, pos, col, dtype, length, nullable in cursor.fetchall():
                if (schema, table) != current:
                    current = (schema, table)
                    print(f"\n{schema}.{table}")
                size = f"({length})" if length not in (None, -1) else ("(max)" if length == -1 else "")
                print(f"  {pos:>3}  {col}  {dtype}{size}  null={nullable}")

            section("Row counts")
            for name, query in COUNT_QUERIES.items():
                try:
                    cursor.execute(query)
                    print(f"{name}: {cursor.fetchone()[0]}")
                except Exception as error:  # noqa: BLE001
                    print(f"{name}: could not count ({error})")

            section("All tables and views in the database (names only)")
            cursor.execute(
                """
                SELECT TABLE_SCHEMA, TABLE_NAME, TABLE_TYPE
                FROM INFORMATION_SCHEMA.TABLES
                ORDER BY TABLE_SCHEMA, TABLE_TYPE, TABLE_NAME
                """
            )
            for schema, name, ttype in cursor.fetchall():
                print(f"{ttype:<11} {schema}.{name}")

            section("Helper functions / tables from the catalog (exist?)")
            placeholders = ",".join("?" for _ in HELPER_NAMES)
            cursor.execute(
                f"""
                SELECT SCHEMA_NAME(schema_id), name, type_desc
                FROM sys.objects
                WHERE name IN ({placeholders})
                ORDER BY name
                """,
                HELPER_NAMES,
            )
            found = {r[1]: (r[0], r[2]) for r in cursor.fetchall()}
            for name in HELPER_NAMES:
                if name in found:
                    print(f"FOUND    {found[name][0]}.{name}  [{found[name][1]}]")
                else:
                    print(f"MISSING  {name}")

            section("Database compatibility level")
            cursor.execute(
                "SELECT compatibility_level FROM sys.databases WHERE name = DB_NAME()"
            )
            print(cursor.fetchone()[0])
    except DatabaseError as error:
        print(f"FAILED: {error}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
