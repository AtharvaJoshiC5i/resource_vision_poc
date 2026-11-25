"""Operator check for the DBTEZ integration. Run by an authorised person, on their own machine.

    python scripts/dbtez_operator_check.py            # health, schema and field checks
    python scripts/dbtez_operator_check.py --counts   # also fetch the window and print counts

Reads DBTEZ_* from the shell environment (never from a file). Makes only read calls.
Prints status words, counts and field NAMES. It never prints tokens, credentials, identity
details, response bodies or any field value, and it writes no files.
"""

from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.dbtez import DbtezClient, DbtezConfig, DbtezDataSource, DbtezError  # noqa: E402
from app.dbtez.discovery import list_object_names  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--counts", action="store_true", help="fetch the 19-month window and print counts only")
    args = parser.parse_args()

    try:
        config = DbtezConfig.from_env()
        client = DbtezClient(config)
        source = DbtezDataSource(client, config)

        client.health()
        print("health: ok")
        client.me()
        print("credential: accepted")

        names = list_object_names(client)
        print(f"objects visible: {len(names)}")
        for label, wanted in (("project track", config.require_project_track_object()), ("zinghr", config.require_zinghr_object())):
            print(f"{label} object present: {'yes' if wanted in names else 'NO'}")

        report = source.verify_schemas()
        for label, info in report.items():
            print(f"{label}: declared key = {info['declared_key'] or 'none'}")
            print(f"{label}: requested fields missing from the object = {info['missing_requested'] or 'none'}")

        if args.counts:
            result = source.load(date.today())
            for name, value in result.summary().items():
                print(f"{name}: {value}")
            print("calls per month: " + ", ".join(f"{k}={v}" for k, v in sorted(result.month_calls.items())))
        print("done")
        return 0
    except DbtezError as exc:
        print(f"FAILED: {type(exc).__name__}: {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
