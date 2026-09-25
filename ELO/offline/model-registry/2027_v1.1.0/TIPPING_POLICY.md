# Explicit tipping policy

Apply these rules in order.

1. Start with the displayed **2027 ELO** tip.
2. Follow an active **Market Swap** when the market opposes the model and is at least 10 percentage points more confident.
3. Do not follow a grey Market Swap. It has been superseded by a protected Lineup Adjustment or Player Impact signal.
4. A yellow **Player Alert** reverses the displayed tip and overrides Market Swap. Treat it as a manual-review call: verify the team list is the latest published list, confirm the market timestamp, and inspect the listed player/feature drivers.
5. A green **Player Consensus** makes the same reversal, with Full, Core and Creation profiles all agreeing. Follow it with greater confidence.

Operational precedence: `Player Consensus > Player Alert > protected Lineup Adjustment > active Market Swap > displayed 2027 ELO`.

The yellow-versus-80%-market case is not an undocumented exception. Under this version, yellow still wins after the freshness checks. If judgment overrides that policy, record the reason so it can be audited rather than silently changing the rule.

