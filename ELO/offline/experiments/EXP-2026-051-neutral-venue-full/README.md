# EXP-2026-051 — neutral and finals venue analysis

## Purpose

Test whether the men's model should blindly apply its normal home advantage and team-to-team travel adjustment at finals and non-standard venues. This is offline research only. It does not change the locked 2027 model or the live site.

## Data and classifications

The reproducible sample contains 5,820 completed matches from 1998–2025, including 256 finals. A team's season-specific home venues are inferred from its regular-season home fixtures. Each match is then classified as:

- the nominal home team's established home ground;
- a shared ground used by both teams;
- the nominal away team's ground;
- a balanced neutral venue;
- a geographically home- or away-leaning neutral venue;
- a remote/showcase venue; or
- a grand final.

Actual venue distance is measured from each team's inferred primary home venue. `geo_edge` is away-team distance minus home-team distance, so a positive value favours the nominal home team geographically. Ladder position was also tested as an explicit finals seed effect.

This is more informative than the production calculation, which currently applies +40 nominal home advantage plus legacy team-to-team travel without considering the match venue. It remains an inference: venue coordinates do not measure crowd split, memberships, ticket allocation, familiarity, or whether a relocated match is culturally a home game.

## Venue inventory

Finals (256): 155 home-ground, 3 shared-ground, 8 opponent-ground, 32 balanced neutral, 21 home-leaning neutral, 4 away-leaning neutral, 5 remote/showcase and 28 grand finals.

Non-standard regular-season matches (611): 159 shared-ground, 57 opponent-ground, 175 balanced neutral, 105 home-leaning neutral, 57 away-leaning neutral and 58 remote/showcase.

## Finals results

Parameters were selected only on finals through 2016 and tested on the untouched 2017–2025 finals (81 games). The broad search tested category offsets from negative values through +120, actual-venue travel from 0–40 Elo points per 1,000 km (capped at 60), and explicit seed effects.

| System | Selection tips | Selection Brier | Holdout tips | Holdout Brier |
|---|---:|---:|---:|---:|
| Current +40 plus legacy travel | 117/175 | 0.22047 | 56/81 | 0.19507 |
| Zero adjustment for every final | 100/175 | 0.24126 | 59/81 | 0.20962 |
| +40 only at an actual home ground | 106/175 | 0.23536 | 61/81 | 0.19955 |
| +40 actual home plus actual-venue travel 15 | 107/175 | 0.23292 | 60/81 | 0.19751 |
| Best model selected through 2016 | 123/175 | 0.21837 | 60/81 | 0.18875 |

The unconstrained selected formulation was:

```
DR = neutral_Elo_difference
   + venue_type_offset
   + clip(40 * (away_venue_km - home_venue_km) / 1000, -60, 60)
```

with offsets of +80 at the home team's established ground, 0 at a shared ground, +20 at the opponent's ground, +40 at other neutral venues and +40 in a grand final. The explicit ladder-seed term was zero.

That result beat the current model by six tips in selection and four tips in holdout, and improved holdout Brier score. It selected similar parameters at every expanding cutoff from 2009 onward and beat the then-current calculation on future games at each cutoff. However, the +20 opponent-ground and +40 neutral labels are not persuasive causal effects. There are only eight opponent-ground finals, and nominal-home designation is entangled with qualifying path and strength.

A constrained model that prohibited any bonus at shared, opponent, neutral and grand-final venues used +80 only at an established home ground plus actual-venue travel 40. It also scored 60/81 in holdout with Brier 0.19156, but fell to 111/175 in selection. The attractive recent tip result therefore does not establish a stable replacement.

The ten holdout tip changes made by the unconstrained candidate went 7–3. Most came from strengthening genuine home-ground finalists; its grand-final changes went 2–0. The individual games are recorded in `run-001/holdout_changed_tips.csv`.

## Non-standard regular-season venues

The model selected through 2016 preferred +20 at shared grounds, zero at opponent/neutral venues and no actual-distance term. On the 2017–2025 holdout this improved Brier from 0.21845 to 0.21519 but reduced correct tips from 236/346 to 226/346. That is unacceptable for the stated objective of maximising correct tips and is not a deployment candidate.

## Conclusion

The current blanket treatment is conceptually crude, but simply setting neutral games to zero is worse over the long history. Venue relationship and actual geography contain predictive information in finals. The strongest result is promising, not deployment-ready, because several sparse categories and nominal-home designation can absorb seeding, qualifying path and crowd effects.

Keep the locked 2027 model unchanged. For the next pass, store explicit pre-match fields for venue status, designated home reason, finals seed/qualifying path, each club's true home grounds, expected crowd split and relocation/showcase status. Re-run this experiment after the 2026 finals become a genuine additional holdout. Prefer a rule based on those observable facts over an unexplained bonus attached to the word “home”.

## Outputs

`run-001/` contains:

- `classified_finals.csv` — every final and its venue/geographic/seed classification;
- `venue_type_inventory.csv` — counts and raw outcomes by venue class;
- `system_comparison.csv` — overall and annual model comparisons;
- `finals_type_performance.csv` — results by finals venue class;
- `rolling_cutoff_validation.csv` — expanding historical validations;
- `holdout_changed_tips.csv` — the ten changed 2017–2025 tips;
- `grid_top100.csv` — leading parameter combinations; and
- `summary.json` — machine-readable headline results.

