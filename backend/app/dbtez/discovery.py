"""Object schema discovery. Only field names are read, never data values."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.dbtez.client import DbtezClient
from app.dbtez.errors import SchemaError, SchemaShapeError


@dataclass(frozen=True)
class ObjectSchema:
    name: str
    columns: tuple[str, ...]
    key_columns: tuple[str, ...]

    def missing(self, required: list[str]) -> list[str]:
        have = set(self.columns)
        return [c for c in required if c not in have]

    def require(self, required: list[str]) -> None:
        missing = self.missing(required)
        if missing:
            raise SchemaError(f"Object '{self.name}' is missing required fields: " + ", ".join(missing))


def discover(client: DbtezClient, object_name: str) -> ObjectSchema:
    return parse_schema(object_name, client.describe_object(object_name))


def list_object_names(client: DbtezClient) -> list[str]:
    payload = client.list_objects()
    items = payload.get("objects") if isinstance(payload, dict) else payload
    if not isinstance(items, list):
        raise SchemaError("Unrecognised object list shape")
    names = []
    for item in items:
        if isinstance(item, str):
            name = item
        elif isinstance(item, dict):
            name = item.get("object") or item.get("name")  # Client Guide 2.2 uses "object"
        else:
            name = None
        if isinstance(name, str) and name:
            names.append(name)
    return names


def _lower(d: dict) -> dict:
    return {str(k).lower(): v for k, v in d.items()}


def parse_schema(object_name: str, payload: Any) -> ObjectSchema:
    """Accepts the common shapes defensively: columns as a list of names, a list of
    {name, type, is_key} objects, or a name-to-type mapping; key names under several spellings.

    If the shape is unrecognised the error names only the top-level keys, never values.
    """
    if not isinstance(payload, dict):
        raise SchemaShapeError("Unrecognised object schema shape")
    top = _lower(payload)

    raw_columns = None
    for field in ("columns", "fields"):
        if isinstance(top.get(field), (list, dict)):
            raw_columns = top[field]
            break
    if raw_columns is None:
        raise SchemaShapeError("Unrecognised object schema shape; keys: " + ", ".join(sorted(map(str, payload))))

    columns: list[str] = []
    flagged_keys: list[str] = []
    if isinstance(raw_columns, dict):
        columns = [str(k) for k in raw_columns]
    else:
        for item in raw_columns:
            if isinstance(item, str):
                columns.append(item)
            elif isinstance(item, dict):
                low = _lower(item)
                name = next((low[k] for k in ("name", "column", "column_name") if isinstance(low.get(k), str)), None)
                if name:
                    columns.append(name)
                    if any(low.get(k) is True for k in ("is_key", "key", "primary_key")):
                        flagged_keys.append(name)

    declared: list[str] = []
    for field in ("key_columns", "keys", "key", "primary_key", "declared_key"):
        value = top.get(field)
        if isinstance(value, str) and value:
            declared = [value]
            break
        if isinstance(value, list):
            names = [v if isinstance(v, str) else _lower(v).get("name") for v in value if isinstance(v, (str, dict))]
            declared = [v for v in names if isinstance(v, str) and v]
            if declared:
                break

    return ObjectSchema(object_name, tuple(columns), tuple(declared or flagged_keys))
