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
- 2026 production, B* and robust Gate 6 comparison;
- recent-year fading calibration curves and continuous-margin scatter;
- unchanged production diagnostic download plus a candidate-specific schema;
- read-only formula and parameter page backed by `model-config.js`;
- latest paired Sportsbet H2H observation in the current table, when collected.

## Market-line definition

Odds are not an Elo input. They are an external tipping-rule input.

- Historical display: the explicit single-book close where available. Where it
  is absent, the historical table displays the OddsPortal survey pair.
- Current display: the latest complete Sportsbet home/away pair captured at one
  timestamp. It is not averaged, best-priced or combined with another book.
- All thresholds use the paired no-vig probability. The frontend displays the
  actual two decimal prices and implied home probability used to calculate it.
- The swap indicator fires when the market and candidate choose different
  teams and the market is at least ten percentage points more confident beyond
  50%. The adverse-movement marker fires only for a comparable ten-point move
  away from the Elo selection. Neither signal enters Elo or changes margin.

## Rebuilding the cache

Run from the repository root:

```powershell
node ELO/2027/build-cache.mjs
node ELO/2027/validate-cache.mjs
```

The build reads frozen offline research artefacts and creates
`data/historical-cache.json`. Historical pages read this asset directly. Only
the current season calls the live match API on page load.

## Known preview limits

- Candidate lineup outputs are shown only where the frozen historical team-list
  pipeline produced them. Missing candidate output is displayed as missing.
- The odds collector writes locally. A durable upload/API path is still needed
  before new captures can appear online without rebuilding and redeploying.
- The 2025 Joker table will be imported when the user's saved copy is supplied.
- Non-NRL senior experience remains a blocker before Gate 6 is used for 2027
  expansion-team tips.

See `BACKEND_PLAN.md` for the production architecture needed before promotion.
