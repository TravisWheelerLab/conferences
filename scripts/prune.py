#!/usr/bin/env python3
"""Remove conferences whose end date has already passed.

Rewrites data/conferences.json in place, keeping only conferences whose `end`
date is today or later, and refreshes the `updated` field. Run on a schedule so
the site never shows meetings that are already over.

Usage:
    python scripts/prune.py            # prune using today's date
    python scripts/prune.py --dry-run  # report what would be removed
"""

import argparse
import datetime as dt
import json
import pathlib
import sys

DATA = pathlib.Path(__file__).resolve().parent.parent / "data" / "conferences.json"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    today = dt.date.today()
    doc = json.loads(DATA.read_text())
    confs = doc.get("conferences", [])

    kept, removed = [], []
    for c in confs:
        try:
            end = dt.date.fromisoformat(c["end"])
        except (KeyError, ValueError):
            # No/invalid end date: keep it so a human can fix it rather than
            # silently dropping data.
            kept.append(c)
            continue
        (kept if end >= today else removed).append(c)

    for c in removed:
        print(f"removing (ended {c.get('end')}): {c.get('name')}")

    if not removed:
        print("nothing to prune")
        return 0

    if args.dry_run:
        print(f"[dry-run] would remove {len(removed)} conference(s)")
        return 0

    doc["conferences"] = kept
    doc["updated"] = today.isoformat()
    DATA.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n")
    print(f"pruned {len(removed)} conference(s); {len(kept)} remain")
    return 0


if __name__ == "__main__":
    sys.exit(main())
