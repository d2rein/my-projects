"""Build the read-only NRLW website cache from RLDB and OddsPortal.

The displayed model is the full-history NRLW fit. Rookie Gate 6 is retained
as a shadow diagnostic only: it never changes the published probability or
tip. The generated cache is presentation data; it does not mutate RLDB or the
production Elo database.
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sqlite3
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
from bs4 import BeautifulSoup


ODDS_URL = "https://www.oddsportal.com/rugby-league/australia/nrl-women{suffix}/results/"
USER_AGENT = "Mozilla/5.0 (compatible; NRL-Elo-Research/1.0)"
MODEL_ID = "NRLW_2027_v1.0.0"
INITIAL_RATING = 1500.0
ENTRY_PRIOR = 1400.0
K_BASE = 28.0
HOME_ADVANTAGE = 0.0
EARLY_BOOST = 0.0
REVERSION_WEIGHT = 0.75
PROBABILITY_DIVISOR = 150.0
TRAVEL_WEIGHT = 0.0
REST_WEIGHT = 5.0
STREAK_WEIGHT = 2.0
MARGIN_COEFFICIENT = 0.1325
TEAM_BASES = {
    "Brisbane Broncos": (-27.4698, 153.0251),
    "Canberra Raiders": (-35.2809, 149.13),
    "Canterbury-Bankstown Bulldogs": (-33.8688, 151.2093),
    "Cronulla-Sutherland Sharks": (-34.0574, 151.152),
    "Gold Coast Titans": (-28.0167, 153.4),
    "New Zealand Warriors": (-36.8485, 174.7633),
    "Newcastle Knights": (-32.9283, 151.7817),
    "North Queensland Cowboys": (-19.2589, 146.8169),
    "Parramatta Eels": (-33.815, 151.0011),
    "St George Illawarra Dragons": (-34.4278, 150.8931),
    "Sydney Roosters": (-33.8688, 151.2093),
    "Wests Tigers": (-33.884, 151.12),
}
ODDS_ALIASES = {
    "Brisbane Broncos": "Brisbane Broncos",
    "Canberra Raiders": "Canberra Raiders",
    "Canterbury-Bankstown Bulldogs": "Canterbury-Bankstown Bulldogs",
    "Cronulla Sharks": "Cronulla-Sutherland Sharks",
    "Gold Coast Titans": "Gold Coast Titans",
    "New Zealand Warriors": "New Zealand Warriors",
    "Newcastle Knights": "Newcastle Knights",
    "NQ Cowboys": "North Queensland Cowboys",
    "Parramatta Eels": "Parramatta Eels",
    "St. George Illawarra Dragons": "St George Illawarra Dragons",
    "Sydney Roosters": "Sydney Roosters",
    "Wests Tigers": "Wests Tigers",
}


def fetch(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html"})
    with urllib.request.urlopen(request, timeout=45) as response:
        return response.read()


def odds_team(value: str) -> str:
    value = re.sub(r"\s+W$", "", value.strip())
    return ODDS_ALIASES.get(value, value)


def parse_odds_page(payload: bytes, season: int) -> list[dict[str, Any]]:
    soup = BeautifulSoup(payload, "html.parser")
    seen: set[str] = set()
    rows: list[dict[str, Any]] = []
    for anchor in soup.select('a[href*="/rugby-league/h2h/"]'):
        href = str(anchor.get("href") or "")
        if href in seen:
            continue
        names = [odds_team(node.get_text(" ", strip=True)) for node in anchor.find_all("p")
                 if node.get_text(" ", strip=True).endswith(" W")]
        if len(names) != 2:
            continue
        container = anchor.parent
        prices = [node.get_text(" ", strip=True) for node in container.find_all("li")[:3]] if container else []
        if len(prices) < 3:
            continue
        try:
            home_odds = float(prices[0])
            draw_odds = float(prices[1])
            away_odds = float(prices[2])
        except ValueError:
            continue
        scores = [node.get_text(" ", strip=True) for node in anchor.find_all("span")
                  if "font-bold" in (node.get("class") or []) and node.get_text(" ", strip=True).isdigit()]
        group = container.parent if container else None
        header = group.previous_sibling.get_text(" ", strip=True) if group and hasattr(group.previous_sibling, "get_text") else ""
        date_match = re.search(r"(\d{1,2}\s+[A-Z][a-z]{2}\s+\d{4})", header)
        date = datetime.strptime(date_match.group(1), "%d %b %Y").date().isoformat() if date_match else None
        rows.append({
            "season": season, "date": date, "home": names[0], "away": names[1],
            "home_score": int(scores[0]) if len(scores) >= 2 else None,
            "away_score": int(scores[-1]) if len(scores) >= 2 else None,
            "home_odds": home_odds, "draw_odds": draw_odds, "away_odds": away_odds,
            "source_url": "https://www.oddsportal.com" + href.split("#", 1)[0],
        })
        seen.add(href)
    return rows


def load_odds(cache_path: Path, refresh: bool) -> list[dict[str, Any]]:
    if cache_path.exists() and not refresh:
        return json.loads(cache_path.read_text(encoding="utf-8"))
    rows: list[dict[str, Any]] = []
    for season in range(2019, 2027):
        suffix = "" if season == 2026 else f"-{season}"
        rows.extend(parse_odds_page(fetch(ODDS_URL.format(suffix=suffix)), season))
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(rows, indent=2) + "\n", encoding="utf-8")
    return rows


def distance_units(away: str, home: str) -> float:
    if away not in TEAM_BASES or home not in TEAM_BASES:
        return 0.0
    lat1, lon1 = map(math.radians, TEAM_BASES[away])
    lat2, lon2 = map(math.radians, TEAM_BASES[home])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    value = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 6371.0 * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value)) / 1000.0


def margin_multiplier(margin: int) -> float:
    return 0.75 * (abs(margin) / 6.0) ** 0.75


def load_matches(db: sqlite3.Connection) -> list[dict[str, Any]]:
    query = """
      SELECT m.match_id,m.season,m.round_label,m.round_index,m.match_date_utc,m.is_finals,
             m.home_team_id,m.away_team_id,th.canonical_name AS home,ta.canonical_name AS away,
             m.home_score,m.away_score,v.canonical_name AS venue
      FROM matches m
      JOIN teams th ON th.team_id=m.home_team_id
      JOIN teams ta ON ta.team_id=m.away_team_id
      LEFT JOIN venues v ON v.venue_id=m.venue_id
      WHERE m.competition_id=2
      ORDER BY m.season,COALESCE(m.match_date_utc,''),m.round_index,m.match_id
    """
    rows = [dict(row) for row in db.execute(query)]
    for index, row in enumerate(rows):
        row["index"] = index
    return rows


def project_nrlw_finals(matches: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Add only the next knowable finals round when RLDB has not stored it yet."""
    if not matches:
        return matches
    latest_year = max(int(row["season"]) for row in matches)
    season = [row for row in matches if int(row["season"]) == latest_year]
    if any(row["home_score"] is None or row["away_score"] is None for row in season):
        return matches

    names_to_ids: dict[str, int] = {}
    for row in season:
        names_to_ids[row["home"]] = int(row["home_team_id"])
        names_to_ids[row["away"]] = int(row["away_team_id"])

    regular = [row for row in season if not row["is_finals"]]
    ladder: dict[str, dict[str, int]] = defaultdict(lambda: {"points": 0, "diff": 0, "for": 0})
    for row in regular:
        home, away = row["home"], row["away"]
        home_score, away_score = int(row["home_score"]), int(row["away_score"])
        ladder[home]["for"] += home_score
        ladder[away]["for"] += away_score
        ladder[home]["diff"] += home_score - away_score
        ladder[away]["diff"] += away_score - home_score
        if home_score > away_score:
            ladder[home]["points"] += 2
        elif away_score > home_score:
            ladder[away]["points"] += 2
        else:
            ladder[home]["points"] += 1
            ladder[away]["points"] += 1
    ordered = sorted(ladder, key=lambda team: (-ladder[team]["points"], -ladder[team]["diff"], -ladder[team]["for"], team))
    rank = {team: index + 1 for index, team in enumerate(ordered)}

    def completed(round_label: str) -> list[dict[str, Any]]:
        return [row for row in season if row["round_label"] == round_label
                and row["home_score"] is not None and row["away_score"] is not None]

    def winners(rows: list[dict[str, Any]]) -> list[str]:
        return [row["home"] if int(row["home_score"]) > int(row["away_score"]) else row["away"] for row in rows]

    projected: list[tuple[str, str, str, int]] = []
    week_one = completed("Finals Week 1")
    week_two = completed("Finals Week 2")
    has_week_two = any(row["round_label"] == "Finals Week 2" for row in season)
    has_grand_final = any(row["round_label"] == "Grand Final" for row in season)
    if len(week_one) == 2 and not has_week_two and len(ordered) >= 2:
        advancing = sorted(winners(week_one), key=lambda team: rank[team], reverse=True)
        projected = [
            ("Finals Week 2", ordered[0], advancing[0], 13),
            ("Finals Week 2", ordered[1], advancing[1], 13),
        ]
    elif len(week_two) == 2 and not has_grand_final:
        advancing = sorted(winners(week_two), key=lambda team: rank[team])
        projected = [("Grand Final", advancing[0], advancing[1], 14)]

    for offset, (round_label, home, away, round_index) in enumerate(projected, start=1):
        matches.append({
            "match_id": -(latest_year * 10 + offset), "season": latest_year,
            "round_label": round_label, "round_index": round_index,
            "match_date_utc": None, "is_finals": 1,
            "home_team_id": names_to_ids[home], "away_team_id": names_to_ids[away],
            "home": home, "away": away, "home_score": None, "away_score": None,
            "venue": None, "projected": True,
        })
    for index, row in enumerate(matches):
        row["index"] = index
    return matches


