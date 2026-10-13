from __future__ import annotations

import re
from datetime import date, datetime
from decimal import Decimal
from typing import Any


def normalize_key(key: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", key.strip().lower()).strip("_")


def build_row_index(row: dict[str, Any]) -> dict[str, Any]:
    return {normalize_key(str(key)): value for key, value in row.items()}


def pick(row: dict[str, Any], *candidates: str) -> Any:
    for candidate in candidates:
        normalized = normalize_key(candidate)
        if normalized in row and row[normalized] is not None:
            return row[normalized]
    return None


def as_string(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(value).strip()


def as_float(value: Any, default: float = 0.0) -> float:
    if value is None or value == "":
        return default
    if isinstance(value, (int, float, Decimal)):
        return float(value)
    try:
        return float(str(value).replace(",", "").strip())
    except ValueError:
        return default


def parse_month_key(value: Any) -> str | None:
    if value is None:
        return None

    if isinstance(value, datetime):
        return value.strftime("%Y-%m")

    if isinstance(value, date):
        return value.strftime("%Y-%m")

    text = str(value).strip()
    if text == "":
        return None

    match = re.match(r"^(\d{4})-(\d{2})", text)
    if match:
        return f"{match.group(1)}-{match.group(2)}"

    for pattern in (
        r"^(\d{4})[/-](\d{1,2})[/-](\d{1,2})",
        r"^(\d{1,2})[/-](\d{1,2})[/-](\d{4})",
    ):
        parsed = re.match(pattern, text)
        if parsed:
            groups = parsed.groups()
            if len(groups[0]) == 4:
                year, month = int(groups[0]), int(groups[1])
            else:
                month, year = int(groups[0]), int(groups[2])
            return f"{year:04d}-{month:02d}"

    try:
        parsed_date = datetime.fromisoformat(text.replace("Z", "+00:00"))
        return parsed_date.strftime("%Y-%m")
    except ValueError:
        return None


def month_year(month_key: str) -> int:
    return int(month_key.split("-", maxsplit=1)[0])
