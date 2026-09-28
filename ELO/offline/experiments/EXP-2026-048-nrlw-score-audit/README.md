# EXP-2026-048 — 2026 NRLW score audit

Status: completed 28 September 2026. No model or RLDB changes.

The official NRL.com draw endpoint was compared with the installed read-only
RLDB and the deployed site's static NRLW cache.

- Official completed matches: **70**
- RLDB completed matches: **70**
- Exact NRL.com/RLDB score matches: **70/70**
- Site-cache matches before refresh: **68/70**

The two site-cache omissions were the completed preliminary finals:

- Sydney Roosters 20–10 Canberra Raiders
- Gold Coast Titans 8–20 Brisbane Broncos

The cache was stale, not incorrect. Rebuilding it from the audited RLDB records
locked in the actual Sydney Roosters v Brisbane Broncos grand final.

`run-001/score_audit.csv` contains every game comparison and source URL.
`run-001/summary.json` is the machine-readable result. The reproducible audit is
[`../../audit_nrlw_2026_scores.py`](../../audit_nrlw_2026_scores.py).

Manual website entries are stored as append-only API revisions separate from
RLDB. This same audit should be repeated after the grand final and during each
season review.