def project_nrlw_grand_final(matches: list[dict[str, Any]], base: dict[int, dict[str, float]]) -> bool:
    """Complete the visible bracket using frozen core tips for an unplayed week two."""
    latest_year = max(int(row["season"]) for row in matches)
    season = [row for row in matches if int(row["season"]) == latest_year]
    if any(row["round_label"] == "Grand Final" for row in season):
        return False
    week_two = sorted((row for row in season if row["round_label"] == "Finals Week 2"),
                      key=lambda row: int(row["index"]))
    if len(week_two) != 2:
        return False
    winners = []
    for row in week_two:
        if row["home_score"] is not None and row["away_score"] is not None:
            winners.append(row["home"] if int(row["home_score"]) > int(row["away_score"]) else row["away"])
        else:
            winners.append(row["home"] if base[int(row["match_id"])]["p"] >= .5 else row["away"])
    names_to_ids = {row["home"]: int(row["home_team_id"]) for row in season}
    names_to_ids.update({row["away"]: int(row["away_team_id"]) for row in season})
    matches.append({
        "match_id": -(latest_year * 10 + 3), "season": latest_year,
        "round_label": "Grand Final", "round_index": 14, "match_date_utc": None,
        "is_finals": 1, "home_team_id": names_to_ids[winners[0]],
        "away_team_id": names_to_ids[winners[1]], "home": winners[0], "away": winners[1],
        "home_score": None, "away_score": None, "venue": None, "projected": True,
    })
    for index, row in enumerate(matches):
        row["index"] = index
    return True


