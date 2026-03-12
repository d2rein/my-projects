import re
from datetime import datetime

# team name fixes
TEAM_MAP = {
    "Brisbane": "Brisbane Broncos",
    "North Qld": "NQ Cowboys",
    "Sydney": "Sydney Roosters",
    "Warriors": "New Zealand Warriors",
    "St Geo Illa": "St. George Illawarra Dragons",
    "Gold Coast": "Gold Coast Titans",
    "Canterbury": "Canterbury Bulldogs",
}

MONTH_MAP = {
    "Feb": 2,
    "Mar": 3,
    "Apr": 4,
    "May": 5,
    "Jun": 6,
    "Jul": 7,
    "Aug": 8,
    "Sep": 9
}

rows = []
round_seq = None
match_index = 5625   # continue after your historical matches

with open("draw_2026.txt", encoding="utf8") as f:
    lines = f.readlines()

for line in lines:

    line=line.strip()

    # detect round
    m = re.match(r"Round (\d+)", line)
    if m:
        round_seq = int(m.group(1))
        game_num = 0
        continue

    if not line.startswith("NRL 2026"):
        continue

    parts = re.split(r"\s{2,}", line)

    try:

        date_part = parts[1]
        home = parts[3]
        home_score = parts[4]
        away = parts[5]
        away_score = parts[6]
        venue = parts[8]

        # date handling
        date = ""
        m = re.match(r"([A-Za-z]{3}) (\d+)", date_part)
        if m:
            month = MONTH_MAP[m.group(1)]
            day = int(m.group(2))
            date = datetime(2026, month, day).strftime("%Y-%m-%d")

        # team normalisation
        home = TEAM_MAP.get(home, home)
        away = TEAM_MAP.get(away, away)

        game_num += 1

        match_key = f"2026_R{round_seq}_{game_num}"

        if home_score == "":
            home_score = ""
        if away_score == "":
            away_score = ""

        row = [
            match_key,
            2026,
            f"Rd {round_seq}",
            round_seq,
            game_num,
            match_index,
            date,
            home,
            away,
            home_score,
            away_score,
            venue,
            "", "", "", "", "", "", "", "", ""
        ]

        rows.append(row)

        match_index += 1

    except:
        continue


with open("fixtures_2026.csv","w",encoding="utf8") as f:

    for r in rows:
        f.write(",".join(map(str,r))+"\n")

print("Generated rows:",len(rows))
print("Saved to fixtures_2026.csv")