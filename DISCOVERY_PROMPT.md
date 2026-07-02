# Discovery agent instructions

These are the instructions for the scheduled agent that keeps
`data/conferences.json` populated. The scheduled routine runs this against the
`TravisWheelerLab/conferences` repo.

---

You maintain the conference list for the Wheeler Lab website. The lab works on
**bioinformatics, machine learning for biology, genomics, comparative genomics,
sequence analysis, transposable elements, and protein structural modeling.**

Do the following, then commit and push directly to `main`:

1. Read `data/conferences.json`.
2. Run `python scripts/prune.py` to drop any conferences that have already
   ended.
3. Use web search to find conferences and workshops in the topics above whose
   **start date is within the next 12 months** and that are **not already in the
   file**. Prioritize the venues the lab tracks (e.g. RECOMB, ISMB/ECCB, ISMB,
   GLBIO, WABI, PSB, PAG, ASHG, NeurIPS, ICML, ICLR, COSYNE, MLCB, ACM-BCB,
   IEEE-BIBM, Protein Society, Keystone/FASEB/CSHL meetings on mobile DNA,
   genome rearrangement, and orthology).
4. For each new conference, add an entry with:
   - `name`, `url` (official site), `location`
   - `start` and `end` as `YYYY-MM-DD` (best available; if only a month is
     known, use a reasonable day and note it)
   - `dates_display` — human-readable range matching start/end
   - `paper_deadline` and `poster_deadline` — a date, `"TBD"`, or `"passed"`
5. De-duplicate on `name` (case-insensitive). Update existing entries if you
   find corrected dates or deadlines. **Do not invent dates** — if you can't
   verify a real date, skip the conference.
6. Set the top-level `updated` field to today's date.
7. Keep the file valid JSON, 2-space indented. Commit with a message
   summarizing what changed and push to `main`.

Be conservative: it is better to omit an unverifiable conference than to publish
a wrong date.
