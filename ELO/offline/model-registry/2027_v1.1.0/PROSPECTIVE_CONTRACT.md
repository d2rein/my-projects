# Prospective forecast and query contract

Every saved or API-served forecast must include:

- `overallModelVersion` (`2027_v1.1.0` here);
- every subsystem ID from `manifest.json`;
- source team-list snapshot/hash and observation time;
- Base, Rookie, Lineup and displayed home probabilities;
- Rookie and Lineup margin-point adjustments and activation booleans;
- Full, Core and Creation profile probabilities;
- Player Alert and Player Consensus booleans;
- market source, opening/current timestamps, paired prices, raw rule result, active/suppressed state and suppression reason;
- the final policy tip plus any manual override and reason.

For future model questions, resolve the exact overall model version first, then report the displayed probability, all active/suppressed signals, data freshness and the registered policy outcome. Never infer a result from a colour alone, silently substitute a newer policy, or label a legacy Gate-6 forecast as `2027_v1.1.0`.

The website diagnostic CSV is the reference flat schema. The version manifest is the reference name crosswalk.
