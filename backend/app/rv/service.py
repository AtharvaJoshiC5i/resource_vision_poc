"""Snapshot loading and caching for the API.

RV_DATA_SOURCE:
  azure      (default) read the precomputed rv2_* tables; reload only when rv2_Meta.Version changes
  azure_raw  recompute from the two source tables in Python (slow; reference/oracle)
  demo       synthetic data, no database
"""

from __future__ import annotations

import logging
import os
import threading
import time
from datetime import date
from typing import Any

from app.database import DatabaseError, fetch_rows
from app.rv import engine as e
from app.rv.demo_data import build_demo
from app.rv.facts import load_snapshot_from_facts, read_meta
from app.rv.sql import HR_EMPLOYEES, PROJECT_TRACK_ROWS

logger = logging.getLogger("resource_vision")
VERSION_CHECK_SECONDS = int(os.environ.get("RV_VERSION_CHECK_SECONDS", "5"))
RAW_CACHE_SECONDS = int(os.environ.get("RV_CACHE_SECONDS", "60"))

_lock = threading.Lock()
_state: dict[str, Any] = {"snapshot": None, "version": None, "checked": 0.0, "day": None, "meta": {}}


def data_source() -> str:
    return os.environ.get("RV_DATA_SOURCE", "azure").strip().lower()


def capacity_hours() -> float:
    return float(os.environ.get("RV_CAPACITY_HOURS", e.CAPACITY_HOURS))


def _load_raw(today: date) -> e.Snapshot:
    if data_source() == "demo":
        pt_rows, hr_rows = build_demo(today)
    else:
        pt_rows = fetch_rows(PROJECT_TRACK_ROWS)
        hr_rows = fetch_rows(HR_EMPLOYEES)
    return e.build_snapshot(pt_rows, hr_rows, today, capacity_hours())


def _reload(today: date) -> None:
    if data_source() == "azure":
        snapshot, meta = load_snapshot_from_facts()
        _state.update(snapshot=snapshot, version=int(meta["Version"]), meta={
            "version": int(meta["Version"]),
            "refreshed_utc": meta["RefreshedUtc"].isoformat() if meta["RefreshedUtc"] else None,
            "facts_date": snapshot.today.isoformat(),
            "stale": snapshot.today != today,
        })
    else:
        _state.update(snapshot=_load_raw(today), version=None, meta={"version": None, "refreshed_utc": None})
    _state.update(day=today)


def get_snapshot() -> e.Snapshot:
    """Serve the cached snapshot. A reload happens only when the data version changed."""
    today = date.today()
    now = time.monotonic()
    interval = VERSION_CHECK_SECONDS if data_source() == "azure" else RAW_CACHE_SECONDS
    if _state["snapshot"] is not None and now - _state["checked"] < interval and _state["day"] == today:
        return _state["snapshot"]

    # Only one caller does the check/reload; others keep using the previous snapshot.
    if not _lock.acquire(blocking=_state["snapshot"] is None):
        return _state["snapshot"]
    try:
        try:
            if data_source() == "azure":
                meta = read_meta()
                changed = meta is None or int(meta["Version"]) != _state["version"] or _state["day"] != today
            else:
                changed = True
            if changed or _state["snapshot"] is None:
                _reload(today)
        except DatabaseError:
            logger.exception("Resource Vision data load failed")
            if _state["snapshot"] is None:
                raise
        _state["checked"] = time.monotonic()
        return _state["snapshot"]
    finally:
        _lock.release()


def data_info() -> dict[str, Any]:
    return dict(_state["meta"])
