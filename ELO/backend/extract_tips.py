import json
import pandas as pd

with open("matches_backup.json", "r", encoding="utf-8") as f:
    data = json.load(f)

rows = []

# Wrangler paginated structure
if isinstance(data, list):
    for page in data:
        if isinstance(page, dict) and "results" in page:
            rows.extend(page["results"])
        else:
            rows.append(page)

# Single object structure
elif isinstance(data, dict) and "results" in data:
    rows = data["results"]

else:
    rows = data

df = pd.DataFrame(rows)

cols = [
    "match_key",
    "odds_tip",
    "user_tip",
    "home_odds",
    "away_odds",
    "home_odds_open",
    "away_odds_open",
    "home_odds_close",
    "away_odds_close",
]

tips = df[cols]

tips.to_csv("tips_backup.csv", index=False)

print("Total matches:", len(df))
print("Tips present:", tips["user_tip"].notna().sum())
print("Saved tips_backup.csv")