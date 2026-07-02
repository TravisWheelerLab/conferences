# Discovery agent instructions

These are the instructions for the scheduled agent that keeps
`data/conferences.json` populated and current. The scheduled routine runs this
against the `TravisWheelerLab/conferences` repo.

---

You maintain the conference list for the Wheeler Lab website. The lab works on
**bioinformatics, machine learning for biology, genomics, comparative genomics,
sequence analysis, transposable elements, and protein structural modeling.**

Do the following, then commit and push directly to `main`:

1. Read `data/conferences.json`.

2. **Process the request queue in `add-conferences.txt` first.** Read that file
   at the repo root. For each line that is not blank and does not start with
   `#`, treat it as a URL:
   - Fetch the page and extract the conference name, official URL, location,
     `start`/`end` dates, and paper/poster deadlines.
   - If it is already in `data/conferences.json` (match on name or URL,
     case-insensitive) or its start date is already in the past, skip it.
   - Otherwise add a properly formatted entry (verify dates against the page;
     do not invent).
   - **Remove every line you successfully handled** (added, or intentionally
     skipped as a duplicate / past event) from `add-conferences.txt`.
   - If you cannot extract reliable info from a URL, leave that line in the file
     and append `  # could not verify YYYY-MM-DD` so a human can look.

   Commit the edited `add-conferences.txt` together with `conferences.json`.

3. **Re-verify every existing entry (do this every run — not just for new
   ones).** For each conference already in the file, check its official site and
   update anything that has changed: confirmed dates replacing estimates,
   newly announced paper/poster deadlines (`"TBD"` → a real date), corrected
   locations or URLs, and deadlines that have `passed`. Remove any `(TBC)` /
   estimate wording once real dates are confirmed. This keeps previously
   captured conferences accurate as organizers firm up details.

4. Run `python3 scripts/prune.py` to drop any conferences that have already
   ended.

5. Use web search to find conferences and workshops in the topics above whose
   **start date is within the next 12 months** and that are **not already in the
   file**.

6. For each new or updated conference, use this shape:
   - `name`, `url` (official site), `location`
   - `start` and `end` as `YYYY-MM-DD` (best available; if only a month is
     known, use a reasonable day and note it in `dates_display`)
   - `dates_display` — human-readable range matching start/end
   - `paper_deadline` and `poster_deadline` — a date, `"TBD"`, or `"passed"`

7. De-duplicate on `name` (case-insensitive). **Do not invent dates** — if you
   can't verify a real date, skip the conference (or leave the existing value
   untouched). It is better to omit an unverifiable conference than to publish a
   wrong date.

8. Set the top-level `updated` field to today's date. Keep the file valid JSON,
   2-space indented, with a trailing newline. Verify it parses:
   `python3 -c "import json; json.load(open('data/conferences.json'))"`.

9. Commit with a message summarizing what you added / updated / removed and push
   to `main`. If nothing changed, do not commit.

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
