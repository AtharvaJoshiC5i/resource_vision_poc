"""Runtime configuration, read from environment variables only.

This module never opens a ``.env`` file. The authorised operator exports the variables in their
own shell (see docs/DBTEZ_OPERATOR_GUIDE.md). Credentials are wrapped in ``Secret`` so that an
accidental ``print``, ``repr``, f-string or log line shows ``***`` instead of the value.
"""

from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from typing import Mapping
from urllib.parse import urlparse

from app.dbtez.errors import ConfigError

MAX_PAGE_SIZE = 5000
MAX_DATA_CALLS_PER_MINUTE = 120
MAX_TOKEN_CALLS_PER_MINUTE = 10

DEFAULT_SUB_PROJECT_COLUMN = "Workstream Name"
_OBJECT_NAME = re.compile(r"^[A-Za-z0-9_.\-]{1,128}$")
_LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1"}


class Secret:
    """Holds a credential. Printing, formatting or pickling it never reveals the value."""

    __slots__ = ("_value",)

    def __init__(self, value: str):
        self._value = value

    def reveal(self) -> str:
        return self._value

    def __repr__(self) -> str:
        return "Secret(***)"

    def __str__(self) -> str:
        return "***"

    def __format__(self, spec: str) -> str:
        return "***"

    def __reduce__(self):
        raise TypeError("Secret cannot be pickled or copied")


@dataclass(frozen=True)
class ProjectTrackFields:
    """Field names in the Project Track object.

    The required ones come from the integration brief. The optional ones are NOT in that brief,
    so they default to ``None`` and are never assumed: the operator names them only if the
    object really has them.
    """

    project_id: str = "project_id"
    proposal_number: str = "Proposal Number"
    project_name: str = "Project Name"
    row_id: str = "Row ID"
    employee_code: str = "Employee Code"
    employee_name: str = "Employee Name"
    year: str = "Year"
    month_number: str = "Month Number"
    effort: str = "Effort"
    sub_project: str | None = None
    is_override: str | None = None
    contract_type: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    # Owner decision: with no override column configured, treat every row as "not an override"
    # (is_override = False) instead of leaving it unknown. Off in code, on by default from the env.
    assume_no_override: bool = False

    OPTIONAL_ENV = {
        "sub_project": "DBTEZ_PT_SUBPROJECT_COLUMN",
        "is_override": "DBTEZ_PT_OVERRIDE_COLUMN",
        "contract_type": "DBTEZ_PT_CONTRACT_COLUMN",
        "start_date": "DBTEZ_PT_START_DATE_COLUMN",
        "end_date": "DBTEZ_PT_END_DATE_COLUMN",
    }

    @classmethod
    def from_env(cls, env: Mapping[str, str]) -> "ProjectTrackFields":
        values = {}
        for attr, var in cls.OPTIONAL_ENV.items():
            raw = (env.get(var) or "").strip()
            if raw:
                if len(raw) > 128 or any(ord(c) < 32 for c in raw) or "]" in raw or "'" in raw:
                    raise ConfigError(f"{var} is not a valid column name")
                values[attr] = raw
        # The API view has no sub-project column. Without one, every row of an employee in the same project
        # and month looks like a duplicate and the whole month becomes Unverified. "Workstream Name" is the
        # closest field, so it is used by default (ASSUMPTION: confirm with Project Track). "none" turns it off.
        sub_raw = (env.get("DBTEZ_PT_SUBPROJECT_COLUMN") or "").strip()
        if not sub_raw:
            values["sub_project"] = DEFAULT_SUB_PROJECT_COLUMN
        elif sub_raw.lower() in ("none", "off"):
            values.pop("sub_project", None)
        flag = (env.get("DBTEZ_PT_ASSUME_NO_OVERRIDE") or "true").strip().lower()
        if flag not in ("true", "false", "1", "0", "yes", "no"):
            raise ConfigError("DBTEZ_PT_ASSUME_NO_OVERRIDE must be true or false")
        values["assume_no_override"] = flag in ("true", "1", "yes")
        return cls(**values)

    def requested_columns(self) -> list[str]:
        """Columns to request: the brief's list plus any optional column the operator named."""
        columns = [
            self.project_id,
            self.proposal_number,
            self.project_name,
            self.row_id,
            "Primary Capability",
            "Secondary Capability",
            "Department",
            "Grade",
            "Location",
            "Country",
            "Employee User UUID",
            "Employee Name",
            self.employee_code,
            "Employee Source",
            "Month",
            self.year,
            self.month_number,
            self.effort,
        ]
        for optional in (self.sub_project, self.is_override, self.contract_type, self.start_date, self.end_date):
            if optional and optional not in columns:
                columns.append(optional)
        return columns

    def required_columns(self) -> list[str]:
        """Without these the data cannot be used at all."""
        return [self.employee_code, self.year, self.month_number, self.effort]


