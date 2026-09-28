# EXP-2026-049 — neutral-venue and finals home-advantage audit

Status: first diagnostic completed 28 September 2026. No model change.

## Why this was needed

The men's deployed formula applies `+40` to the nominal home team in every
match, including grand finals and neutral venues. It also uses team-to-team
travel rather than the actual venue. Earlier venue research tested actual-ground
travel but did not establish a historical neutral-site designation layer.

NRLW is different: its fitted model uses **zero home advantage and zero travel**,
so no NRLW final receives a home-label bonus.

## Method and limitations

For each season, a team's primary venue was inferred as its most common regular-
season home venue. Finals were classified as home-primary, away-primary, shared,
other neutral/alternate, or grand final. The audit takes the frozen B0 pre-match
rating difference, removes the deployed `+40`, and tests alternative home terms.

This is a fixed-rating prediction overlay, not a full replay: changing one
match does not flow into later ratings. More importantly, finals “home” ordering
often encodes the higher seed. A residual nominal-home effect at a neutral venue
therefore is not proof of crowd or ground advantage.

## Results, 2009–2026

| Policy | Correct | Brier | Tips changed |
|---|---:|---:|---:|
| Always +40 | 2,330/3,625 | **0.223236** | — |
| Grand finals zero | 2,332/3,625 | 0.223293 | 2 |
| Inferred neutral finals zero | **2,333/3,625** | 0.223412 | 5 |
| All finals zero | 2,332/3,625 | 0.223768 | 22 |

There are only 17 grand finals in this period. Zeroing their home term gained
two tips—2020 and 2024—but slightly worsened probability calibration. Nominal
home teams won 12/17, consistent with home ordering containing seeding
information. The result is interesting but too small and confounded to change
the frozen 2027 baseline.

## Recommendation

Keep `+40` for the locked 2027 baseline. Add an explicit versioned venue-status
layer (true home, opponent home, shared, neutral event, showcase/overseas) and
ladder seed, then run a full replay separating genuine venue advantage from the
administrative higher-seed home label. Treat neutral-finals-zero as a prospective
shadow, not an automatic tipping rule.

Results are in `run-001/`; the script is
[`../../neutral_venue_home_advantage_audit.py`](../../neutral_venue_home_advantage_audit.py).
