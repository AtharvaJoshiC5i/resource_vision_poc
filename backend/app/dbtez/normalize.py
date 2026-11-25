"""Value cleaning shared by the Project Track and ZingHR mappers.

Nothing here logs or raises with the offending value; callers only count problems.
"""

from __future__ import annotations

import math
import re
from datetime import date, datetime
from typing import Any, Callable

MAX_CODE_LENGTH = 100
_CONTROL = re.compile(r"[\x00-\x1f\x7f]")

EmployeeKeyFn = Callable[[str], str]


def default_employee_key(code: str) -> str:
    """Match key for an already-cleaned employee code.

    ASSUMPTION TO VERIFY: the production rule is the SQL function dbo.rv_Key, whose definition is
    not in this repository. Until the operator confirms it matches, supply ``key_fn`` explicitly.
    """
    return code.upper()


def clean_text(value: Any) -> str | None:
    """Trim; blank and the literal text 'null' become None (same catalog rule as the engine)."""
    if value is None or isinstance(value, (dict, list, bool)):
        return None
    text = str(value).strip()
    if text == "" or text.lower() == "null":
        return None
    return text


def clean_employee_code(value: Any) -> tuple[str | None, bool]:
    """Returns (code, was_invalid). A blank code is missing, not invalid.

    Invalid means present but unusable as an identifier: not a scalar, too long, or containing
    control characters. Invalid codes are treated as missing and only counted, never echoed.
    """
    if value is None:
        return None, False
    if isinstance(value, (dict, list, bool)):
        return None, True
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None, True
        value = int(value) if value.is_integer() else value
    text = str(value).strip()
    if text == "" or text.lower() == "null":
        return None, False
    if len(text) > MAX_CODE_LENGTH or _CONTROL.search(text):
        return None, True
    return text, False


def parse_int(value: Any) -> int | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value) if value.is_integer() and math.isfinite(value) else None
    text = str(value).strip()
    if re.fullmatch(r"[+-]?\d+", text):
        return int(text)
    if re.fullmatch(r"[+-]?\d+\.0+", text):
        return int(float(text))
    return None


def parse_effort(value: Any) -> float | None:
    if isinstance(value, bool) or value is None:
        return None
    try:
        number = float(str(value).strip()) if not isinstance(value, (int, float)) else float(value)
    except ValueError:
        return None
    return number if math.isfinite(number) else None


def parse_bool(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)) and value in (0, 1):
        return bool(value)
    if isinstance(value, str):
        text = value.strip().lower()
        if text in ("1", "true", "yes", "y"):
            return True
        if text in ("0", "false", "no", "n"):
            return False
    return None


_DATE_FORMATS = (
    "%Y-%m-%d",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%d %H:%M:%S",
    "%B, %d %Y %H:%M:%S",  # ColdFusion long date
    "%B, %d %Y",
    "%d-%m-%Y",  # day first: ASSUMPTION for text dates; unparseable ones are counted, never guessed
    "%d/%m/%Y",
    "%d-%m-%Y %H:%M:%S",
    "%d/%m/%Y %H:%M:%S",
    "%d-%b-%Y",
    "%d %b %Y",
)


def parse_date(value: Any) -> date | None:
    if value is None or isinstance(value, bool):
        return None
    text = str(value).strip()
    if text == "" or text.lower() == "null":
        return None
    text = re.sub(r"(?<=:\d{2})(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$", "", text)  # only after a time
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None
