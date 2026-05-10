# DND 5e Character Builder

This app is a separate build forked from `dnd-bladesinger-pwa`.

The existing bladesinger app is intentionally left untouched.

## Current focus

- Build a general 5e character builder instead of a single-character sheet
- Scrape 5e Wikidot data for lineages, backgrounds, feats, classes, and subclasses
- Preserve mechanical text that affects stats, rolls, actions, uses, rests, and progression

## Data workflow

Run:

```powershell
python scrape_dnd5e_wikidot.py
```

This writes structured JSON into `data/dnd5e/`.

## Important isolation notes

- Local app storage key is `dnd5e_character_builder_v1`
- Service worker cache is `dnd5e-character-builder-v1`
- The original `dnd-bladesinger-pwa` directory is unchanged
