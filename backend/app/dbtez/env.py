"""Where the running backend finds its DBTEZ settings.

Process environment variables win. Otherwise the DBTEZ_* lines of ``backend/.env`` are used,
the same file the backend already loads for its database settings. Values are never printed.
Tests pass an explicit mapping and never call this with the real file.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Mapping

from app.dbtez.config import DbtezConfig
from app.dbtez.errors import ConfigError

DEFAULT_ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


def dbtez_environment(env_file: Path | str | None = None, environ: Mapping[str, str] | None = None) -> dict[str, str]:
    values: dict[str, str] = {}
    path = Path(env_file) if env_file else DEFAULT_ENV_FILE
    try:
        from dotenv import dotenv_values

        values.update({k: v for k, v in dotenv_values(path).items() if k.startswith("DBTEZ_") and v})
    except Exception:  # a missing or unreadable file simply means "not configured here"
        pass
    source = os.environ if environ is None else environ
    values.update({k: v for k, v in source.items() if k.startswith("DBTEZ_") and v})
    return values


def load_config(env: Mapping[str, str] | None = None) -> DbtezConfig:
    return DbtezConfig.from_env(dbtez_environment() if env is None else env)


def is_configured(env: Mapping[str, str] | None = None) -> bool:
    """True when credentials and both object names are present and valid. Reveals nothing else."""
    try:
        config = load_config(env)
        config.require_project_track_object()
        config.require_zinghr_object()
        return True
    except ConfigError:
        return False
