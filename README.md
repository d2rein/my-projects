# My_Site

This repo is the source for the `my-projects` Cloudflare Pages site and a few related side projects.

## Source of truth

The intended source of truth is:

1. tracked files in this repo
2. committed to git
3. deployed from a clean tracked snapshot

For a period in May 2026, some Pages deploys were made from local workspace bundles instead of from committed `main`. That means live briefly drifted ahead of git history. The current workspace has been kept because it matches the accepted live site state.

## Important production apps

- `pogo_medal_tracker_v3_1.html`
- `pokedex.html`
- `pokedex-assets/`
- `functions/api/pogo-medals-sync.js`
- `dnd5e-character-builder/`
- `pogo-pokedex/`
- `memes_v2/`

## Files and folders that are not source

These should not be treated as canonical app code:

- `.pages-deploy-public/`
- `.pages-deploy-pogo/`
- `.wrangler/`
- `deploy-pogo.log`
- `ELO/backend/node_modules/.mf/`
- local backup or cache folders under `memes_*`

## Deployment rule

Do not use a dirty workspace as the production source of truth.

Instead:

1. make changes in the normal source paths
2. test locally if needed
3. commit the wanted state
4. deploy a clean tracked snapshot with `deploy_tracked_site.ps1`

See [docs/deployment-workflow.md](docs/deployment-workflow.md) for the exact workflow, rollback notes, and meme-specific caveats.
