import pandas as pd

matches = pd.read_csv("matches_staging.csv")
tips = pd.read_csv("tips_clean.csv")

missing = sorted(set(tips["match_key"]) - set(matches["match_key"]))

print("Missing tips:", len(missing))

for m in missing[:200]:
    print(m)