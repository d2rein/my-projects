# Adelaide Oval Scoreboard Revival

This rebuild keeps the original project idea, but moves the fragile logic out of the template and into `app.py` so the display is easier to tune.

## Run locally

1. Create or activate a Python environment.
2. Install dependencies with `pip install -r requirements.txt`.
3. Start the app with `python app.py`.
4. Open `http://127.0.0.1:5000/` on your phone in landscape mode.

## Data mode

`match_config.json` currently runs in local-file mode using `match_scorecard.json`.

To try live data later:

- Set `"use_local_only": false`
- Add a valid `api_key`
- Set the `match_id` for the live match you want to track

If the API request fails, the app falls back to the local JSON file.

## Notes

- The layout is tuned for a full-screen phone view and auto-refreshes using `refresh_seconds`.
- If your configured XI does not match the loaded scorecard, the app falls back to the player names inside the scorecard so the board still fills correctly.
- The current `FOW` column uses a simple dismissed-batter summary; proper ball-by-ball wicket progression will be better once we wire in live over data.
