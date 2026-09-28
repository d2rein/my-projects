# NRL ELO model register

This is the permanent, append-only register of models used in production. Update it as part of every model deployment. Do not rewrite an old entry when a model changes; add a new entry above it and retain the old entry for comparison.

Model research, candidate parameters, and backtests do not belong in the production entries below until the candidate is actually deployed. Merely updating this file does not authorise a deployment.

The separate offline research process, frozen baselines, experiment naming rules and promotion gates are defined in `offline/RESEARCH_PROGRAM.md`; completed research is indexed in `offline/EXPERIMENT_LOG.md`. Annual reviews and proposed candidates are archived in [`offline/season-reviews/README.md`](offline/season-reviews/README.md). An entry in a season review is not a production deployment.

## 2027 preview deployment registry

The versioned 2027 tipping system and its decision overlays are registered in [`offline/model-registry/CURRENT.md`](offline/model-registry/CURRENT.md). The active preview is `2027_v1.1.1`; `2027_v1.1.0` is retained as its predecessor. Version 1.1.1 removes administrative home advantage and travel from grand finals and guarantees a core forecast before team lists arrive. Development names such as Stage 4C, O10 and O9 must be resolved through that registry before answering operational tipping questions.

## Deployment checklist

Before deploying a new model:

1. Copy the current production entry into a new dated entry and give it a stable version name.
2. Record every parameter, formula or behavioural change, including hard-coded constants.
3. Record the exact code commit and the effective deployment time.
4. Record the offline evaluation period, data cutoff, metrics, expected in-season accuracy, and approval.
5. Deploy only after explicit approval.
6. Read the public production parameter endpoint and calculator source after deployment, then record the observed values here.
7. Never replace the historical entries below.

## Production snapshot: observed 2026-09-11

Status: **live at the time of observation; unchanged by this documentation work**

- Stable version label: `prod-observed-2026-09-11`
- Observation date: 2026-09-11 (Australia/Brisbane)
- Parameter source: read-only response from `https://nrl-elo-api.d2-rein.workers.dev/api/parameters`
- Formula and parameter-mapping sources: read-only responses from `https://drein.net/ELO/app.js`, `https://drein.net/ELO/shared/replay-engine.js`, and `https://drein.net/ELO/shared/elo-calculator.js`
- Matching repository formula commit: `f02e6b12d637c0235c81e50fa4a3778b53af46d7` (2026-09-10)
- Exact deployment time: not recoverable from the repository

### Effective parameters

These are the values returned by the production parameter endpoint. They take precedence over `backend/update_params.bat`. The K-factor mapping exception immediately below the table means that not every production execution path actually uses the returned K value.

| Parameter | Production value | Meaning |
| --- | ---: | --- |
| `initial_rating` | 1500 | Rating assigned to a team without an existing rating |
| `k_factor` | 9.455 | Base rating-update rate |
| `home_advantage` | 40 | Home-team rating points |
| `travel_per1000km` | 15 | Home-side adjustment per 1,000 km travelled by the away team |
| `rest_per_round` | 3.2 | Rating points per round of home-minus-away extra rest |
| `streak_pts` | 2.15 | Rating points per unit of home-minus-away streak |
| `early_boost` | 0.95 | Additive early-round boost to the base K factor |
| `reversion_weight` | 3 | Prior-season weight in season reversion |
| `dr_weighting` | 400 | Logistic win-expectancy scale |
| `margin_coefficient` | 0.048406 | Predicted-margin coefficient |
| `odds_coefficient` | 0.002 | Retained in the database, but not used by the deployed calculator |

The live calculator hard-codes `dr_weighting`, `margin_coefficient`, and `odds_coefficient`; it does not consume those three database values. The returned values match the hard-coded constants in this snapshot.

There are two effective K factors in the observed production system:

- Backend prediction/replay paths pass `k_factor` correctly and use **9.455**.
- Browser replay/evaluation paths load it as `kFactor`, but `createReplayEngine` reads `modelParams.k`. The missing value activates the calculator fallback, so those paths use **9.5**.

This is a record of the deployed behaviour, not a proposal to correct it.

### Effective formulae and behaviour

Notation:

