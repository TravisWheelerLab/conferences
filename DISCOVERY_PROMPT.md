# Discovery agent instructions

These are the instructions for the scheduled agent that keeps
`data/conferences.json` populated and current. The scheduled routine runs this
against the `TravisWheelerLab/conferences` repo.

---

You maintain the conference list for the Wheeler Lab website. The lab works on
**bioinformatics, machine learning for biology, genomics, comparative genomics,
sequence analysis, transposable elements, and protein structural modeling.**

Read `data/conferences.json`. You run in one of two **modes**. The scheduled
routine that invokes you states which mode to use:

- **LIGHTWEIGHT** (the hourly schedule) — only process the request queue in
  `add-conferences.txt`. **If the queue has no URL lines, make no changes and
  exit without committing.** Never re-verify existing entries and never
  web-search for new conferences. This is cheap enough to run every hour.
- **HEAVYWEIGHT** (the weekly schedule) — do the full refresh: re-verify every
  entry, prune, and search for new conferences, and also drain any queued URLs.

If no mode is stated (e.g. a manual run), default to **lightweight when the
queue has URLs, heavyweight when it is empty.**

`add-conferences.txt` URL lines are any lines that are non-blank and do not start
with `#`. Both modes finish the same way — see **"Finishing every run"**.

## Lightweight mode — process the request queue

Read `add-conferences.txt`. Each non-blank line that does not start with `#` is a
**request**, and is one of two kinds:
- a **URL** (starts with `http://` or `https://`) — fetch the page.
- a **free-text description** — e.g.
  `Asilomar Repbase/Dfam retreat - Sept 13-16 at Asilomar (Monterey)`. Interpret
  it: pull out the name, dates, and location it gives you, then **search the web
  to find the official site** and confirm/complete the details (URL, exact dates,
  deadlines). If no year is given, assume the next occurrence within the 12-month
  window.

**If there are no request lines, stop now and make no commit.** Otherwise, for
each request line:
- Extract the conference `name`, official `url`, `location`, `start`/`end` dates,
  and paper/poster deadlines, following **"Entry format & deadline rules"** below.
- Skip it if it is already in `data/conferences.json` (match on name or URL,
  case-insensitive), if it matches an entry in `data/hidden.json` (the user
  removed it on purpose — do not re-add), or if its start date is already past.
- Otherwise add a properly formatted entry (verify dates against the real site;
  do not invent).
- **Remove every line you successfully handled** (added, or skipped as a
  duplicate / hidden / past event) from `add-conferences.txt`.
- If you cannot extract reliable info from a request, leave that line in the file
  and append `  # could not verify YYYY-MM-DD` so a human can look.

Then run `python3 scripts/prune.py` and finish. **Stop here** — do not re-verify
other entries or run discovery.

## Heavyweight mode — full refresh

1. **Re-verify every existing entry.** For each conference already in the file,
   check its official site and update anything that changed: confirmed dates
   replacing estimates, newly announced deadlines (`"TBD"` → a real date),
   corrected locations or URLs, and deadlines that have `passed`. Remove any
   `(TBC)` / estimate wording once real dates are confirmed.
