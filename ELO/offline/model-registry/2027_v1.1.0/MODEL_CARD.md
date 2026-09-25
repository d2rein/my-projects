# 2027_v1.1.0 model card

Status: deployed baseline on the `/ELO/2027` preview. It does not alter the old 2026 production model or the main historical ELO site.

## Displayed probability

1. Calculate Base 2027 ELO (`ELO_v1.0`).
2. Calculate Rookie Adjustment (`RA_v1.0`, development name Gate 6).
3. Calculate Lineup Adjustment (`LA_v1.0`, development name Stage 4C).
4. Use Lineup Adjustment only when it reverses the Base ELO tip and the original Base ELO confidence is at least 10 percentage points from 50% (at least 60/40). Otherwise use Rookie Adjustment.

Rookie and Lineup adjustments are alternatives; they are never added together. Neither changes the zero-sum ELO ledger.

`P_display = P_lineup` for a strong Stage 4C overturn; otherwise `P_display = P_rookie`.

## Decision overlays

- Market Swap (`MS_v1.0`) is calculated from paired no-vig odds and does not enter ELO.
- Full Player Profile (`Player_Profile_Full_v1.0`, O10) creates a yellow Player Alert when it reverses the displayed tip.
- If Core Player Profile (`Player_Profile_Core_v1.0`, O9) and Creation Profile (`Creation_Profile_v1.0`, creation-lite/C1) reverse the same way, the signal becomes green Player Consensus.
- A protected Lineup Adjustment or any Player Alert greys out Market Swap.

## Evidence checkpoint

Retrospective 2026 regular-season replay: Base 2027 ELO 130/204; Rookie Adjustment 132/204; displayed Stage-4C selection 135/204. The player overlay changes the Dolphins v Sharks game and all three player profiles agree. These are retrospective model-development results, not archived pre-match forecasts.

Research sources: EXP-2026-034, EXP-2026-039, EXP-2026-043, EXP-2026-044 and EXP-2026-045.

