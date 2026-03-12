import pandas as pd

tips = pd.read_csv("tips_backup.csv")

parts = tips["match_key"].str.split("|", expand=True)

tips["year"] = parts[0]
tips["round"] = parts[1]
tips["home"] = parts[2]
tips["away"] = parts[3]

# identify finals
finals = tips[
    tips["round"].str.contains(
        "qual|elim|semi|prelim|gf|final",
        case=False,
        na=False
    )
]

# only keep rows that actually contain tip/odds data
finals = finals[
    finals["user_tip"].notna() |
    finals["odds_tip"].notna()
]

finals = finals.sort_values(["year", "round", "home"])

finals.to_csv("final_tips_review.csv", index=False)

print("Finals with tip data:", len(finals))
print("Saved: final_tips_review.csv")