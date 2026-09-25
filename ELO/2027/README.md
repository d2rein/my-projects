# NRL Elo 2027 preview

This directory is an isolated public mock for `/ELO/2027/`. It does not update
the production parameter table, ratings, matches or model. The existing
`/ELO/` application remains untouched.

## What is implemented

- current-season landing page with live score refresh;
- active-team-only ladder and bye calculations;
- prebuilt historical match cache with closing prices and provenance;
- separate historical match, Elo history, performance and Joker views;
- frozen 2026 Joker snapshot;
- versioned `2027_v1.1.0` replay with Base 2027 ELO, Rookie Adjustment and the protected Lineup Adjustment selection;
- a separate Player Impact column for yellow Full Player Profile alerts and green Full/Core/Creation consensus;
- active and grey/superseded Market Swap states under the explicit tipping precedence;
- recent-year fading calibration curves and continuous-margin scatter;
- unchanged production diagnostic download plus a candidate-specific schema;
- read-only formula, version crosswalk and tipping-policy page backed by `model-config.js`;
- latest paired Sportsbet H2H observation in the current table, when collected.
- a persistent NRL/NRLW header toggle across all nine views;
- the named `NRLW_2027_v1.0.0` full-history core, plus a separately fitted
  prior-season Rookie Gate 6 shadow comparison;
- NRLW historical survey prices recovered from OddsPortal for 2024 onward;
- the next NRLW finals round derived from the live RLDB ladder and completed
  finals when RLDB has not yet stored the official scoreless fixtures;
- reconstructed own-year 2018–2025 forecast scores from owner-supplied parameters;
- an expandable nine-system 2009–2026 comparison with a common 1500/2009 start.

Historical forecast reconstruction is archived in
`../offline/experiments/EXP-2026-031-recovered-historical-models/README.md`.
The observed 2026 forecast remains unchanged. Reconstructed forecasts are marked
with an asterisk and must not be described as saved predictions or submitted tips.
Their market-swap overlays use their own recovered probabilities. The selected
replay column and charts retain the existing website's 1998-start convention;
the additional comparison table uses 2009 throughout. The cache build now also
reads `run-003/website_payload.json` and writes `data/historical-model-comparison.json`.

## Market-line definition

Odds are not an Elo input. They are an external tipping-rule input.

- Historical display: the explicit single-book close where available. Where it
  is absent, the historical table displays the OddsPortal survey pair.
- Current display: the latest complete Sportsbet home/away pair captured at one
  timestamp. It is not averaged, best-priced or combined with another book.
- All thresholds use the paired no-vig probability. The frontend displays the
  actual two decimal prices and implied home probability used to calculate it.
- The swap indicator activates when the market and candidate choose different
  teams and the market is at least ten percentage points more confident beyond
  50%. It is greyed out when a protected Lineup Adjustment or Player Impact
  signal supersedes it. The adverse-movement marker is review-only. No market
  signal enters Elo or changes margin.

The permanent naming, versioning and query instructions are in
`../offline/model-registry/CURRENT.md`. Research labels such as Gate 6, Stage
4C, O10 and O9 are not public deployment names.

## Rebuilding the cache

Run from the repository root:

```powershell
cd ELO/offline
python build_2027_team_list_details.py
cd ../..
node ELO/2027/build-cache.mjs
node ELO/2027/validate-cache.mjs
```

Build the NRLW cache from the local read-only RLDB database with:

```powershell
python ELO/2027/build-nrlw-cache.py --database <path-to-rldb-sqlite>
```

Add `--refresh-odds` to refresh the separate OddsPortal source cache. Match
and team-list data come exclusively from the installed live RLDB; the odds
cache is only an external comparison layer. The NRLW rookie coefficients are
trained only on earlier NRLW seasons. Because the
league is young, the replay does not impose the NRL research pipeline's
200-game minimum; its comparison is explicitly exploratory, not a promotion
decision.

The first command opens `C:/RLDB/data/rldb.sqlite` read-only and creates the
temporary player-name/contribution input used by the Team List hover. The cache
build reads that file plus frozen offline research artefacts and creates
`data/historical-cache.json`. Historical pages read this asset directly. Only
the current season calls the live match API on page load.

## Known preview limits

- Historical Lineup Adjustment and Player Impact outputs are shown only where
  the frozen prior-only research pipeline produced them. A future prospective
  forecast must identify `2027_v1.1.0` and supply the corresponding subsystem
  fields; it must not silently label an older Gate-6-only forecast as v1.1.0.
- The odds collector writes locally. A durable upload/API path is still needed
  before new captures can appear online without rebuilding and redeploying.
- The 2025 Joker table will be imported when the user's saved copy is supplied.
- Non-NRL senior experience remains a blocker before Gate 6 is used for 2027
  expansion-team tips.
- On NRLW, Rookie Gate 6 and market disagreement are review flags only. Neither
  can automatically replace the displayed core tip.
- The usable NRLW odds archive currently covers 2024 onward and is incomplete
  where OddsPortal paginates or has no historical season page.

See `BACKEND_PLAN.md` for the production architecture needed before promotion.