def load_rookie_features(db: sqlite3.Connection, matches: list[dict[str, Any]]) -> dict[int, list[float]]:
    query = """
      SELECT p.match_id,p.player_id,p.player_name_raw,p.team_id,p.jumper_number,p.position_label
      FROM player_match_summary p JOIN matches m ON m.match_id=p.match_id
      WHERE m.competition_id=2
      ORDER BY m.season,COALESCE(m.match_date_utc,''),m.round_index,m.match_id,p.player_match_summary_id
    """
    players: dict[int, dict[int, set[str]]] = defaultdict(lambda: defaultdict(set))
    for row in db.execute(query):
        if row["jumper_number"] is None or (row["position_label"] or "") in {"Reserve", "Replacement"}:
            continue
        key = f"id:{row['player_id']}" if row["player_id"] is not None else "name:" + " ".join(row["player_name_raw"].lower().split())
        players[int(row["match_id"])][int(row["team_id"])].add(key)
    career: Counter[str] = Counter()
    features: dict[int, list[float]] = {}
    for match in matches:
        sides = players[int(match["match_id"])]
        home = sides[int(match["home_team_id"])]
        away = sides[int(match["away_team_id"])]
        if 15 <= len(home) <= 18 and 15 <= len(away) <= 18:
            count = lambda team, limit: sum(career[player] < limit for player in team)
            debut = lambda team: sum(career[player] == 0 for player in team)
            features[int(match["match_id"])] = [
                float(debut(home) - debut(away)),
                float(count(home, 5) - count(away, 5)),
                float(count(home, 20) - count(away, 20)),
            ]
        for team in (home, away):
            career.update(team)
    return features


