"""One-off/recovery uploader for the append-only prospective Elo API tables."""
from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from urllib.request import Request, urlopen


def post(url: str, token: str, payload: dict) -> dict:
    request = Request(url, data=json.dumps(payload).encode("utf-8"), method="POST", headers={
        "Content-Type": "application/json", "Authorization": f"Bearer {token}",
        "User-Agent": "NRL-Elo-Archive-Recovery/1.0",
    })
    with urlopen(request, timeout=60) as response:
        return json.load(response)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive-dir", required=True, type=Path)
    parser.add_argument("--forecast", required=True, type=Path)
    parser.add_argument("--api-url", required=True)
    parser.add_argument("--token-file", required=True, type=Path)
    parser.add_argument("--skip-markets", action="store_true")
    parser.add_argument("--forecast-status")
    args = parser.parse_args()
    token = args.token_file.read_text(encoding="utf-8-sig").strip()
    rows = [] if args.skip_markets else list(csv.DictReader(
        (args.archive_dir / "observations/market_observations.csv").open(encoding="utf-8-sig")))
    market_results = []
    for start in range(0, len(rows), 500):
        market_results.append(post(args.api_url.rstrip("/") + "/api/prospective/markets", token,
                                   {"observations": rows[start:start + 500]}))
    forecast = json.loads(args.forecast.read_text(encoding="utf-8"))
    if args.forecast_status:
        for row in forecast.get("forecasts", []):
            row["forecastStatus"] = args.forecast_status
    forecast_result = post(args.api_url.rstrip("/") + "/api/prospective/forecasts", token, forecast)
    print(json.dumps({"market_rows": len(rows), "market_batches": market_results,
                      "forecast": forecast_result}, indent=2))


if __name__ == "__main__":
    main()
