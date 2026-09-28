"""Audit official NRL.com 2026 NRLW results against read-only RLDB and the site cache."""
from __future__ import annotations

import argparse
import csv
import json
import re
import sqlite3
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

DRAW_URL = "https://www.nrl.com/draw/data"


def team_key(value: object) -> str:
    text = re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()
    for token in ("women", "womens", "nrlw", "rugby", "league"):
        text = re.sub(rf"\b{token}\b", "", text)
    aliases = {
        "cronulla sutherland sharks": "sharks", "newcastle knights": "knights",
        "st george illawarra dragons": "dragons", "canberra raiders": "raiders",
        "brisbane broncos": "broncos", "north queensland cowboys": "cowboys",
        "canterbury bankstown bulldogs": "bulldogs", "new zealand warriors": "warriors",
        "sydney roosters": "roosters", "gold coast titans": "titans",
        "parramatta eels": "eels", "wests tigers": "wests tigers",
    }
    text = " ".join(text.split())
    return aliases.get(text, text)


def round_key(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "").lower().replace("round", "rd").strip())


def official_results() -> list[dict]:
    rows: list[dict] = []
    for round_number in range(1, 15):
        url = DRAW_URL + "?" + urlencode({"competition": 161, "round": round_number, "season": 2026})
        request = Request(url, headers={"User-Agent": "NRL-Elo-Score-Audit/1.0"})
        with urlopen(request, timeout=45) as response:
            payload = json.load(response)
        for fixture in payload.get("fixtures", []):
            home, away = fixture.get("homeTeam") or {}, fixture.get("awayTeam") or {}
            if fixture.get("matchState") != "FullTime" or home.get("score") is None or away.get("score") is None:
                continue
            rows.append({
                "round": fixture.get("roundTitle"), "kickoff": (fixture.get("clock") or {}).get("kickOffTimeLong"),
                "home": home.get("nickName"), "away": away.get("nickName"),
                "home_score": int(home["score"]), "away_score": int(away["score"]),
                "venue": fixture.get("venue"), "source_url": "https://www.nrl.com" + fixture.get("matchCentreUrl", ""),
            })
    return rows


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", required=True, type=Path)
    parser.add_argument("--site-cache", required=True, type=Path)
    parser.add_argument("--out-dir", required=True, type=Path)
    args = parser.parse_args(); args.out_dir.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(f"file:{args.database.resolve().as_posix()}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    rldb = [dict(row) for row in connection.execute("""
      SELECT m.match_id,m.round_label,m.match_date_utc,ht.canonical_name home,at.canonical_name away,
             m.home_score,m.away_score,COALESCE(v.canonical_name,'') venue
      FROM matches m JOIN teams ht ON ht.team_id=m.home_team_id JOIN teams at ON at.team_id=m.away_team_id
      LEFT JOIN venues v ON v.venue_id=m.venue_id
      WHERE m.competition_id=2 AND m.season=2026 AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL
      ORDER BY m.match_date_utc,m.match_id
    """)]
    connection.close()
    cache = json.loads(args.site_cache.read_text(encoding="utf-8"))
    site = [row for row in cache["matches"] if row["year"] == 2026 and row.get("rldbId") is not None]
    site_by_id = {int(row["rldbId"]): row for row in site}
    unused = set(range(len(rldb))); audit = []
    for official in official_results():
        candidates = [index for index in unused if team_key(rldb[index]["home"]) == team_key(official["home"])
                      and team_key(rldb[index]["away"]) == team_key(official["away"])
                      and round_key(rldb[index]["round_label"]) == round_key(official["round"])]
        if not candidates:
            candidates = [index for index in unused if team_key(rldb[index]["home"]) == team_key(official["away"])
                          and team_key(rldb[index]["away"]) == team_key(official["home"])
                          and round_key(rldb[index]["round_label"]) == round_key(official["round"])]
        if not candidates:
            audit.append({**official, "status": "missing_in_rldb"}); continue
        index = candidates[0]; unused.remove(index); record = rldb[index]
        reversed_sides = team_key(record["home"]) == team_key(official["away"])
        rldb_home = int(record["away_score"] if reversed_sides else record["home_score"])
        rldb_away = int(record["home_score"] if reversed_sides else record["away_score"])
        site_row = site_by_id.get(int(record["match_id"])); site_home = site_row.get("hs") if site_row else None; site_away = site_row.get("as") if site_row else None
        if reversed_sides and site_row:
            site_home, site_away = site_away, site_home
        score_match = official["home_score"] == rldb_home and official["away_score"] == rldb_away
        site_match = site_row is not None and official["home_score"] == site_home and official["away_score"] == site_away
        audit.append({**official, "rldb_match_id": record["match_id"], "rldb_home_score": rldb_home,
                      "rldb_away_score": rldb_away, "site_home_score": site_home, "site_away_score": site_away,
                      "reversed_orientation": reversed_sides, "score_match": score_match,
                      "site_match": site_match, "status": "match" if score_match and site_match else "mismatch"})
    fields = sorted({key for row in audit for key in row})
    with (args.out_dir / "score_audit.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields); writer.writeheader(); writer.writerows(audit)
    summary = {"officialCompleted": len(audit), "rldbCompleted": len(rldb),
               "officialRldbMatches": sum(row.get("score_match") is True for row in audit),
               "officialSiteMatches": sum(row.get("site_match") is True for row in audit),
               "mismatches": [row for row in audit if row["status"] != "match"],
               "rldbRowsNotMatchedToOfficial": [rldb[index] for index in sorted(unused)]}
    (args.out_dir / "summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2)); return 0


if __name__ == "__main__":
    raise SystemExit(main())
