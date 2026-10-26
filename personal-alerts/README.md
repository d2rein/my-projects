# Personal alert broker

Private Cloudflare Worker used by the Drein Alerts Android app. It accepts authenticated events from the garage monitor and ELO collector, checks Pokémon GO availability at known event start times, stores durable delivery state in D1, and sends FCM data messages to selected phones.

## Behaviour

- Pairing uses a one-use QR link or six-digit fallback code. Pairings expire after ten minutes.
- Each phone has independent `garage`, `nrl`, `nrlw`, `pogo`, and `system` switches.
- Alert IDs are stable. An `upsert` replaces the current revision; `resolve` clears it on every subscribed phone.
- Failed FCM deliveries remain in D1 and retry with bounded exponential backoff. Invalid Firebase tokens disable only the affected phone.
- The five-minute cron performs delivery maintenance and a cheap D1 due-time check. Pokémon source pages are refreshed once daily after 05:00 Brisbane time and again only when a known event is due to begin.

## Local verification

```powershell
npm install
npm test
npx wrangler d1 migrations apply personal-alerts --local
npx wrangler deploy --dry-run
```

## Production setup

1. Create a D1 database named `personal-alerts`, put its ID in `wrangler.toml`, and apply `migrations/0001_initial.sql` remotely.
2. Configure Worker secrets `ALERT_ADMIN_KEY`, `ALERT_PRODUCER_KEYS`, `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY`.
3. Deploy the Worker, then configure the Pages project with `ALERT_BROKER_URL` and the same `ALERT_ADMIN_KEY`.
4. Give the garage monitor only the `garage` producer key through `ALERT_GARAGE_KEY`; give the scheduled ELO service only the `nrl-elo` key in `alert_broker_key.txt`.

`ALERT_PRODUCER_KEYS` is a JSON object such as `{"garage":"random-key","nrl-elo":"different-random-key"}`. Producer and admin credentials never go into the APK. The app receives a revocable per-device credential during pairing and stores it in Android app-private storage.

The Android client currently expects `https://personal-alerts.d2-rein.workers.dev`; update `AlertRegistration.BROKER_URL` before building if the deployed hostname differs.
