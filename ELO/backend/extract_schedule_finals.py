import pandas as pd

matches = pd.read_csv("matches_staging.csv")

finals = matches[
    ~matches["round"].astype(str).str.startswith("Rd ")
].copy()

finals = finals.sort_values(
    ["year", "round", "home_team", "away_team"],
    kind="stable"
).reset_index(drop=True)

finals.to_csv("schedule_finals_review.csv", index=False)

print("Schedule finals rows:", len(finals))
print("Saved schedule_finals_review.csv")