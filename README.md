# Wheeler Lab — Conferences

A lightweight, self-updating list of upcoming conferences and workshops relevant
to the Wheeler Lab: bioinformatics, ML for biology, genomics, and protein
structural modeling.

**Live site:** https://traviswheelerlab.github.io/conferences/

## How it works

- **`data/conferences.json`** is the single source of truth. Each entry has a
  machine-readable `start`/`end` (ISO dates, used for sorting and pruning), a
  human-readable `dates_display`, plus `name`, `url`, `location`,
  `paper_deadline`, and `poster_deadline`.
- **`index.html` / `app.js` / `style.css`** render the data as a static page.
  The page splits entries into *Upcoming* (end date ≥ today) and a collapsed
  *Past* section entirely in the browser — no build step.
- **`scripts/prune.py`** removes entries whose `end` date has passed and
  refreshes the `updated` field.

## Automation

1. **Pruning** — `.github/workflows/prune.yml` runs `prune.py` weekly (Mondays)
   and commits the result, so the site never shows finished meetings. It can
   also be run on demand from the repo's **Actions** tab.
2. **Discovery** — a scheduled Claude agent runs every two weeks, searches the
   web for new relevant conferences within the next ~12 months, adds them to
   `data/conferences.json` (de-duplicating on name), and commits directly. See
   `DISCOVERY_PROMPT.md` for the exact instructions it follows.

## Editing by hand

Add or correct an entry directly in `data/conferences.json` and commit. Keep
`start`/`end` as valid `YYYY-MM-DD` dates so sorting and pruning work.

## Local preview

```sh
python3 -m http.server 8000
# then open http://localhost:8000/
```
