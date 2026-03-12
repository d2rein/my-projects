import pandas as pd
from pathlib import Path

BASE = Path(__file__).resolve().parent

matches_file = BASE / "matches_staging.csv"
tips_file = BASE / "tips_clean.csv"

out_file = BASE / "matches_final.csv"

matches = pd.read_csv(matches_file)
tips = pd.read_csv(tips_file)

# keep only tip + odds columns
tips = tips[
    [
        "match_key",
        "user_tip",
        "odds_tip",
        "home_odds",
        "away_odds",
        "home_odds_open",
        "away_odds_open",
        "home_odds_close",
        "away_odds_close",
    ]
]

merged = matches.merge(
    tips,
    on="match_key",
    how="left"
)

merged.to_csv(out_file, index=False)

print("Matches:", len(matches))
print("Tips rows:", len(tips))
print("Merged rows:", len(merged))

print("User tips restored:", merged["user_tip"].notna().sum())
print("Odds restored:", merged["home_odds"].notna().sum())

print("Saved:", out_file)