# Changelog

## Website delivery hotfix - 2026-09-25

- Versioned the `model-config.js` module import and bumped the application asset URL to `20260925-3` so a browser cannot combine the new application with the cached v1.0 model module.
- No model, subsystem, probability or tipping-policy logic changed; the overall model remains `2027_v1.1.0`.

## 2027_v1.1.0 - 2026-09-25

- Preserved `2027_v1.0.0` as the previous B* plus Gate-6 preview.
- Promoted the Stage 4C protected selection to the displayed probability.
- Renamed public team-list systems to Base 2027 ELO, Rookie Adjustment and Lineup Adjustment.
- Added Player Impact with yellow Player Alert and green Player Consensus states.
- Renamed O10, O9 and creation-lite to Full Player Profile, Core Player Profile and Creation Profile.
- Made market suppression visible as a grey Market Swap.
- Published the explicit tipping precedence and the yellow-versus-strong-market decision.
- Added a permanent development-to-deployment crosswalk and overall/subsystem version rules.