@dataclass(frozen=True)
class DbtezConfig:
    base_url: str
    client_id: Secret
    client_secret: Secret
    project_track_object: str | None = None
    zinghr_object: str | None = None
    timeout_seconds: float = 30.0
    page_size: int = MAX_PAGE_SIZE
    max_retries: int = 3
    data_calls_per_minute: int = MAX_DATA_CALLS_PER_MINUTE
    token_calls_per_minute: int = MAX_TOKEN_CALLS_PER_MINUTE
    # Limited-sample mode: fetch only the first N rows of each month, and only the first M months of the
    # window. Meant for quick renders and testing; totals are then partial and the dashboard says so.
    sample_rows_per_month: int | None = None
    sample_months: int | None = None
    sample_hr_rows: int | None = None
    pt_fields: ProjectTrackFields = field(default_factory=ProjectTrackFields)

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> "DbtezConfig":
        source = os.environ if env is None else env

        missing = [
            name
            for name in ("DBTEZ_BASE_URL", "DBTEZ_CLIENT_ID", "DBTEZ_CLIENT_SECRET")
            if not (source.get(name) or "").strip()
        ]
        if missing:
            raise ConfigError("Missing environment variables: " + ", ".join(missing))

        return cls(
            base_url=_validated_base_url((source["DBTEZ_BASE_URL"]).strip()),
            client_id=Secret(source["DBTEZ_CLIENT_ID"].strip()),
            client_secret=Secret(source["DBTEZ_CLIENT_SECRET"].strip()),
            project_track_object=_optional_object(source, "DBTEZ_PROJECT_TRACK_OBJECT"),
            zinghr_object=_optional_object(source, "DBTEZ_ZINGHR_OBJECT"),
            timeout_seconds=float(_int(source, "DBTEZ_TIMEOUT_SECONDS", 30, 1, 120)),
            page_size=_int(source, "DBTEZ_PAGE_SIZE", MAX_PAGE_SIZE, 1, MAX_PAGE_SIZE),
            max_retries=_int(source, "DBTEZ_MAX_RETRIES", 3, 0, 6),
            data_calls_per_minute=_int(
                source, "DBTEZ_DATA_CALLS_PER_MINUTE", MAX_DATA_CALLS_PER_MINUTE, 1, MAX_DATA_CALLS_PER_MINUTE
            ),
            token_calls_per_minute=_int(
                source, "DBTEZ_TOKEN_CALLS_PER_MINUTE", MAX_TOKEN_CALLS_PER_MINUTE, 1, MAX_TOKEN_CALLS_PER_MINUTE
            ),
            sample_rows_per_month=_sample(source, "DBTEZ_SAMPLE_ROWS_PER_MONTH", 1000, MAX_PAGE_SIZE),
            sample_months=_sample(source, "DBTEZ_SAMPLE_MONTHS", 6, 19),
            # ZingHR is keyed and small, so it is always read in full by default. A sample here leaves most
            # Project Track people without an HR match and shows wrong profiles.
            sample_hr_rows=_sample(source, "DBTEZ_SAMPLE_HR_ROWS", 100, MAX_PAGE_SIZE),
            pt_fields=ProjectTrackFields.from_env(source),
        )

    def require_project_track_object(self) -> str:
        if not self.project_track_object:
            raise ConfigError("DBTEZ_PROJECT_TRACK_OBJECT is not set")
        return self.project_track_object

    def require_zinghr_object(self) -> str:
        if not self.zinghr_object:
            raise ConfigError("DBTEZ_ZINGHR_OBJECT is not set")
        return self.zinghr_object


def _validated_base_url(raw: str) -> str:
    parsed = urlparse(raw)
    host = (parsed.hostname or "").lower()
    if not host:
        raise ConfigError("DBTEZ_BASE_URL is not a valid URL")
    if parsed.scheme != "https" and not (parsed.scheme == "http" and host in _LOCAL_HOSTS):
        raise ConfigError("DBTEZ_BASE_URL must use https")
    if parsed.username or parsed.password:
        raise ConfigError("DBTEZ_BASE_URL must not contain credentials")
    if parsed.query or parsed.fragment:
        raise ConfigError("DBTEZ_BASE_URL must not contain a query or fragment")
    return raw.rstrip("/")


def _optional_object(env: Mapping[str, str], name: str) -> str | None:
    raw = (env.get(name) or "").strip()
    if not raw:
        return None
    if not _OBJECT_NAME.match(raw):
        raise ConfigError(f"{name} is not a valid object name")
    return raw


def _int(env: Mapping[str, str], name: str, default: int, low: int, high: int) -> int:
    raw = (env.get(name) or "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        raise ConfigError(f"{name} must be an integer") from None
    if not low <= value <= high:
        raise ConfigError(f"{name} must be between {low} and {high}")
    return value


def _sample(env: Mapping[str, str], name: str, default: int, high: int) -> int | None:
    """A positive number turns the limit on; 0, 'off', 'none' or 'full' turns it off (load everything)."""
    raw = (env.get(name) or "").strip().lower()
    if not raw:
        return default or None
    if raw in ("0", "off", "none", "full", "false"):
        return None
    return _int(env, name, default, 1, high)


def validate_object_name(name: str) -> str:
    """Object names are placed into a URL path, so they are restricted to a safe alphabet."""
    if not _OBJECT_NAME.match(name or ""):
        raise ConfigError("Invalid object name")
    return name