def replay_base(matches: list[dict[str, Any]]) -> dict[int, dict[str, float]]:
    ratings: dict[str, float] = {}
    streak: defaultdict[str, int] = defaultdict(int)
    last_date: dict[str, datetime] = {}
    last_year: int | None = None
    output: dict[int, dict[str, float]] = {}
    for row in matches:
        year = int(row["season"])
        if last_year is not None and year != last_year:
            for team in list(ratings):
                ratings[team] = (INITIAL_RATING + REVERSION_WEIGHT * ratings[team]) / (1.0 + REVERSION_WEIGHT)
            streak.clear(); last_date.clear()
        home, away = row["home"], row["away"]
        ratings.setdefault(home, ENTRY_PRIOR)
        ratings.setdefault(away, ENTRY_PRIOR)
        match_date = datetime.fromisoformat(row["match_date_utc"].replace("Z", "+00:00")) if row["match_date_utc"] else None
        home_rest = (match_date - last_date[home]).total_seconds() / 604800 if match_date and home in last_date else 0.0
        away_rest = (match_date - last_date[away]).total_seconds() / 604800 if match_date and away in last_date else 0.0
        round_number = 28 + int(row["round_index"]) if row["is_finals"] else int(row["round_index"])
        early = max(0, 11 - round_number)
        dr = (ratings[home] - ratings[away] + HOME_ADVANTAGE + TRAVEL_WEIGHT * distance_units(away, home)
              + REST_WEIGHT * (home_rest - away_rest) + STREAK_WEIGHT * (streak[home] - streak[away]))
        probability = 1.0 / (10.0 ** (-dr / PROBABILITY_DIVISOR) + 1.0)
        output[int(row["match_id"])] = {"homeElo": ratings[home], "awayElo": ratings[away], "dr": dr, "p": probability}
        if row["home_score"] is None or row["away_score"] is None:
            output[int(row["match_id"])]["homePostElo"] = ratings[home]
            output[int(row["match_id"])]["awayPostElo"] = ratings[away]
            last_year = year
            continue
        margin = int(row["home_score"]) - int(row["away_score"])
        actual = 1.0 if margin > 0 else 0.0 if margin < 0 else 0.5
        update = (K_BASE + EARLY_BOOST * early) * margin_multiplier(margin) * (actual - probability)
        ratings[home] += update; ratings[away] -= update
        output[int(row["match_id"])]["homePostElo"] = ratings[home]
        output[int(row["match_id"])]["awayPostElo"] = ratings[away]
        if actual == 1:
            streak[home], streak[away] = max(1, streak[home] + 1), min(-1, streak[away] - 1)
        elif actual == 0:
            streak[home], streak[away] = min(-1, streak[home] - 1), max(1, streak[away] + 1)
        else:
            streak[home] = streak[away] = 0
        if match_date:
            last_date[home] = last_date[away] = match_date
        last_year = year
    return output


def fit_rookie(matches: list[dict[str, Any]], base: dict[int, dict[str, float]],
               features: dict[int, list[float]]) -> dict[int, dict[str, Any]]:
    output: dict[int, dict[str, Any]] = {}
    years = sorted({int(row["season"]) for row in matches})
    for year in years:
        training = [row for row in matches if year - 8 <= int(row["season"]) < year and int(row["match_id"]) in features]
        testing = [row for row in matches if int(row["season"]) == year and int(row["match_id"]) in features]
        if not training or not testing:
            continue
        x = np.asarray([features[int(row["match_id"])] for row in training], dtype=float)
        y = np.asarray([(int(row["home_score"]) - int(row["away_score"]))
                        - MARGIN_COEFFICIENT * base[int(row["match_id"])]["dr"] for row in training])
        mean, scale = x.mean(axis=0), x.std(axis=0)
        scale[scale < 1e-8] = 1.0
        z = (x - mean) / scale
        beta = np.linalg.solve(z.T @ z + 300.0 * np.eye(3), z.T @ y)
        for row in testing:
            match_id = int(row["match_id"])
            raw = float(((np.asarray(features[match_id]) - mean) / scale) @ beta)
            capped = max(-18.0, min(18.0, raw))
            applied = abs(capped) >= 6.0
            adjustment = capped if applied else 0.0
            dr = base[match_id]["dr"] + adjustment / MARGIN_COEFFICIENT
            output[match_id] = {
                "raw": raw, "margin": capped, "applied": applied,
                "dr": dr, "p": 1.0 / (10.0 ** (-dr / PROBABILITY_DIVISOR) + 1.0),
                "trainingGames": len(training),
            }
    return output


