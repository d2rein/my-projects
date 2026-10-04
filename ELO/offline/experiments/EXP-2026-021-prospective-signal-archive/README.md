# EXP-2026-021 — prospective signal archive

Status: active prospective data collection; no live-model change.

## Purpose

Preserve information exactly as it was available before each match so future
line-up, market, crowd and news research is not dependent on hindsight. The
first observations cover the remaining 2026 NRL finals. NRLW fixtures,
official lists and markets were added on 25 September 2026.

## Collection schedule

- `daily`: fixtures, official announced and completed-game team lists, Sportsbet markets, low-frequency multi-book odds,
  prediction-market searches and newly published official NRL expert-tip pages.
- `pregame`: checks the cached fixture list without using the network and
  collects official lists plus odds when a match is 45–75 minutes from kickoff. Each fixture is
  captured at most once in that window. Every successful in-season collection
  pass is followed by a forecast refresh using the newest announced list.
- A failed source is logged independently and does not destroy successful data.
- `offseason`: one Monday snapshot of Sportsbet rugby-league outrights and NRL
  futures plus prediction-market searches. Published outcomes and prices are
  normalized while the complete raw page is retained.

The local schedule is daily at 9:05am Brisbane time and a local pregame
eligibility check every 30 minutes. It switches automatically to weekly Monday
offseason collection after a final daily pass on Monday 5 October 2026. That
pass finalises the Grand Final announced and actual run-out lists; the first
weekly offseason capture is Monday 12 October. Daily and pregame collection
resume automatically on 1 March 2027. See
[`SOURCES_AND_SCHEDULE.md`](SOURCES_AND_SCHEDULE.md).

## Current sources

| Source | What is retained | Frequency | Notes |
|---|---|---|---|
| NRL draw data | NRL and NRLW teams, kickoff, round, state, venue and match-centre URL | Daily | Official competition IDs 111 and 161; internal schema may change |
| NRL Match Centre structured data | Published NRL/NRLW squads, reductions, roles, jersey numbers, player IDs, captains and update time | Daily and pregame | Announced snapshots remain the display record; post-match run-outs are archived separately and can be checked against RLDB |
| Sportsbet public NRL and NRLW listings | H2H, main handicap and main total | Daily and pregame | One listing request per competition, not one request per market |
| The Odds Sniffer NRL and NRLW comparisons | Published H2H prices for multiple AU bookmakers | Daily and pregame | One polite request per competition; an empty NRLW listing is retained as evidence |
| Manifold | Open NRL search results, probability, volume and liquidity | Daily | Public documented API; an empty result is meaningful |
| Polymarket | NRL public-search results and market metadata | Daily | Public documented API; failures/absence are retained |
| NRL official tipping index | Index plus at most three new expert-tip pages | Daily | New pages are downloaded once and currently stored raw |

Fan tipping percentages are not yet collected because no stable, public,
unauthenticated source has been verified. A logged-in tipping site will not be
scraped by pretending to be a user. A source can be added later without
changing the observation schema.

## Files

- `data/runs/<UTC timestamp>-<mode>/`: immutable raw responses, normalized CSVs,
  manifest, events and errors for one collection.
- `data/observations/market_observations.csv`: append-only normalized market
  history.
- `data/observations/prediction_markets.csv`: append-only prediction-market
  discoveries.
- `data/observations/futures_observations.csv`: append-only normalized futures.
- `data/observations/team_list_snapshots.jsonl`: append-only normalized list
  changes; identical repeat observations are retained in run evidence but not
  duplicated here.
- `data/observations/final_announced_team_lists.jsonl`: the last captured
  announced list before each completed match, retained as the tipping record.
- `data/observations/actual_team_lists.jsonl`: post-match actual run-out lists,
  retained for retrospective modelling and cross-checking against RLDB.
- `data/state/latest_fixtures.json`: replaceable operational cache, not evidence.
- `data/state/pregame_captured.json`: prevents repeated near-kickoff capture.
- [`../../prospective_signal_collector.py`](../../prospective_signal_collector.py): collector.
- [`../../run_prospective_collection.ps1`](../../run_prospective_collection.ps1): scheduler wrapper.

Raw responses are retained because published HTML and APIs will change. A
future parser can therefore recover information the first parser missed.
New raw responses are stored as deterministic gzip files, which reduced a
representative daily payload by 85.3%. Existing evidence remains untouched.

## Normalized market schema

Each row identifies the observation time, source, bookmaker, event, kickoff,
market type, selection, line, decimal odds, raw implied probability and raw
payload hash. NRL keeps its established source IDs; NRLW source IDs have an
`nrlw_` prefix because the original append-only schema has no competition
column. Bookmaker margin is deliberately not removed in storage; no-vig
probabilities are derived during analysis.

## Ethical and operational limits

- No source is polled continuously.
- The multi-book comparison requires one page request per scheduled capture.
- Official expert-tip articles are downloaded only once when first discovered.
- The collector identifies itself with a research user-agent.
- Access failures are recorded; access controls are not bypassed.
- This archive does not place bets or modify the Elo model. When the private
  uploader credential is present it inserts only into isolated append-only API
  tables for team lists, market observations and forecast snapshots. The 2027
  preview reads the latest announced-list forecast; ratings, parameters and
  historical match results are untouched.

See [`HARDENING.md`](HARDENING.md) for the implemented mutex, heartbeat,
idempotence and compression controls, and for the one remaining
administrator-only task registration step.
