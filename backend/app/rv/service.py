"""Snapshot loading and caching for the API.

RV_DATA_SOURCE (default dbtez):
  azure      read the precomputed rv2_* tables; reload only when rv2_Meta.Version changes
  azure_raw  recompute from the two source tables in Python (slow; reference/oracle)
  demo       synthetic data, no database
  dbtez      read-only DBTEZ API (Project Track + ZingHR), cached for RV_DBTEZ_CACHE_SECONDS

RV_ALLOWED_SOURCES (default "dbtez"): the sources the dashboard may use and switch between. With one
entry there is no switch. Set "azure,dbtez" to offer both.

The source can also be switched while the app runs (``set_data_source``) among the allowed sources.
"""

from __future__ import annotations

import logging
import os
import threading
import time
from datetime import date, datetime, timezone
from typing import Any

from app.database import DatabaseError, fetch_rows
from app.dbtez import DbtezClient, DbtezDataSource, DbtezError
from app.dbtez.env import is_configured as dbtez_configured
from app.dbtez.env import load_config as load_dbtez_config
from app.rv import engine as e
from app.rv.demo_data import build_demo
from app.rv.estimate import enabled as estimate_enabled
from app.rv.estimate import estimate_unverified
from app.rv.facts import load_snapshot_from_facts, read_meta
from app.rv.sql import HR_EMPLOYEES, PROJECT_TRACK_ROWS

logger = logging.getLogger("resource_vision")
VERSION_CHECK_SECONDS = int(os.environ.get("RV_VERSION_CHECK_SECONDS", "5"))
RAW_CACHE_SECONDS = int(os.environ.get("RV_CACHE_SECONDS", "60"))
DBTEZ_CACHE_SECONDS = int(os.environ.get("RV_DBTEZ_CACHE_SECONDS", "900"))
SWITCHABLE_SOURCES = ("azure", "dbtez")
SOURCE_LABELS = {"azure": "Azure SQL", "dbtez": "DBTEZ API"}

_lock = threading.Lock()
_state: dict[str, Any] = {"snapshot": None, "version": None, "checked": 0.0, "day": None, "meta": {}}
_override: dict[str, str | None] = {"source": None}  # set by the in-app switch


def allowed_sources() -> list[str]:
    raw = os.environ.get("RV_ALLOWED_SOURCES", "dbtez")
    names = [n.strip().lower() for n in raw.split(",") if n.strip().lower() in ("azure", "dbtez")]
    return names or ["dbtez"]


def data_source() -> str:
    return _override["source"] or os.environ.get("RV_DATA_SOURCE", "dbtez").strip().lower()


class DataSourceUnavailable(DatabaseError):
    """The live source could not be loaded. ``str()`` is a safe, operator-readable reason."""


_failure: dict[str, Any] = {"at": 0.0, "message": None}
FAILURE_RETRY_SECONDS = 30


def source_options() -> dict[str, Any]:
    """What the dashboard switch shows. Reveals only whether DBTEZ is configured, never its settings."""
    return {
        "current": data_source(),
        "switch": switch_status(),
        "options": [
            {
                "id": name,
                "label": SOURCE_LABELS[name],
                "available": True if name == "azure" else dbtez_configured(),
            }
            for name in allowed_sources()
        ],
    }


class SourceSwitchError(Exception):
    """The requested source could not be activated. The previous source stays in use."""


_switch: dict[str, Any] = {"status": "idle", "target": None, "error": None, "thread": None}


def switch_status() -> dict[str, Any]:
    return {k: _switch[k] for k in ("status", "target", "error")}


def set_data_source(name: str) -> None:
    """Switch the live source. The new source is loaded first; the live source changes only on success."""
    if name not in SWITCHABLE_SOURCES or name not in allowed_sources():
        raise SourceSwitchError("Unknown data source.")
    if name == "dbtez" and not dbtez_configured():
        raise SourceSwitchError("The DBTEZ API is not configured on the server.")

    with _lock:
        try:
            _reload(date.today(), name)  # updates the snapshot only after a complete, successful load
        except Exception as error:  # noqa: BLE001 - any failure must leave the previous source intact
            logger.exception("Switching the data source to %s failed", name)
            # DbtezError messages are written to be safe (no tokens, bodies or values); others show the type only.
            reason = f"{type(error).__name__}: {error}" if isinstance(error, DbtezError) else type(error).__name__
            raise SourceSwitchError(
                f"{SOURCE_LABELS[name]} could not be loaded ({reason}). The previous source is still in use."
            ) from None
        _override["source"] = name
        _state["checked"] = time.monotonic()


