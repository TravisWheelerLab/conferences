#!/usr/bin/env python3
"""Move conferences whose end date has passed into the archive.

Ended conferences are removed from data/conferences.json (so the upcoming list
and the weekly re-verify stay lean) and appended to data/archive.json, which the
site loads to populate its "Past conferences" section. This keeps a permanent
history instead of deleting past meetings. Refreshes the `updated` field.

Usage:
    python scripts/prune.py            # archive past conferences using today
    python scripts/prune.py --dry-run  # report what would be archived
"""

import argparse
import datetime as dt
import json
import pathlib
import sys

DATA_DIR = pathlib.Path(__file__).resolve().parent.parent / "data"
CONFERENCES = DATA_DIR / "conferences.json"
ARCHIVE = DATA_DIR / "archive.json"


def load(path, default):
    try:
        return json.loads(path.read_text())
    except FileNotFoundError:
        return default


def key(conf):
    # Identity for de-duping between the live list and the archive.
    return (conf.get("name", "").strip().lower(), conf.get("start", ""))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    today = dt.date.today()
    doc = load(CONFERENCES, {"conferences": []})
    confs = doc.get("conferences", [])

    kept, ended = [], []
    for c in confs:
        try:
            end = dt.date.fromisoformat(c["end"])
        except (KeyError, ValueError):
            # No/invalid end date: keep it so a human can fix it rather than
            # silently moving data.
            kept.append(c)
            continue
        (kept if end >= today else ended).append(c)

    for c in ended:
        print(f"archiving (ended {c.get('end')}): {c.get('name')}")

    if not ended:
        print("nothing to archive")
        return 0

    if args.dry_run:
        print(f"[dry-run] would archive {len(ended)} conference(s)")
        return 0

    # Merge into the archive, de-duping, newest first.
    archive_doc = load(
        ARCHIVE,
        {
            "_readme": "Conferences that have ended, moved here by scripts/prune.py "
            "so the site's 'Past conferences' section keeps a history. Newest first.",
            "conferences": [],
        },
    )
    archived = archive_doc.get("conferences", [])
    seen = {key(c) for c in archived}
    for c in ended:
        if key(c) not in seen:
            archived.append(c)
            seen.add(key(c))
    archived.sort(key=lambda c: c.get("start", ""), reverse=True)
    archive_doc["conferences"] = archived

    doc["conferences"] = kept
    doc["updated"] = today.isoformat()

    CONFERENCES.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n")
    ARCHIVE.write_text(json.dumps(archive_doc, indent=2, ensure_ascii=False) + "\n")
    print(f"archived {len(ended)} conference(s); {len(kept)} upcoming remain")
    return 0


if __name__ == "__main__":
    sys.exit(main())
