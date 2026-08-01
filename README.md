# Wheeler Lab — Conferences

A lightweight, self-updating list of upcoming conferences and workshops relevant
to the Wheeler Lab: bioinformatics, ML for biology, genomics, and protein
structural modeling.

**Live site:** https://wheelerlab.org/conferences/

## How it works

- **`data/conferences.json`** is the single source of truth. Each entry has a
  machine-readable `start`/`end` (ISO dates, used for sorting and pruning), a
  human-readable `dates_display`, plus `name`, `url`, `location`,
  `paper_deadline`, and `poster_deadline`.
- **`index.html` / `app.js` / `style.css`** render the data as a static page.
  The page splits entries into *Upcoming* (end date ≥ today) and a collapsed
  *Past* section entirely in the browser — no build step.
- **`scripts/prune.py`** moves entries whose `end` date has passed out of
  `conferences.json` and into **`data/archive.json`**, which the page loads for
  its *Past conferences* section, and refreshes the `updated` field.

## Automation

1. **Archiving** — `.github/workflows/prune.yml` runs `prune.py` weekly (Mondays)
   and commits the result, so the Upcoming list never shows finished meetings
   (they move to `data/archive.json` for the Past section). It can also be run on
   demand from the repo's **Actions** tab.
2. **Discovery** — a scheduled Claude agent runs every two weeks, searches the
   web for new relevant conferences within the next ~12 months, adds them to
   `data/conferences.json` (de-duplicating on name), and commits directly. See
   `DISCOVERY_PROMPT.md` for the exact instructions it follows.

## Adding a conference

Easiest: click **+ Add a conference** on the site. Paste a **URL** or type a
**short description** (e.g. `Asilomar Repbase/Dfam retreat - Sept 13-16 at
Asilomar (Monterey)`) — one per line, mix freely — and submit. Each line is
appended to **`add-conferences.txt`**; on its next run (hourly) the discovery
agent fetches URLs, interprets descriptions, verifies details against the real
site, adds an entry to `data/conferences.json`, and removes the line. (The button
uses the same GitHub token as attendees.)

You can also edit `add-conferences.txt` directly and commit — same result. To
process immediately instead of waiting, open the routine at
https://claude.ai/code/routines and click **Run now**.

## Removing a conference

Click the **✕** at the end of a conference's row and confirm. Its name/URL is
added to **`data/hidden.json`**; the page hides anything listed there, and the
discovery agent won't re-add it. To bring it back, delete its entry from
`data/hidden.json`.

## Adding attendees

The **Attending** column lists lab members going to each upcoming meeting. Add
yourself right from the site: click **+ Add** in a conference's row, type a name,
and Save. The change is committed to **`data/attendees.json`** and appears on the
page within ~1 minute.

The first time you add someone, the page asks for a GitHub **fine-grained
personal access token** with *Contents: Read and write* on this repo. It is
stored only in your browser (localStorage) and sent only to GitHub — never
embedded in the page. Use the footer **GitHub token…** link to change or clear
it. You can also edit `data/attendees.json` by hand (keys are conference names,
matched case-insensitively).

## Editing by hand

Add or correct an entry directly in `data/conferences.json` and commit. Keep
`start`/`end` as valid `YYYY-MM-DD` dates so sorting and pruning work.

## Local preview

```sh
python3 -m http.server 8000
# then open http://localhost:8000/
```
