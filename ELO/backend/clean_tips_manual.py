import pandas as pd

tips = pd.read_csv("tips_backup.csv")

# load mappings
finals_map = pd.read_csv("finals_key_mapping.csv")
round2018_map = pd.read_csv("2018_round_mapping.csv")

mapping_dict = {}

mapping_dict.update(dict(zip(finals_map.old_match_key, finals_map.new_match_key)))
mapping_dict.update(dict(zip(round2018_map.old_match_key, round2018_map.new_match_key)))

# apply mappings
tips["match_key"] = tips["match_key"].replace(mapping_dict)

# deduplicate after mapping
tips = (
    tips
    .sort_values(
        by=[
            "user_tip",
            "odds_tip",
            "home_odds",
            "away_odds",
            "home_odds_open",
            "away_odds_open",
            "home_odds_close",
            "away_odds_close"
        ],
        ascending=False,
        na_position="last",
        kind="stable"
    )
    .groupby("match_key", as_index=False)
    .first()
)

tips.to_csv("tips_clean.csv", index=False)

print("Tips after mapping:", len(tips))