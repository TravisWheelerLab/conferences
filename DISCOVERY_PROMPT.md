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

- **LIGHTWEIGHT** (the hourly schedule) — only process the two request queues:
  `add-conferences.txt` (new conferences) and `edit-requests.txt` (changes to
  existing ones). **If both queues have no request lines, make no changes and
  exit without committing.** Never re-verify existing entries and never
  web-search for new conferences beyond what a queued line asks for. This is
  cheap enough to run every hour.
- **HEAVYWEIGHT** (the weekly schedule) — do the full refresh: re-verify every
  entry, prune, and search for new conferences, and also drain both queues.

If no mode is stated (e.g. a manual run), default to **lightweight when either
queue has lines, heavyweight when both are empty.**

A "request line" in either file is any line that is non-blank and does not start
with `#`. Both modes finish the same way — see **"Finishing every run"**.

## Lightweight mode — process the request queue

Read `add-conferences.txt`. Each non-blank line that does not start with `#` is a
**request**, and is one of two kinds:
- a **URL** (starts with `http://` or `https://`) — fetch the page and extract
  the details from it.
- a **free-text description** — e.g.
  `Asilomar Repbase/Dfam retreat - Sept 13-16 at Asilomar (Monterey)`. **This is
  the user directly telling you the facts — treat what they wrote as
  authoritative and sufficient to create an entry, even if there is no official
  web page.** Pull out the name, dates, and location from the text. You MAY search
  the web to fill in a URL and submission deadlines, but **a missing official URL
  is NOT a reason to skip** — leave `url` as `""` and deadlines as `"TBD"`/`"N/A"`
  if you can't find them. If no year is given, assume the next occurrence within
  the 12-month window. Only decline a description that lacks the basics to form an
  entry (no identifiable name, or no dates you can resolve to `start`/`end`).

**If there are no request lines, stop now and make no commit.** Otherwise, for
each request line:
- Extract the conference `name`, `url` (may be `""` for a hand-described event),
  `location`, `start`/`end` dates, and paper/poster deadlines, following
  **"Entry format & deadline rules"** below.
- Skip it if it is already in `data/conferences.json` (match on name or URL,
  case-insensitive), if it matches an entry in `data/hidden.json` (the user
  removed it on purpose — do not re-add), or if its start date is already past.
- Otherwise add a properly formatted entry. For a **URL** request, verify the
  dates against the page. For a **free-text** request, the user's stated dates are
  the source — use them as given (don't discard the request just because you can't
  find a corroborating page). Never fabricate details the user didn't provide.
- **Remove every line you successfully handled** (added, or skipped as a
  duplicate / hidden / past event) from `add-conferences.txt`.
- Only if a request is genuinely unusable (e.g. no resolvable dates) leave that
  line in the file and append `  # could not verify YYYY-MM-DD` so a human can look.

### Edit requests

Read `edit-requests.txt`. Each request line is a conference name followed by a
plain-English change, e.g.
`Genome Informatics 2026 — poster deadline should be October 5, 2026`. For each:
- Find the matching entry in `data/conferences.json` (match the leading name,
  case-insensitively; it need not be exact). If none matches, leave the line with
  `  # no match YYYY-MM-DD` and move on.
- Apply the requested change to that entry. The user is correcting the data, so
  **treat their stated value as authoritative** — but you may quickly confirm it
  against the official site, and should format dates like the other entries
  (e.g. `"October 5, 2026"`). Do not change fields the request didn't mention.
- If a change is genuinely implausible (e.g. a date outside the event), don't
  guess — leave the line with `  # please clarify YYYY-MM-DD`.
- **Remove every line you successfully applied.**

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
4. Also drain both queues exactly as in Lightweight mode — `add-conferences.txt`
   (new conferences) and `edit-requests.txt` (edits) — clearing the lines you
   handle.

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