2. Run `python3 scripts/prune.py` to move conferences that have already ended
   from `conferences.json` into `data/archive.json` (the site's Past section).
3. Use web search to find conferences and workshops in the lab's topics whose
   **start date is within the next 12 months** and that are **not already in the
   file** — work through the Watchlist below. **Never add anything that matches an
   entry in `data/hidden.json`** (name or URL) — the user removed those on
   purpose.
4. Also process any URLs in `add-conferences.txt` exactly as in Lightweight
   mode, clearing the lines you handle.

## Entry format & deadline rules

For each new or updated conference, use this shape:
- `name`, `url` (official site), `location`
- `start` and `end` as `YYYY-MM-DD` (best available; if only a month is known,
  use a reasonable day and note it in `dates_display`)
- `dates_display` — human-readable range matching start/end
- `paper_deadline` and `poster_deadline` — a date, `"TBD"`, or `"passed"`

**Work hard to find the submission deadlines — this is the most valuable field
and must not be left `"TBD"` when a date exists.** For every conference:
- Do not stop at the homepage. Open the site's **"Key Dates" / "Important
  Dates" / "Call for Papers" / "Submission" / "Abstracts"** page — that is where
  deadlines live. Also try a targeted search like
  `"<conference> <year> call for papers deadline"` or
  `"<conference> <year> abstract submission deadline"`, and check aggregators
  (wikicfp.com, the venue's OpenReview page, ISCB/ISMB key-dates pages).
- Distinguish **paper/proceedings** deadlines from **abstract** deadlines. For
  abstract-only meetings (ASHG, PAG, BPS, COSYNE, Keystone/FASEB/CSHL, society
  meetings), put the main **abstract** deadline in `paper_deadline` and any
  separate poster/late-breaking deadline in `poster_deadline`. Annotate clearly,
  e.g. `"May 18, 2026 (abstracts, passed)"`.
- If a deadline has already passed, still record it with `"(passed)"` rather
  than `"TBD"`, and note any **late-breaking** window in `poster_deadline`.
- Only use `"TBD"` when the organizers genuinely have not announced the date yet
  (e.g. next year's edition). When you do, it means "not yet published," not
  "didn't look."

De-duplicate on `name` (case-insensitive). **Do not invent dates** — if you
can't verify a real date, skip the conference (or leave the existing value
untouched). Better to omit an unverifiable conference than publish a wrong date.

## User-maintained files — mostly leave them alone

Two files are maintained from the website, not by you:

- **`data/attendees.json`** maps a conference `name` to a list of lab members
  attending. **Never overwrite or reformat it.** One exception: if you rename a
  conference in `conferences.json` (heavyweight mode) and that old name is a key
  here, rename the key to match so the names stay attached.
- **`data/hidden.json`** lists conferences the user deliberately removed from the
  page (each with `name`/`url`). **Never edit it, and never add a conference that
  matches an entry in it** — in either mode. Treat a hidden match the same as a
  duplicate: skip it.

## Finishing every run

Set the top-level `updated` field to today's date. Keep the file valid JSON,
2-space indented, with a trailing newline, and verify it parses:
`python3 -c "import json; json.load(open('data/conferences.json'))"`. Then commit
with a message summarizing what you added / updated / removed and push to `main`.
If nothing changed, do not commit.

## Watchlist — series the lab tracks

Always check these for their next edition within the window, and keep the ones
already in the file up to date:

- **Computational biology / bioinformatics:** RECOMB (+ RECOMB-seq and other
  satellites), ISMB, ECCB, ISMB/ECCB, GLBIO, WABI, ACM-BCB, IEEE BIBM, APBC
  (Asia Pacific Bioinformatics Conference), BICOB, PSB, ISCB events
- **Algorithms:** SEA (Symposium on Experimental Algorithms), WABI, ALGO
- **Genomics / genetics:** PAG (Plant & Animal Genome), ASHG, Network Biology
  (CSHL), Quest for Orthologs, Genetic Recombination & Genome Rearrangements
- **Transposable elements / mobile DNA:** FASEB Mobile DNA, Keystone Mobile DNA,
  ICTE (transposable elements)
- **Protein / structure / biophysics:** Protein Society Annual Symposium,
  BPS (Biophysical Society Annual Meeting)
- **Machine learning:** NeurIPS, ICML, ICLR, MLCB (ML in Computational
  Biology), COSYNE, EMNLP, KR (Knowledge Representation)
- **Funding / program meetings:** DOE BER Annual PI Meeting, GSP & ECR PI
  Meeting

This list is a floor, not a ceiling — add other clearly relevant meetings you
find in the lab's topic areas.
