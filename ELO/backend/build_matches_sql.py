import pandas as pd

# load dataset
df = pd.read_csv("matches_final.csv")

# team id map from database
TEAM_MAP = {
    "Adelaide Rams": 18,
    "Auckland Warriors": 19,
    "Balmain Tigers": 20,
    "Brisbane Broncos": 4,
    "Canberra Raiders": 8,
    "Canterbury Bulldogs": 15,
    "Cronulla Sharks": 6,
    "Dolphins": 17,
    "Gold Coast Titans": 12,
    "Illawarra Steelers": 21,
    "Manly Sea Eagles": 7,
    "Melbourne Storm": 1,
    "NQ Cowboys": 16,
    "New Zealand Warriors": 10,
    "Newcastle Knights": 11,
    "North Sydney Bears": 22,
    "Northern Eagles": 25,
    "Parramatta Eels": 5,
    "Penrith Panthers": 3,
    "South Sydney Rabbitohs": 9,
    "St. George Dragons": 24,
    "St. George Illawarra Dragons": 13,
    "Sydney Roosters": 2,
    "Western Suburbs Magpies": 23,
    "Wests Tigers": 14
}

# convert teams to ids
df["home_team_id"] = df["home_team"].map(TEAM_MAP)
df["away_team_id"] = df["away_team"].map(TEAM_MAP)

# safety check
missing = df[df["home_team_id"].isna() | df["away_team_id"].isna()]
if not missing.empty:
    print("ERROR: Some teams were not mapped:")
    print(missing[["home_team","away_team"]].drop_duplicates())
    raise SystemExit()

# helper to format SQL values
def sql(v):
    if pd.isna(v):
        return "NULL"
    if isinstance(v,str):
        return "'" + v.replace("'","''") + "'"
    return str(v)

with open("import_matches.sql","w",encoding="utf8") as f:

    for r in df.itertuples():

        f.write(f"""
INSERT INTO matches (
match_key,
year,
round,
round_seq,
game_num,
match_index,
date,
home_team_id,
away_team_id,
home_score,
away_score,
completed,
venue_name,
match_url,
user_tip,
odds_tip,
home_odds,
away_odds,
home_odds_open,
away_odds_open,
home_odds_close,
away_odds_close
)
VALUES (
{sql(r.match_key)},
{sql(r.year)},
{sql(r.round)},
{sql(r.round_seq)},
{sql(r.game_num)},
{sql(r.match_index)},
{sql(r.date)},
{sql(r.home_team_id)},
{sql(r.away_team_id)},
{sql(r.home_score)},
{sql(r.away_score)},
{1 if pd.notna(r.home_score) else 0},
{sql(r.venue_name)},
{sql(r.match_url)},
{sql(r.user_tip)},
{sql(r.odds_tip)},
{sql(r.home_odds)},
{sql(r.away_odds)},
{sql(r.home_odds_open)},
{sql(r.away_odds_open)},
{sql(r.home_odds_close)},
{sql(r.away_odds_close)}
);
""")

print("SQL file written: import_matches.sql")
print("Rows:", len(df))