# NRL ELO model registry

This is the permanent first stop for any question about a deployed tipping model, its component systems, or the rule to follow when signals disagree.

## Retrieval rule

1. Read `CURRENT.md` to identify the active overall model and policy.
2. Open that version's folder and read `MODEL_CARD.md` and `TIPPING_POLICY.md`.
3. Use `manifest.json` to translate production names to research/development labels and source experiments.
4. Do not answer from an experiment nickname such as Gate 6, Stage 4C, O10, or O9 without resolving it through the manifest.
5. Do not treat retrospective replay as an archived forecast. Check the provenance field.

## Version convention

Overall models use `YEAR_vMAJOR.MINOR.PATCH`.

- `MAJOR`: model shape or architecture changes.
- `MINOR`: a newly deployed composition or tipping policy.
- `PATCH`: a subsystem revision within the same deployed composition.
- Every deployed subsystem change must also bump the overall model version.

Subsystems use their own versioned identifiers, such as `ELO_v1.0` and `LA_v1.0`. Their version and the overall version are both recorded in the version manifest.

