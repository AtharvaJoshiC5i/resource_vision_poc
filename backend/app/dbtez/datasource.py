"""Data-source adapter: DBTEZ API -> the plain dict rows the Resource Vision engine consumes.

It is read-only, writes nothing, and is not wired into ``RV_DATA_SOURCE``. A later change can
call ``DbtezDataSource.load`` and pass the result to ``engine.build_snapshot`` unchanged.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any

from app.dbtez.client import DbtezClient
from app.dbtez.config import DbtezConfig
from app.dbtez.discovery import discover
from app.dbtez.errors import SchemaShapeError
from app.dbtez.normalize import EmployeeKeyFn, default_employee_key
from app.dbtez.project_track import PtMappingReport, fetch_months, map_project_track_rows
from app.dbtez.zinghr import (
    ZINGHR_COLUMNS,
    ZINGHR_REQUIRED,
    HrMappingReport,
    check_declared_key,
    fetch_employees,
    map_zinghr_rows,
)
from app.rv import engine as e


@dataclass
class LoadResult:
    pt_rows: list[dict[str, Any]]
    hr_rows: list[dict[str, Any]]
    window: list[int]
    pt_report: PtMappingReport
    hr_report: HrMappingReport
    month_calls: dict[int, int] = field(default_factory=dict)
    sample: dict[str, Any] = field(default_factory=dict)
    matched: int = 0

    def summary(self) -> dict[str, Any]:
        """Counts only. Safe to print or log."""
        return {
            "window": [self.window[0], self.window[-1]] if self.window else [],
            "project_track_rows": self.pt_report.rows,
            "blank_employee": self.pt_report.blank_employee,
            "invalid_employee": self.pt_report.invalid_employee,
            "invalid_month": self.pt_report.invalid_month,
            "invalid_effort": self.pt_report.invalid_effort,
            "zinghr_rows": self.hr_report.rows,
            "zinghr_duplicate_codes": self.hr_report.duplicate_codes,
            "zinghr_unparseable_dates": self.hr_report.unparseable_dates,
            "zinghr_missing_joining_date": self.hr_report.missing_joining,
            "employees_matched_to_zinghr": self.matched,
            "warnings": list(self.pt_report.warnings),
            "sampled": bool(self.sample),
            **self.sample,
        }


class DbtezDataSource:
    def __init__(self, client: DbtezClient, config: DbtezConfig, *, key_fn: EmployeeKeyFn = default_employee_key):
        self._client = client
        self._config = config
        self._key_fn = key_fn

    def _schema(self, object_name: str):
        try:
            return discover(self._client, object_name)
        except SchemaShapeError:
            return None

    def verify_schemas(self) -> dict[str, dict[str, list[str]]]:
        """Field names only. Raises SchemaError if a required field is absent."""
        fields = self._config.pt_fields
        pt = discover(self._client, self._config.require_project_track_object())
        pt.require(fields.required_columns())
        hr = discover(self._client, self._config.require_zinghr_object())
        hr.require(ZINGHR_REQUIRED)
        check_declared_key(hr.key_columns)
        return {
            "project_track": {
                "missing_requested": pt.missing(fields.requested_columns()),
                "declared_key": list(pt.key_columns),
            },
            "zinghr": {"missing_requested": hr.missing(ZINGHR_COLUMNS), "declared_key": list(hr.key_columns)},
        }

    def load(self, today: date | None = None) -> LoadResult:
        today = today or date.today()
        window = e.build_window(today)
        fields = self._config.pt_fields

        # Only ask for columns the object actually has; required ones must exist.
        # If the schema endpoint answers in a shape we do not recognise, carry on with the documented
        # column list: a missing column then fails loudly at query time instead of blocking the load.
        pt_columns = fields.requested_columns()
        pt_schema = self._schema(self._config.require_project_track_object())
        if pt_schema is not None:
            pt_schema.require(fields.required_columns())
            pt_columns = [c for c in pt_columns if c in pt_schema.columns]

        hr_columns = list(ZINGHR_COLUMNS)
        hr_schema = self._schema(self._config.require_zinghr_object())
        if hr_schema is not None:
            hr_schema.require(ZINGHR_REQUIRED)
            check_declared_key(hr_schema.key_columns)
            hr_columns = [c for c in hr_columns if c in hr_schema.columns]

        cfg = self._config
        fetch_keys = window[: cfg.sample_months] if cfg.sample_months else window
        months = fetch_months(
            self._client,
            cfg.require_project_track_object(),
            fetch_keys,
            fields,
            columns=pt_columns,
            sample_rows=cfg.sample_rows_per_month,
        )
        sample: dict[str, Any] = {}
        if cfg.sample_rows_per_month or cfg.sample_months or cfg.sample_hr_rows:
            sample = {
                "sample_hr_rows": cfg.sample_hr_rows,
                "sample_rows_per_month": cfg.sample_rows_per_month,
                "months_loaded": len(fetch_keys),
                "months_in_window": len(window),
                "months_cut_short": sum(1 for m in months if m.sampled),
            }
        records = [row for month in months for row in month.rows]
        pt_rows, pt_report = map_project_track_rows(records, fields, key_fn=self._key_fn)

        hr_records, pages = fetch_employees(
            self._client, self._config.require_zinghr_object(), columns=hr_columns, max_rows=cfg.sample_hr_rows
        )
        hr_rows, hr_report = map_zinghr_rows(hr_records, key_fn=self._key_fn, pages=pages)

        return LoadResult(
            pt_rows=pt_rows,
            hr_rows=hr_rows,
            window=window,
            pt_report=pt_report,
            hr_report=hr_report,
            month_calls={m.year * 100 + m.month: m.calls for m in months},
            sample=sample,
            matched=len(
                {r["employee_key"] for r in pt_rows if r["employee_key"]}
                & {r["employee_key"] for r in hr_rows if r["employee_key"]}
            ),
        )
