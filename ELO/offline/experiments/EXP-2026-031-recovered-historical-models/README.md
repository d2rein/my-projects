# EXP-2026-031 — recovered historical systems

Completed 17 September 2026. Authoritative results: **run-003/**.
Research does not change the production model, parameters or database.
The 2027 mock's performance view consumes a copy of these results.

## Source and recovered parameters

The owner supplied a screenshot of their annual parameter table and the original
World Football Elo description in this chat. This is a manual transcription,
not a recovery of an original workbook or saved forecasts. They confirmed that
the 2025 update is `(K + early) * marginMultiplier`, not `K + margin * early`.
No pre-2018 parameter provenance was supplied.

| Used in | K | Home advantage | Season reversion | Margin-weighted K | Early increment |
| --- | ---: | ---: | --- | --- | --- |
| 2018 | 15 | 25 | `(14*R + 1500)/15` | No | 0 |
| 2019–2022 | 10 | 25 | `(2*R + 1500)/3` | No | 0 |
| 2023–2024 | 10 | 25 | `(2*R + 1500)/3` | Yes | 0 |
| 2025 | 11 | 45 | `(2*R + 1500)/3` | Yes | `max(0,11-round)` |

Home advantage is applied once, including matches at alternative/neutral grounds,
as in the supplied original rule. No travel, rest or streak adjustments are
invented for these versions. The written 2018 reversion formula takes precedence
over the table's ambiguous “reduce to 15” heading.

```text
DR = homeRating - awayRating + homeAdvantage
P(home) = 1 / (1 + 10^(-DR/400))
result = 1 for home win, 0 for away win, 0.5 for draw

# 2023–2025:
u = abs(actualMargin)/6
index = clamp(ceil(u), 1, 4)
M = [0.5, 1, 1.5, 1.75][index] + max(0,u-3)/8

Kprime = K                         # through 2022
Kprime = K*M                       # 2023–2024
Kprime = (K+max(0,11-round))*M      # 2025
delta = Kprime*(result-P(home))
homeRating += delta
awayRating -= delta
```

Important: the supplied old multiplier has a **continuous `u-3` tail**. The
current website uses `max(ceil(u)-4,0)/8`. They are not treated as the same formula.
The CHOOSE index is clamped at 1 and 4 to make draws and large margins defined;
this is an explicit reconstruction assumption, not recovered spreadsheet proof.

The 2023 margin tip is 2. For 2024 we use the written `round(.08*abs(DR))`, without
adding a minimum. For 2025 we use `.048406*abs(DR)-1`, nearest multiple of 2 with
minimum 1, per the supplied table. Halfway rounding is away from zero. These
margin-tip rules do not affect winner probabilities or Elo updates. Earlier
margin-tip rules were not supplied and are not scored.

## Protocol

Nine systems; no sweep or parameter optimisation. All fixed systems independently
start at 1500 in Round 1, 2009. They use the copied production match snapshot in
year/match-index/game order, scoring each game before updating ratings. All finals
through 2025 are included; 2026 stops at Round 27 (204 games). Draws earn one
correct tip for any winner selection, consistent with existing website metrics.
Home is selected at exactly 50%.

Controls: 2026 preseason, observed backend production, effective browser K=9.5,
B* actual-days rest, and B* plus Rookie Gate 6. The latter's coefficients are
refitted annually using only previous seasons from 2009 onward, the frozen
eight-year window/ridge 300/cap 18/gate 6. Prior-only career experience can include
games before 2009: these are known player histories, not a prior Elo warm-up.
Where fitting or lineup data are unavailable the candidate falls back to B*.
Parameters and the rookie family were selected retrospectively in earlier
research: this exercise is not new pristine holdout evidence.

The main website replay column retains its existing 1998-start convention.
The additional comparison table is explicitly 2009-start throughout. Recovered
own-year forecasts are labelled reconstructed; the observed 2026 130/204 entry
is retained unchanged. Market overlays are evaluated against each historical
version's own probabilities, not the current model's probabilities. Those rules
were not used historically and are only retrospective overlays.

## Results (correct tips, before market swaps)

| System | 2009–2026 / 3,625 | 2022–2026 / 1,044 | 2026 / 204 |
| --- | ---: | ---: | ---: |
| 2018 | 2,275 (62.76%) | 663 | 121 |
| 2019–2022 | 2,300 (63.45%) | 663 | 121 |
| 2023/2024 | 2,315 (63.86%) | 682 | 125 |
| 2025 | 2,319 (63.97%) | 683 | 124 |
| 2026 preseason | 2,343 (64.63%) | 697 | 129 |
| 2026 production | 2,342 (64.61%) | 699 | 130 |
| 2026 browser K=9.5 | 2,343 (64.63%) | 699 | 130 |
| B* | 2,347 (64.74%) | 700 | 130 |
| B* + Rookie Gate 6 | 2,363 (65.19%) | 711 | 132 |

The current candidate leads the best old system by 44 tips across the whole
exercise and by 28 in 2022–2026. Its Brier score also beats the old systems in
both periods. The old 2025 model narrowly beats production's pooled Brier score,
despite worse tips: probability quality and winner accuracy are different aims.
No claim is made that each incremental historical change improved every year.

Own-year reconstructed results: 2018 127/201; 2019 126/201; 2020 121/169;
2021 149/201; 2022 142/201; 2023 140/213; 2024 137/213; 2025 136/213.
The current candidate is not better in every year (for example it scores 117
versus 121 in 2020). These are not proof of historical submitted tipping scores.

The current snapshot's 2009-start preseason-2026 control scores 129/204, confirmed
against the JS engine. Older research notes report 128/204 on their original
legacy sweep input. Do not silently replace that earlier dataset-specific result.

## Artefacts and verification

- `run-003/manifest.json`: transcription assumptions, configurations, input/source SHA-256 hashes.
- `run-003/yearly_results.csv`: all nine systems for every year 2009–2026, tips/Brier/log loss.
- `run-003/period_results.csv`: pooled-period comparisons.
- `run-003/game_predictions.csv`: 32,625 pre-match probabilities, DR, results and tips.
- `run-003/website_payload.json`: own-year probabilities and website summaries.
- `run-003/events.jsonl`, `checkpoint.json`: completed progress trail, zero errors.
- `../../historical_model_replay.py`: runner, with deterministic formula tests.
- `../../historical_model_replay.test.mjs`: full game-by-game JS control parity checks.
- `../../../2027/data/historical-model-comparison.json`: deployed comparison copy.
- `../../../2027/data/historical-cache.json`: recovered own-year probability/summary copy.

`run-001` and `run-002` are superseded development outputs: winner scores match,
but the first assumed pre-2023 margin tips, and the second imposed an unwritten
2024 minimum. Neither is authoritative for margin reconstruction.

Verification: deterministic multiplier, early-K, reversion and rounding checks;
zero-sum invariant throughout each fixed replay; B* parity against its original
engine; all 10,875 control probabilities compared with the canonical JS replay;
website cache validation including every reconstructed score and preservation
of the observed 2026 result; browser execution checked before deployment.

To rerun, select a **new** output run directory in the runner (existing output
directories are deliberately not overwritten), then:

```powershell
python ELO/offline/historical_model_replay.py
node ELO/offline/historical_model_replay.test.mjs
node ELO/2027/build-cache.mjs
node ELO/2027/validate-cache.mjs
```

Update the build's source path only after reviewing the new results. Publishing
the 2027 mock assets is separate from any production model deployment.
