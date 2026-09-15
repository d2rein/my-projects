# Backend promotion plan

The preview deliberately avoids changing the current production API. Before it
replaces `/ELO/`, the following backend work should be completed on staging.

## 1. Versioned, immutable model records

Add `model_versions` with the stable model ID, formula version, parameters,
code commit, status and effective interval. Store each published prediction in
`forecast_snapshots` with its model version, generated time, data cutoff,
lineup snapshot, probability, continuous margin and competition margin.

The mutable global parameter endpoint must not be reachable from the public
application. Administrative mutations should require authentication.

## 2. Canonical season membership

Add `season_teams(season, competition, team_id, active_from, active_to)`. Ladder
and bye code must use this membership rather than the global teams table. Elo
ratings remain available for inactive historical teams.

## 3. Market snapshots

Publish the collector's append-only observations to
`market_snapshots(match_id, source, bookmaker, observed_at, checkpoint,
selection, decimal_odds, line, payload_hash)`. A paired-market view should
return opening, latest practical checkpoint and pregame observations without
overwriting earlier prices.

For the primary displayed line, return the latest complete Sportsbet pair from
one observation timestamp. Store other bookmakers for research and resilience;
do not silently synthesize a price. Return source, timestamp and coverage.

## 4. Team lists and Gate 6

Store versioned team-list snapshots for Tuesday, practical Thursday/Friday and
final run-out lists. Candidate forecasts must record the exact snapshot and
annual prior-only rookie coefficients used. Apply the lineup adjustment to
prediction only; do not write it into the zero-sum base Elo ledger.

## 5. Cached historical products

Generate versioned historical match, rating and performance artefacts after a
season closes or a retrospective method is explicitly promoted. Serve them
with long-lived cache headers and an asset version. Current-season endpoints
remain small and dynamic.

## 6. Evaluation semantics

Calculate three separately labelled series:

1. immutable as-published forecasts;
2. current-model retrospective replay;
3. ladder and market comparators on their own valid coverage.

Never substitute an Elo tip when odds are missing. Opening and checkpoint/close
accuracy must expose `correct / covered games`, source and equal-price handling.

## 7. Joker archive

Store completed Joker tables as immutable season snapshots with the model
version, selection time, chosen rounds, expected results and actual results.
Current-season calculations remain live.

## 8. Promotion checks

- exact active-team count and no inactive-team bye points;
- frontend/backend replay parity;
- immutable forecast and Joker snapshots;
- odds pairing, source, timestamp and denominator tests;
- candidate diagnostic schema fixtures;
- mobile and accessibility checks;
- post-deployment read-back added to `MODEL_HISTORY.md`.

Promotion requires explicit approval. It must not overwrite the recorded 2026
production model or its historical outputs.
