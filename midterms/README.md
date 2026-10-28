# Midterm 2026 dashboard

The dashboard is published as a static section of the main site at `https://drein.net/midterms/`.

## Run

```powershell
cd midterms
npm run refresh
npm start
```

Open `http://127.0.0.1:4176`.

`npm run refresh` reads the data delivered to logged-out visitors by FiftyPlusOne's public House and Senate forecast pages. FiftyPlusOne supplies the primary chamber and race probabilities. The script also reads:

- FiftyPlusOne's public daily generic-ballot and presidential-approval averages for the national-climate charts. Both charts show the component percentages on a fixed 30–70% scale rather than connecting individual polls.
- Polling Forecast's free API for candidate/poll metadata, comparison probabilities, and one Louisiana ballot-format fallback.
- Public Cook, RCP and Inside Elections rating pages through a free text renderer, because the publishers' sites block ordinary automated requests. Links always point to the original publisher. RCP's full public Senate race-change table feeds the chronology.
- Polymarket's public Gamma and CLOB endpoints for current chamber/race prices and price histories. Current prices are cached for every confidently matched market; histories are filled in small daily batches, while local snapshots extend every race's series.
- The public-domain UnitedStates/congress-legislators dataset for Senate seats not up in 2026.

The updater writes a current cache, one full Brisbane-dated snapshot per day, and `data/snapshots/index.json`. Re-running it on the same Brisbane date replaces that day's snapshot; earlier days remain full records for the chronological feed, seat movement markers, and market histories. A temporary optional-source failure preserves the prior cache rather than erasing it.

## Daily update

The GitHub Actions workflow `.github/workflows/midterms-daily.yml` runs at 10:15am Australia/Brisbane time (`00:15 UTC`) and can also be run manually. It refreshes the cache, validates the output, commits that day's snapshot, and pushes to `main`. The existing Cloudflare Pages Git integration then deploys the commit automatically.

Optional hand-entered ratings can still be recorded in `data/manual-sources.json`. They remain separate from the primary model and automated public-source cache.

The refresh script only updates the local static cache; publishing still uses the repository's tracked-files-only deployment workflow. It does not log in to a source or bypass a paywall.