- `Rh`, `Ra`: home and away ratings before the match
- `km`: Haversine distance from the away team's stored base coordinates to the home team's stored base coordinates; zero if either base is missing
- `round`: parsed regular-season round number; `Finals Wk N` maps to `27 + N`; legacy named finals map to 28-31
- `homeRest`, `awayRest`: `max(0, round - previousRoundPlayed - 1)` within the current season, otherwise zero
- `homeStreak`, `awayStreak`: signed consecutive win/loss counts before the match

Adjustments and effective rating difference:

```text
travelAdj = (km / 1000) * travel_per1000km
restAdj   = (homeRest - awayRest) * rest_per_round
streakAdj = (homeStreak - awayStreak) * streak_pts

dr = (Rh + home_advantage + travelAdj + restAdj + streakAdj) - Ra
```

Prediction:

```text
P(home win)    = 1 / (1 + 10 ^ (-dr / dr_weighting))
predictedMargin = margin_coefficient * dr
predicted team  = home when P(home win) >= 0.5, otherwise away
```

Rating update after a played match:

```text
margin    = homeScore - awayScore
actual    = 1 for a home win, 0 for an away win, 0.5 for a draw
rawBucket = ceil(abs(margin) / 6)
idx       = clamp(rawBucket, 1, 4)
term1     = {1: 0.5, 2: 1.0, 3: 1.5, 4: 1.75}[idx]
term2     = max(rawBucket - 4, 0) / 8
early     = early_boost * max(0, 11 - round), only when round > 0; otherwise 0
baseK     = effective K + early
finalK    = baseK * (term1 + term2)
delta     = finalK * (actual - P(home win))

newRh = Rh + delta
newRa = Ra - delta
```

Here, `effective K` is 9.455 in the backend paths and 9.5 in the browser replay/evaluation paths described above.

At the first processed match of a new year:

```text
newSeasonRating = (initial_rating + reversion_weight * previousRating)
                  / (reversion_weight + 1)
```

The previous-round and streak state is then reset. After each match, winners' positive streaks and losers' negative streaks continue by one; a change of direction starts at `+1` or `-1`; a draw resets both teams' streaks to zero.

### 2026 expectation recorded before the season

Recovered on 2026-09-11 from the original local sweep workspace:

`C:\Users\d2rei\Python Projects\NRL ELO\nrl-elo-system\Parameter Sweep`

The frozen start-of-season configuration was K 9.455, home advantage 40, travel 15, rest 3, streak 2.5, early strength 0.95, reversion 3, DR weighting 400, and margin coefficient 0.048406. `research_elo_current.py` reproduces the saved single-model result in `sweep_results_20260301_140121.csv` exactly.

Pre-2026 retrospective benchmarks available when the model was selected:

| Evaluation window | Correct/games | Accuracy | Brier score |
| --- | ---: | ---: | ---: |
| All available seasons, 2009-2025 | 2,144/3,312 | 64.7343% | 0.222678 |
| Since 2019 | 949/1,392 | 68.1753% | 0.213044 |
| Last three seasons, 2023-2025 | 423/639 | 66.1972% | 0.223230 |
| Latest season, 2025 | 142/213 | 66.6667% | 0.226768 |

For start-of-2026 comparison, use **66.67%** as the simple point benchmark from the immediately preceding season, with **about 66-68%** as the range suggested by the recent-period views. These are retrospective in-sample summaries: the sweep used the same history on which it was scored, so they are not a formally out-of-sample forecast.

Provenance hashes (SHA-256 at recovery):

- `research_elo_current.py`: `A0F6305709CD9BBAFF05DDC76E41D73BFD3FE2BAB58A38CB251C5F5D7911615D`
- `sweep_results_20260301_140121.csv`: `06EA641080DC977E0CEDA1344F66E3E39F4DED28BBBD2ED8E2F61E190BE793F9`
- `tight_sweep_20260226_161705.csv`: `874ABA14464BB53B97D7B04132D8EB9192E7D6EC017D5648E5B318292A5BE32E`

### Frozen model's 2026 holdout result