def metrics(matches: list[dict[str, Any]], probability: dict[int, float]) -> dict[str, Any]:
    correct = 0; brier = 0.0; log_loss = 0.0; margin_error = 0.0
    for row in matches:
        match_id = int(row["match_id"]); p = probability[match_id]
        margin = int(row["home_score"]) - int(row["away_score"])
        actual = 1.0 if margin > 0 else 0.0 if margin < 0 else 0.5
        correct += int(actual == 0.5 or (p >= 0.5) == (actual == 1.0))
        brier += (p - actual) ** 2
        clipped = max(1e-15, min(1 - 1e-15, p))
        log_loss += -(actual * math.log(clipped) + (1 - actual) * math.log(1 - clipped))
        dr = -PROBABILITY_DIVISOR * math.log10(1 / p - 1)
        margin_error += abs(MARGIN_COEFFICIENT * dr - margin)
    games = len(matches)
    return {"games": games, "correct": correct, "accuracy": correct / games,
            "brier": brier / games, "logLoss": log_loss / games, "marginMae": margin_error / games}


def odds_lookup(rows: list[dict[str, Any]]) -> dict[tuple[int, str, str, int, int], dict[str, Any]]:
    result: dict[tuple[int, str, str, int, int], dict[str, Any]] = {}
    for row in rows:
        if row["home_score"] is None or row["away_score"] is None:
            continue
        result[(int(row["season"]), row["home"], row["away"], int(row["home_score"]), int(row["away_score"]))] = row
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", type=Path, required=True)
    parser.add_argument("--output", type=Path, default=Path(__file__).with_name("data") / "nrlw-cache.json")
    parser.add_argument("--odds-cache", type=Path, default=Path(__file__).with_name("data") / "nrlw-odds-source.json")
    parser.add_argument("--refresh-odds", action="store_true")
    args = parser.parse_args()
    db = sqlite3.connect(f"file:{args.database.resolve().as_posix()}?mode=ro", uri=True)
    db.row_factory = sqlite3.Row
    matches = project_nrlw_finals(load_matches(db))
    features = load_rookie_features(db, matches)
    db.close()
    base = replay_base(matches)
    if project_nrlw_grand_final(matches, base):
        base = replay_base(matches)
    rookie = fit_rookie(matches, base, features)
    odds_rows = load_odds(args.odds_cache, args.refresh_odds)
    odds_by_game = odds_lookup(odds_rows)
    compact = []
    end_ratings: dict[str, dict[str, int]] = {}
    odds_games = 0
    for row in matches:
        match_id = int(row["match_id"]); baseline = base[match_id]; adjusted = rookie.get(match_id)
        completed = row["home_score"] is not None and row["away_score"] is not None
        odds = odds_by_game.get((int(row["season"]), row["home"], row["away"], int(row["home_score"]), int(row["away_score"]))) if completed else None
        odds_games += int(odds is not None)
        shadow_p = adjusted["p"] if adjusted else baseline["p"]
        compact.append({
            "id": f"nrlw-projected-{abs(match_id)}" if row.get("projected") else f"nrlw-{match_id}",
            "rldbId": None if row.get("projected") else match_id, "year": int(row["season"]),
            "round": re.sub(r"^Round\s+", "Rd ", row["round_label"], flags=re.I),
            "matchIndex": int(row["index"]) + 1, "game": None, "date": row["match_date_utc"],
            "home": row["home"], "away": row["away"], "hs": int(row["home_score"]) if completed else None,
            "as": int(row["away_score"]) if completed else None, "venue": row["venue"],
            "projected": bool(row.get("projected")),
            "homeElo": baseline["homeElo"], "awayElo": baseline["awayElo"],
            "homePostElo": baseline["homePostElo"], "awayPostElo": baseline["awayPostElo"],
            "bstarP": baseline["p"], "gate6P": shadow_p,
            "candidateP": baseline["p"], "candidateDr": baseline["dr"],
            "lineupAvailable": match_id in features,
            "rookieMargin": adjusted["margin"] if adjusted else None,
            "rookieGate": adjusted["applied"] if adjusted else False,
            "rookieTrainingGames": adjusted["trainingGames"] if adjusted else 0,
            "closeHome": odds["home_odds"] if odds else None,
            "closeAway": odds["away_odds"] if odds else None,
            "closeSource": "OddsPortal survey" if odds else None,
        })
        end_ratings[str(row["season"])] = end_ratings.get(str(row["season"]), {})
    # Use the latest post-match rating in each season as the matrix tiebreaker.
    for year in sorted({int(row["season"]) for row in matches}):
        season_rows = [row for row in compact if row["year"] == year and row["hs"] is not None]
        for team in {name for row in season_rows for name in (row["home"], row["away"])}:
            latest = next((row for row in reversed(season_rows) if team in (row["home"], row["away"])), None)
            if latest:
                baseline = base[int(str(latest["id"]).removeprefix("nrlw-"))]
                end_ratings[str(year)][team] = round(baseline["homePostElo"] if latest["home"] == team else baseline["awayPostElo"])
    completed_matches = [row for row in matches if row["home_score"] is not None and row["away_score"] is not None]
    base_probability = {int(row["match_id"]): base[int(row["match_id"])]["p"] for row in completed_matches}
    candidate_probability = {int(row["match_id"]): rookie.get(int(row["match_id"]), base[int(row["match_id"])])["p"] for row in completed_matches}
    comparison = {"overall": {"withoutRookie": metrics(completed_matches, base_probability), "withRookie": metrics(completed_matches, candidate_probability)}, "yearly": []}
    for year in sorted({int(row["season"]) for row in matches}):
        season = [row for row in completed_matches if int(row["season"]) == year]
        comparison["yearly"].append({"year": year, "withoutRookie": metrics(season, base_probability), "withRookie": metrics(season, candidate_probability),
                                     "rookieApplied": sum(bool(rookie.get(int(row["match_id"]), {}).get("applied")) for row in season)})
    payload = {
        "meta": {"version": "2026-09-25-v5", "competition": "NRLW", "model": MODEL_ID,
                 "source": "Live installed RLDB C:/RLDB/data/rldb.sqlite, competition_id=2; next finals round derived from RLDB ladder/results when absent", "firstSeason": compact[0]["year"], "lastSeason": compact[-1]["year"],
                 "lastMatchDate": max(row["date"] for row in compact if row["hs"] is not None), "matches": len(compact),
                 "completedMatches": len(completed_matches), "upcomingMatches": len(compact)-len(completed_matches), "lineupCoverage": len(features),
                 "rookieApplied": sum(bool(row["rookieGate"]) for row in compact),
                 "rookieTrainingGamesMin": min((row["rookieTrainingGames"] for row in compact if row["rookieTrainingGames"]), default=0),
                 "rookieTrainingGamesMax": max((row["rookieTrainingGames"] for row in compact), default=0),
                 "rookiePolicy": "shadow_only", "marketPolicy": "flag_only", "marginCoefficient": MARGIN_COEFFICIENT,
                 "parameters": {"initialRating": INITIAL_RATING, "entryPrior": ENTRY_PRIOR, "k": K_BASE,
                                "homeAdvantage": HOME_ADVANTAGE, "earlyBoost": EARLY_BOOST,
                                "reversionWeight": REVERSION_WEIGHT, "probabilityDivisor": PROBABILITY_DIVISOR,
                                "travel": TRAVEL_WEIGHT, "rest": REST_WEIGHT, "streak": STREAK_WEIGHT,
                                "marginUpdate": "0.75 * (abs(margin) / 6)^0.75"},
                 "oddsCoverage": odds_games, "oddsSource": "OddsPortal NRL Women result-page survey prices found for 2024-2026; earlier usable archives not found"},
        "matches": compact, "ratingsByYear": end_ratings, "comparison": comparison,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, separators=(",", ":")) + "\n", encoding="utf-8")
    print(json.dumps({"output": str(args.output), **payload["meta"], "accuracy": comparison["overall"]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
