# Deployment Workflow

## Goal

Keep production reproducible and easy for future agents to reason about.

That means:

- git is the durable record
- direct deploy bundles are disposable
- Pages config lives in source control
- rollback happens by commit, not by guessing which local folder was last deployed

## Current Pages project

- Project: `my-projects`
- Current KV binding for Pokemon GO sync: `POGO_TRACKER_KV`
- Binding id: `59af78bb943d4dfe9f0eac05de80fd06`

Root config lives in [wrangler.toml](../wrangler.toml).

## What happened before

In May 2026, some deploys were performed from `.pages-deploy-public/`, which was a hand-built deploy bundle. That made live newer than `origin/main`.

That bundle should now be treated as a temporary transport artifact only, not as the real source tree.

## Correct workflow

1. Edit the real source files in the repo.
2. Keep local junk and deploy bundles out of git.
3. Commit the accepted state.
4. Deploy from a clean tracked snapshot with [deploy_tracked_site.ps1](../deploy_tracked_site.ps1).

## Why not deploy the raw workspace?

The workspace contains local-only material:

- scratch files
- logs
- backup folders
- generated caches
- alternate deploy bundles

Deploying the raw workspace makes production hard to reproduce and hard for future agents to audit.

## Standard deploy command

From the repo root, after committing the wanted state:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy_tracked_site.ps1
```

That script:

- archives `HEAD`
- deploys only tracked committed files
- avoids deploying local junk from the workspace

## Rollback strategy

The safest rollback point is a git commit that represents an accepted production state.

When the site is in a known-good condition:

1. commit the desired repo state
2. optionally tag it
3. if rollback is ever needed, redeploy that commit

## Meme search caveat

`memes_v2/` contains a large library and is now deployed as its own Pages app.

The normal `my-projects` deploy script removes `memes_v2` from the deployment bundle before upload.

That means:

- typo fixes on the main site no longer need to upload the meme library
- meme updates should go through `memes_v2/update_site.bat`

Homepage links to the standalone meme app instead of serving it from the `my-projects` Pages bundle.

## Legacy meme v1 note

There may still be older `memes/` history on GitHub from v1. The active note for that is [memes_v2/V1_REDEPLOY_NOTES.md](../memes_v2/V1_REDEPLOY_NOTES.md).

Important distinction:

- removing `memes/` from the current branch stops it being in current deploys
- it does not erase old Git history by itself

If GitHub storage cleanup is needed later, that is a separate history-rewrite task and should be handled deliberately.

## Future-agent instructions

If live and git disagree:

1. verify whether a direct local deploy happened
2. compare live against the workspace and tracked source
3. reconcile the accepted live state back into normal source paths
4. commit before making further production changes

Do not assume `origin/main` is production unless the deploy process has clearly been brought back under commit-based control.