Recomputed offline on 2026-09-11 by replaying the unchanged start-of-season model through the 2009-2025 local sweep history, then appending the 204 completed 2026 regular-season matches read from the public production match endpoint. No 2026 result was used to choose or change a parameter. There were no draws in the holdout. This first table deliberately reproduces the archived sweep's 2009 starting point.

| Evaluation window | Correct/games | Accuracy | Brier score |
| --- | ---: | ---: | ---: |
| 2026 regular season holdout | 128/204 | 62.7451% | 0.229782 |
| Last three seasons, 2024-2026 | 413/630 | 65.5556% | 0.226991 |
| Since 2019, through 2026 | 1,077/1,596 | 67.4812% | 0.215184 |
| All seasons, 2009-2026 | 2,272/3,516 | 64.6189% | 0.223090 |

The live website instead replays match history beginning in 1998. On that website-equivalent basis:

| Model | Correct/games | Accuracy | Brier score |
| --- | ---: | ---: | ---: |
| Original start-of-season parameters | 129/204 | 63.2353% | 0.230430 |
| Current live browser model | 130/204 | 63.7255% | 0.230575 |
| Current live backend model | 130/204 | 63.7255% | 0.230577 |

The website's displayed total of **130 correct tips is therefore the correct live-model figure**. Against the 66.67% point benchmark, that is 2.94 percentage points lower and approximately six fewer correct tips than the benchmark rate implied. This entry covers the 204 regular-season matches only; add finals separately once the intended evaluation period is complete.

The subsequent 266,191-candidate temporal-selection comparison is recorded in `offline/HOLDOUT_EXPERIMENT_2026.md`, with machine-readable results in `offline/holdout_comparison_2026.csv` and `offline/holdout_comparison_2026_live_history.csv`. It found no candidate with a material, statistically persuasive improvement over this frozen model on the 2026 holdout.

## Previous recoverable version: pre-2026-02-26 parameter set

Status: **recoverable from Git; production deployment and exact effective dates are not proven**

- Stable version label: `repo-pre-2026-02-26`
- Source: parent of repository commit `87d7f49545d04e837596fbd777bce29b354b8210`
- Last code state with these constructor defaults: commit `b0d980a0f2bec820f7ed1c36f41b32d106866994`

| Parameter | Previous repository value |
| --- | ---: |
| `initial_rating` | 1500 |
| `k_factor` | 8.875 |
| `home_advantage` | 45 |
| `travel_per1000km` | 0 |
| `rest_per_round` | 2 |
| `streak_pts` | 0 |
| `early_boost` | 0.8 |
| `reversion_weight` | 3.3 |
| `dr_weighting` | 400 |
| `margin_coefficient` | 0.048406 |
| `odds_coefficient` | 0.002 |

The core rating-difference, logistic expectancy, margin prediction, draw handling, rating update, and season-reversion formulae otherwise match the current formulae above in that Git state. Because runtime parameters were stored outside Git, these values are evidence of the previous code configuration, not proof of a production database snapshot.

### Earlier recoverable formula variant

Commit `e6bb683249dd3a997c29fa338437ac41322b3d0c` (2026-02-26) preserves the immediately preceding formula variant:

```text
term2 = max(idx - 3, 0) / 8
P(displayed win) = clamp(0.5 + odds_coefficient * dr, 0, 1)
```

The rating update still used the logistic expected result. Commit `b0d980a0f2bec820f7ed1c36f41b32d106866994` replaced the margin term with `max(rawBucket - 4, 0) / 8` and made displayed win probability use the logistic expectancy too. This is Git history only; whether and for how long the earlier variant was live is not established.

## Known configuration discrepancy at the 2026-09-11 snapshot

`ELO/backend/update_params.bat` contains `rest_per_round = 3` and `streak_pts = 2.5`, but production returned `3.2` and `2.15`. The script is therefore not a reliable record of the live model on its own. Future entries must be based on a post-deployment read-back from production as well as the deployed code commit.

The diagnostic CSV's embedded explanatory text is also stale even though the calculation it reports comes from the current calculator. It says a draw is encoded as `0` and shows the older capped-bucket margin term; the effective calculator encodes a draw as `0.5` and uses `max(rawBucket - 4, 0) / 8`, as recorded above. This register follows executable behaviour.