def start_switch(name: str) -> dict[str, Any]:
    """Begin a switch in the background (a full API load can take a minute). Poll ``switch_status``."""
    if name not in SWITCHABLE_SOURCES or name not in allowed_sources():
        raise SourceSwitchError("Unknown data source.")
    if name == "dbtez" and not dbtez_configured():
        raise SourceSwitchError("The DBTEZ API is not configured on the server.")
    if _switch["status"] == "loading":
        raise SourceSwitchError("A data source change is already in progress.")

    def work() -> None:
        try:
            set_data_source(name)
            _switch.update(status="idle", error=None)
        except SourceSwitchError as error:
            _switch.update(status="failed", error=str(error))
        except Exception:  # noqa: BLE001 - never leave the status stuck on "loading"
            _switch.update(status="failed", error="The data source could not be changed.")

    _switch.update(status="loading", target=name, error=None)
    started = switch_status()  # captured before the worker can finish
    thread = threading.Thread(target=work, name="rv-source-switch", daemon=True)
    _switch["thread"] = thread
    thread.start()
    return started


def capacity_hours() -> float:
    return float(os.environ.get("RV_CAPACITY_HOURS", e.CAPACITY_HOURS))


def _load_dbtez(today: date) -> tuple[e.Snapshot, dict[str, Any]]:
    config = load_dbtez_config()
    result = DbtezDataSource(DbtezClient(config), config).load(today)
    snapshot = e.build_snapshot(result.pt_rows, result.hr_rows, today, capacity_hours())
    summary = result.summary()
    summary["estimated_employee_months"] = (
        estimate_unverified(snapshot, capacity_hours()) if estimate_enabled() else 0
    )
    in_window = set(snapshot.window)
    reasons: dict[str, int] = {}
    for row in snapshot.rows:
        if row.named and row.status == e.UNRESOLVED and row.month in in_window:
            key = row.reason or "unresolved"
            reasons[key] = reasons.get(key, 0) + 1
    # Counts only: why employee-months are Unverified.
    summary["unresolved_reasons"] = reasons
    summary["employees_without_hr_match"] = snapshot.data_quality.get("missing_hr_match_employees", 0)
    summary["employees_unverified_now"] = sum(
        1 for (_, month), em in snapshot.employee_months.items() if month == snapshot.window[0] and em.status == e.UNVERIFIED
    )
    return snapshot, summary


def _load_raw(today: date) -> e.Snapshot:
    if data_source() == "demo":
        pt_rows, hr_rows = build_demo(today)
    else:
        pt_rows = fetch_rows(PROJECT_TRACK_ROWS)
        hr_rows = fetch_rows(HR_EMPLOYEES)
    return e.build_snapshot(pt_rows, hr_rows, today, capacity_hours())


def _reload(today: date, source: str | None = None) -> None:
    source = source or data_source()
    if source == "azure":
        snapshot, meta = load_snapshot_from_facts()
        _state.update(snapshot=snapshot, version=int(meta["Version"]), meta={
            "version": int(meta["Version"]),
            "refreshed_utc": meta["RefreshedUtc"].isoformat() if meta["RefreshedUtc"] else None,
            "facts_date": snapshot.today.isoformat(),
            "stale": snapshot.today != today,
        })
    elif source == "dbtez":
        snapshot, summary = _load_dbtez(today)
        _state.update(snapshot=snapshot, version=None, meta={
            "version": None,
            "refreshed_utc": datetime.now(timezone.utc).isoformat(),
            "facts_date": today.isoformat(),
            "stale": False,
            "load_summary": summary,
        })
    else:
        _state.update(snapshot=_load_raw(today), version=None, meta={"version": None, "refreshed_utc": None})
    _state.update(day=today)


def get_snapshot() -> e.Snapshot:
    """Serve the cached snapshot. A reload happens only when the data version changed."""
    today = date.today()
    now = time.monotonic()
    source = data_source()
    interval = VERSION_CHECK_SECONDS if source == "azure" else DBTEZ_CACHE_SECONDS if source == "dbtez" else RAW_CACHE_SECONDS
    if _state["snapshot"] is not None and now - _state["checked"] < interval and _state["day"] == today:
        return _state["snapshot"]
    if _state["snapshot"] is None and _failure["message"] and now - _failure["at"] < FAILURE_RETRY_SECONDS:
        raise DataSourceUnavailable(_failure["message"])  # do not make every request wait for another attempt

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
        except (DatabaseError, DbtezError) as error:
            logger.exception("Resource Vision data load failed")
            if _state["snapshot"] is None:
                # DbtezError messages are safe by construction (no tokens, bodies or values).
                reason = f"{SOURCE_LABELS.get(source, source)} could not be loaded"
                if isinstance(error, DbtezError):
                    reason += f" ({type(error).__name__}: {error})"
                _failure.update(at=time.monotonic(), message=reason)
                raise DataSourceUnavailable(reason) from error
        _failure.update(at=0.0, message=None)
        _state["checked"] = time.monotonic()
        return _state["snapshot"]
    finally:
        _lock.release()


def data_info() -> dict[str, Any]:
    return dict(_state["meta"])
