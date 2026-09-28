# 2027_v1.1.1 model card

Status: deployed baseline on the `/ELO/2027` preview from 28 September 2026. It supersedes `2027_v1.1.0` without changing the zero-sum rating ledger, team-list models or tipping precedence.

## Patch change

Base 2027 ELO is now `ELO_v1.1`. Grand finals are explicitly neutral for prediction:

```
venueHome = 0
venueTravel = 0
DR = (Rhome - Raway) + actualRestAdj + streakAdj
```

The NRL's administrative home/away ordering remains the display order but does not affect the probability. This was approved after the 1998–2025 audit found no overall correct-tip penalty from removing grand-final home advantage (18/28 either way), with recent results improving from 5/9 to 7/9 for 2017–2025.

Every scoreless fixture receives an immediate Base ELO probability. Published team lists then add Rookie/Lineup information when available; missing team lists can no longer suppress the base forecast.

All other systems and the explicit tipping policy are unchanged from `2027_v1.1.0`.

