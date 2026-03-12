import pandas as pd

tips = pd.read_csv("tips_backup.csv")

# split match key
parts = tips["match_key"].str.split("|", expand=True)

tips["year"] = parts[0]
tips["round"] = parts[1]
tips["home"] = parts[2]
tips["away"] = parts[3]

# normalize finals naming
round_map = {
    "GF": "Grand Final",
    "Grand Final": "Grand Final",

    "Prelim": "Prelim Final",
    "Prelim Final": "Prelim Final",

    "Qual": "Qual Final",
    "Qualif Final": "Qual Final",

    "Semi": "Semi Final",
    "Semi Final": "Semi Final",

    "Elim Final": "Elim Final"
}

tips["round"] = tips["round"].replace(round_map)

# rebuild match key
tips["match_key"] = (
    tips["year"] + "|" +
    tips["round"] + "|" +
    tips["home"] + "|" +
    tips["away"]
)

# deduplicate finals mess
tips = (
    tips
    .sort_values("user_tip", ascending=False)
    .groupby("match_key", as_index=False)
    .first()
)

tips.to_csv("tips_clean.csv", index=False)

print("Tips after cleaning:", len(tips))