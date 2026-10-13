from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from typing import Any

import pyodbc

from app.config import Settings, get_settings


class DatabaseError(Exception):
    pass


def _row_to_dict(cursor: pyodbc.Cursor, row: pyodbc.Row) -> dict[str, Any]:
    columns = [column[0] for column in cursor.description]
    return {column: value for column, value in zip(columns, row, strict=True)}


@contextmanager
def connect(settings: Settings | None = None) -> Iterator[pyodbc.Connection]:
    active_settings = settings or get_settings()

    try:
        connection_string = active_settings.build_connection_string()
    except ValueError as error:
        raise DatabaseError(str(error)) from error

    try:
        connection = pyodbc.connect(connection_string, timeout=30)
    except pyodbc.Error as error:
        raise DatabaseError(f"Could not connect to Azure SQL: {error}") from error

    try:
        yield connection
    finally:
        connection.close()


def ping_database(settings: Settings | None = None) -> dict[str, str]:
    with connect(settings) as connection:
        cursor = connection.cursor()
        cursor.execute("SELECT DB_NAME() AS database_name, @@VERSION AS version")
        row = cursor.fetchone()
        if row is None:
            raise DatabaseError("Database ping returned no rows.")

        database_name = str(row.database_name)
        version = str(row.version).split("\n", maxsplit=1)[0]

        return {
            "database_name": database_name,
            "server_version": version,
        }


def fetch_table(
    table_name: str,
    settings: Settings | None = None,
) -> list[dict[str, Any]]:
    active_settings = settings or get_settings()
    max_rows = active_settings.azure_sql_max_rows

    # Table names are fixed constants — not user input.
    allowed_tables = {
        "dbo.famstack_billable",
        "dbo.famstack_non_billable",
        "dbo.project_track_proposals_table",
    }

    if table_name not in allowed_tables:
        raise DatabaseError(f"Table access is not allowed: {table_name}")

    top_clause = f"TOP ({max_rows}) " if max_rows > 0 else ""

    query = f"SELECT {top_clause}* FROM {table_name}"

    with connect(active_settings) as connection:
        cursor = connection.cursor()
        try:
            cursor.execute(query)
        except pyodbc.Error as error:
            raise DatabaseError(
                f"Query failed for {table_name}: {error}",
            ) from error

        return [_row_to_dict(cursor, row) for row in cursor.fetchall()]


def fetch_all(
    query: str,
    parameters: tuple[Any, ...] | None = None,
    settings: Settings | None = None,
) -> list[dict[str, Any]]:
    active_settings = settings or get_settings()
    max_rows = active_settings.azure_sql_max_rows

    wrapped_query = query.strip().rstrip(";")

    if max_rows > 0:
        wrapped_query = (
            f"SELECT TOP ({max_rows}) * FROM ({wrapped_query}) AS resource_vision_source"
        )

    with connect(active_settings) as connection:
        cursor = connection.cursor()
        try:
            if parameters:
                cursor.execute(wrapped_query, parameters)
            else:
                cursor.execute(wrapped_query)
        except pyodbc.Error as error:
            raise DatabaseError(f"Query failed: {error}") from error

        return [_row_to_dict(cursor, row) for row in cursor.fetchall()]
