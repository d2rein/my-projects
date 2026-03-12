import pandas as pd

df = pd.read_csv("fixtures_raw_2026.csv")

print("Columns detected:", df.columns.tolist())

rows = []

for _, r in df.iterrows():

    round_text = str(r["Round"])
    round_seq = int(round_text.split()[1])

    game_num = int(r["Game"])

    match_index = (round_seq - 1) * 8 + game_num

    match_key = f"{r['Year']}|{round_text}|{r['HomeTeam']}|{r['AwayTeam']}"

    row = [
        match_key,
        r["Year"],
        round_text,
        round_seq,
        game_num,
        match_index,
        "",  # date
        r["HomeTeam"],
        r["AwayTeam"],
        "",  # home_score
        "",  # away_score
        "",  # venue
        "",  # match_url
        "",  # user_tip
        "",  # odds_tip
        "", "", "", "", "", ""  # odds columns
    ]

    rows.append(row)

cols = [
"match_key","year","round","round_seq","game_num","match_index","date",
"home_team","away_team","home_score","away_score",
"venue_name","match_url","user_tip","odds_tip",
"home_odds","away_odds","home_odds_open","away_odds_open","home_odds_close","away_odds_close"
]

out = pd.DataFrame(rows, columns=cols)

out.to_csv("fixtures_2026_ready.csv", index=False)

print("Generated", len(out), "rows")
print("Saved fixtures_2026_ready.csv")