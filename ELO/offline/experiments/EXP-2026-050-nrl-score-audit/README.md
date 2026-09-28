# EXP-2026-050 — 2026 men's score audit

## Question

Do all completed men's NRL scores manually recorded by the ELO site agree with the official NRL draw and RLDB?

## Result

Audit run on 28 September 2026:

| Source | Completed matches | Exact agreement with NRL.com |
|---|---:|---:|
| Official NRL.com draw | 212 | reference |
| RLDB | 212 | 212/212 |
| ELO site API | 212 | 212/212 |

There were no missing, extra, reversed or score-mismatched games. The audit covers every completed 2026 men's match available at run time. It does not include matches that had not yet been played.

## Reproduction

`audit_nrl_2026_scores.py` reads NRL.com and the live ELO API, then opens RLDB read-only. It makes no database or website changes.

Outputs are in `run-001/`:

- `score_audit.csv` — match-level three-way comparison and official match-centre URL.
- `summary.json` — totals, mismatches and unmatched records.

