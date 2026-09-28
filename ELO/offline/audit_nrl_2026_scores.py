"""Audit the manually maintained 2026 men's ELO scores against NRL.com and RLDB."""
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


def key(value: object) -> str:
    text = re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()
    aliases = {"cronulla sutherland sharks": "sharks", "cronulla sharks": "sharks",
               "north queensland cowboys": "cowboys", "nq cowboys": "cowboys",
               "new zealand warriors": "warriors", "canterbury bankstown bulldogs": "bulldogs",
               "penrith panthers": "panthers",
               "canterbury bulldogs": "bulldogs", "st george illawarra dragons": "dragons",
               "st illawarra dragons": "dragons", "manly warringah sea eagles": "sea eagles",
               "manly sea eagles": "sea eagles", "south sydney rabbitohs": "rabbitohs",
               "sydney roosters": "roosters", "brisbane broncos": "broncos",
               "melbourne storm": "storm", "newcastle knights": "knights",
               "canberra raiders": "raiders", "gold coast titans": "titans",
               "parramatta eels": "eels", "wests tigers": "tigers"}
    return aliases.get(text, text)


def round_key(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "").lower().replace("round", "rd").replace("week", "wk").strip())


def official() -> list[dict]:
    rows = []
    for round_number in range(1, 32):
        url = DRAW_URL + "?" + urlencode({"competition": 111, "round": round_number, "season": 2026})
        with urlopen(Request(url, headers={"User-Agent": "NRL-Elo-Score-Audit/1.0"}), timeout=45) as response:
            payload = json.load(response)
        for fixture in payload.get("fixtures", []):
            home, away = fixture.get("homeTeam") or {}, fixture.get("awayTeam") or {}
            if fixture.get("matchState") != "FullTime" or home.get("score") is None or away.get("score") is None:
                continue
            rows.append({"round": fixture.get("roundTitle"), "home": home.get("nickName"), "away": away.get("nickName"),
                         "home_score": int(home["score"]), "away_score": int(away["score"]), "venue": fixture.get("venue"),
                         "kickoff": (fixture.get("clock") or {}).get("kickOffTimeLong"),
                         "source_url": "https://www.nrl.com" + fixture.get("matchCentreUrl", "")})
    return rows


def match_row(target: dict, rows: list[dict], used: set[int], home_field: str, away_field: str) -> tuple[int, dict] | None:
    candidates = [(index, row) for index, row in enumerate(rows) if index not in used and
                  key(row[home_field]) == key(target["home"]) and key(row[away_field]) == key(target["away"])
                  and round_key(row.get("round") or row.get("round_label")) == round_key(target["round"])]
    if len(candidates) > 1:
        target_date = str(target.get("kickoff") or "")[:10]
        dated = [item for item in candidates if str(item[1].get("kickoff") or item[1].get("match_date_utc") or "")[:10] == target_date]
        if dated: candidates = dated
    return candidates[0] if candidates else None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", required=True, type=Path); parser.add_argument("--site-api", required=True)
    parser.add_argument("--out-dir", required=True, type=Path)
    args = parser.parse_args(); args.out_dir.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(f"file:{args.database.resolve().as_posix()}?mode=ro", uri=True); db.row_factory = sqlite3.Row
    rldb = [dict(row) for row in db.execute("""SELECT m.match_id,m.round_label,m.match_date_utc,
      ht.canonical_name home,at.canonical_name away,m.home_score,m.away_score,COALESCE(v.canonical_name,'') venue
      FROM matches m JOIN teams ht ON ht.team_id=m.home_team_id JOIN teams at ON at.team_id=m.away_team_id
      LEFT JOIN venues v ON v.venue_id=m.venue_id WHERE m.competition_id=1 AND m.season=2026
      AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL ORDER BY m.match_date_utc,m.match_id""")]; db.close()
    with urlopen(Request(args.site_api.rstrip("/")+"/api/matches?limit=20000", headers={"User-Agent":"NRL-Elo-Score-Audit/1.0"}), timeout=60) as response:
        site = [{"site_id": row["id"], "round": row["round"], "kickoff": None, "home": row["home_team"], "away": row["away_team"],
                 "home_score": row["home_score"], "away_score": row["away_score"]} for row in json.load(response)
                if int(row["year"]) == 2026 and row["home_score"] is not None and row["away_score"] is not None]
    rldb_used: set[int] = set(); site_used: set[int] = set(); audit = []
    for source in official():
        rldb_match = match_row(source, rldb, rldb_used, "home", "away")
        site_match = match_row(source, site, site_used, "home", "away")
        if rldb_match: rldb_used.add(rldb_match[0])
        if site_match: site_used.add(site_match[0])
        rr, sr = rldb_match[1] if rldb_match else {}, site_match[1] if site_match else {}
        rldb_ok = bool(rr) and int(rr["home_score"]) == source["home_score"] and int(rr["away_score"]) == source["away_score"]
        site_ok = bool(sr) and int(sr["home_score"]) == source["home_score"] and int(sr["away_score"]) == source["away_score"]
        audit.append({**source, "rldb_match_id": rr.get("match_id"), "rldb_home_score": rr.get("home_score"),
                      "rldb_away_score": rr.get("away_score"), "site_id": sr.get("site_id"),
                      "site_home_score": sr.get("home_score"), "site_away_score": sr.get("away_score"),
                      "rldb_match": rldb_ok, "site_match": site_ok,
                      "status": "match" if rldb_ok and site_ok else "mismatch"})
    fields = list(audit[0])
    with (args.out_dir/"score_audit.csv").open("w",encoding="utf-8",newline="") as handle:
        writer=csv.DictWriter(handle,fieldnames=fields);writer.writeheader();writer.writerows(audit)
    summary={"officialCompleted":len(audit),"rldbCompleted":len(rldb),"siteCompleted":len(site),
             "officialRldbMatches":sum(row["rldb_match"] for row in audit),
             "officialSiteMatches":sum(row["site_match"] for row in audit),
             "mismatches":[row for row in audit if row["status"]!="match"],
             "unmatchedRldb":[rldb[i] for i in range(len(rldb)) if i not in rldb_used],
             "unmatchedSite":[site[i] for i in range(len(site)) if i not in site_used]}
    (args.out_dir/"summary.json").write_text(json.dumps(summary,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(summary,indent=2)); return 0


if __name__ == "__main__": raise SystemExit(main())
