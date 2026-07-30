# Discovery agent instructions

These are the instructions for the scheduled agent that keeps
`data/conferences.json` populated and current. The scheduled routine runs this
against the `TravisWheelerLab/conferences` repo.

---

You maintain the conference list for the Wheeler Lab website. The lab works on
**bioinformatics, machine learning for biology, genomics, comparative genomics,
sequence analysis, transposable elements, and protein structural modeling.**

Read `data/conferences.json`, then pick a **mode** based on the request queue in
`add-conferences.txt` (its URL lines are any line that is non-blank and does not
start with `#`):

- **Queue has URL lines → LIGHTWEIGHT mode.** Only process the queue, then prune
  and commit. Do **not** re-verify existing entries and do **not** web-search
  for new conferences. This keeps on-demand runs (right after someone adds a
  URL) fast and cheap.
- **Queue is empty → HEAVYWEIGHT mode.** Do the full refresh: re-verify every
  entry, prune, and search for new conferences. The weekly scheduled run
  normally lands here, because the queue is usually empty by then.

Both modes finish the same way — see **"Finishing every run"**.

## Lightweight mode — process the request queue

Read `add-conferences.txt`. For each URL line:
- Fetch the page and extract the conference `name`, official `url`, `location`,
  `start`/`end` dates, and paper/poster deadlines, following **"Entry format &
  deadline rules"** below.
- If it is already in `data/conferences.json` (match on name or URL,
  case-insensitive) or its start date is already in the past, skip it.
- Otherwise add a properly formatted entry (verify dates against the page; do
  not invent).
- **Remove every line you successfully handled** (added, or skipped as a
  duplicate / past event) from `add-conferences.txt`.
- If you cannot extract reliable info from a URL, leave that line in the file and
  append `  # could not verify YYYY-MM-DD` so a human can look.

Then run `python3 scripts/prune.py` and finish. **Stop here** — do not re-verify
other entries or run discovery.

## Heavyweight mode — full refresh

1. **Re-verify every existing entry.** For each conference already in the file,
   check its official site and update anything that changed: confirmed dates
   replacing estimates, newly announced deadlines (`"TBD"` → a real date),
   corrected locations or URLs, and deadlines that have `passed`. Remove any
   `(TBC)` / estimate wording once real dates are confirmed.
2. Run `python3 scripts/prune.py` to drop conferences that have already ended.
3. Use web search to find conferences and workshops in the lab's topics whose
   **start date is within the next 12 months** and that are **not already in the
   file** — work through the Watchlist below.
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
