# Recorded URLs and lifecycle

Last reviewed: 15 September 2026. Source collection uses no authenticated or
private NRL endpoint. Upload to our own API is authenticated.

## Actively requested

| URL | Recorded content | In-season cadence | Offseason cadence |
| --- | --- | --- | --- |
| `https://www.nrl.com/draw/data?competition=111&round=<ROUND>&season=<SEASON>` | Official fixtures, kickoff and venue | Daily | None |
| Each upcoming official `https://www.nrl.com/draw/.../<MATCH>/` Match Centre URL returned by the draw | Structured pre-match squads and all later published changes | Daily and one pregame capture | None |
| `https://www.sportsbet.com.au/betting/rugby-league/nrl` | H2H, main line and total | Daily and one pregame capture | None |
| `https://www.theoddssniffer.com/rugby-league/nrl` | Multi-book H2H comparison | Daily and one pregame capture | None |
| `https://api.manifold.markets/v0/search-markets?term=NRL&sort=liquidity&filter=open&limit=100` | Open NRL prediction-market search | Daily | Weekly |
| `https://gamma-api.polymarket.com/public-search?q=NRL` | NRL prediction-market search | Daily | Weekly |
| `https://www.nrl.com/news/topic/tipping/` | Official tipping article index | Daily | None |
| Each new `https://www.nrl.com/news/2026/...tipping...` URL found on that index | Raw expert-tip article | Once only, maximum three new articles per run | None |
| `https://www.sportsbet.com.au/betting/rugby-league/outrights` | Raw rugby-league outright pages; normalized prices where present | None | Weekly |
| `https://www.sportsbet.com.au/betting/rugby-league/nrl-futures-byo` | NRL/expansion futures and normalized prices | None | Weekly |

The Odds Sniffer page currently exposes prices attributed to Sportsbet, TAB,
Ladbrokes, BetRight and PointsBet. Those bookmaker sites are not separately
requested by this collector.

## Not currently requested

- The Odds API NRL endpoint: requires an API account/key.
- Betfair exchange: requires credentials and market mapping.
- Logged-in tipping competitions and their fan percentages.
- Articles or blogs outside the official NRL tipping index.

## Automatic lifecycle

- Through the confirmed 2026 Grand Final on Sunday 4 October: daily market
  snapshot plus the existing one-hour pregame capture.
- From Monday 5 October through 28 February: the pregame task exits without a
  request and the daily task exits on six days of the week. On Mondays it makes
  one offseason futures/prediction-market snapshot.
- From 1 March 2027: daily and pregame collection resume automatically for the
  new season.

The Windows tasks trigger locally, while the wrapper enforces this policy
before invoking any network collection. Both tasks were upgraded to S4U with
startup triggers on 15 September 2026. A note in the wrapper requires each
future official Grand Final date to be checked when that draw is released.

Normalized team lists are uploaded to
`https://nrl-elo-api.d2-rein.workers.dev/api/prospective/team-lists`. `GET` is
public for the preview; `POST` requires the collector-only bearer credential.
The credential is stored in the local service directory with a restricted ACL
and as a Cloudflare Worker secret, never in source control.
