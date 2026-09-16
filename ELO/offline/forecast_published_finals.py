"""Generate current finals forecasts from published NRL team lists.

This is a prospective snapshot: completed matches may update Elo, but the target
fixtures' scores are never read. Player experience is counted strictly before
each target kickoff.
"""
from __future__ import annotations

import json
import re
import sqlite3
import unicodedata
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

import forecast_finals_week1_holdout as prior
import margin_alternative_models as alt
import big_joint_sweep as core


API = "https://nrl-elo-api.d2-rein.workers.dev/api/prospective/team-lists?season=2026"
TEAM_MAP = {
    "Warriors": "New Zealand Warriors",
    "New Zealand Warriors": "New Zealand Warriors",
    "Knights": "Newcastle Knights",
    "Newcastle Knights": "Newcastle Knights",
    "Roosters": "Sydney Roosters",
    "Sydney Roosters": "Sydney Roosters",
    "Sharks": "Cronulla Sharks",
    "Cronulla-Sutherland Sharks": "Cronulla Sharks",
    "Cronulla Sharks": "Cronulla Sharks",
    "Panthers": "Penrith Panthers",
    "Cowboys": "NQ Cowboys",
    "North Queensland Cowboys": "NQ Cowboys",
    "Rabbitohs": "South Sydney Rabbitohs",
    "Dolphins": "Dolphins",
}


def normalise(value: str) -> str:
    value = re.sub(r"\s*\[[^]]+\]\s*$", "", value)
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    key = re.sub(r"[^a-z0-9]", "", value.lower())
    return {"kliro": "kayaliro"}.get(key, key)


def canonical(value: str) -> str:
    return TEAM_MAP.get(value, value)


def get_lists() -> list[dict]:
    request = urllib.request.Request(API, headers={"User-Agent": "NRL-ELO-Prospective-Forecast/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def player_index(connection: sqlite3.Connection) -> dict[str, list[tuple[int, str]]]:
    rows = connection.execute("SELECT player_id, display_name FROM players").fetchall()
    result: dict[str, list[tuple[int, str]]] = {}
    for player_id, name in rows:
        result.setdefault(normalise(str(name)), []).append((int(player_id), str(name)))
    return result


def career_before(connection: sqlite3.Connection, candidates: list[tuple[int, str]], kickoff: str) -> tuple[int, str]:
    scored = []
    for player_id, name in candidates:
        games = connection.execute("""
            SELECT COUNT(DISTINCT summary.match_id)
            FROM player_match_summary summary
            JOIN matches match ON match.match_id=summary.match_id
            WHERE summary.player_id=? AND match.match_date_utc < ?
        """, (player_id, kickoff)).fetchone()[0]
        scored.append((int(games or 0), name))
    return max(scored, default=(0, "unmatched"))


def update_completed_finals(connection: sqlite3.Connection, ratings: dict[str, float], state: dict) -> None:
    rows = connection.execute("""
        SELECT m.match_date_utc, ht.canonical_name, at.canonical_name,
               m.home_score, m.away_score
        FROM matches m
        JOIN teams ht ON ht.team_id=m.home_team_id
        JOIN teams at ON at.team_id=m.away_team_id
        WHERE m.season=2026 AND m.is_finals=1
          AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL
        ORDER BY m.match_date_utc
    """).fetchall()
    for date_text, home_raw, away_raw, home_score, away_score in rows:
        home, away = canonical(str(home_raw)), canonical(str(away_raw))
        kickoff = core.parse_date(date_text)
        home_rest = (kickoff - state["last_date"][home]).total_seconds() / 604800
        away_rest = (kickoff - state["last_date"][away]).total_seconds() / 604800
        dr = (ratings[home] - ratings[away] + 40 + 15 * core.distance_km(away, home) / 1000
              + 5 * (home_rest - away_rest)
              + 2.15 * (state["streak"].get(home, 0) - state["streak"].get(away, 0)))
        probability = 1 / (10 ** (-dr / 400) + 1)
        actual = 1.0 if home_score > away_score else 0.0 if home_score < away_score else 0.5
        change = 9.455 * core.current_margin_multiplier(int(home_score) - int(away_score)) * (actual - probability)
        ratings[home] += change
        ratings[away] -= change
        home_streak, away_streak = state["streak"].get(home, 0), state["streak"].get(away, 0)
        if home_score > away_score:
            state["streak"][home], state["streak"][away] = max(1, home_streak + 1), min(-1, away_streak - 1)
        elif home_score < away_score:
            state["streak"][home], state["streak"][away] = min(-1, home_streak - 1), max(1, away_streak + 1)
        else:
            state["streak"][home] = state["streak"][away] = 0
        state["last_date"][home] = state["last_date"][away] = kickoff


def stable_margin(history, candidate_dr: float) -> int:
    target = abs(0.048406 * candidate_dr)
    x = history["x"].to_numpy(float)
    aligned = history["aligned_actual"].to_numpy(int)
    ages = len(history) - np.arange(len(history))
    weights = np.exp(-0.5 * ((x - target) / 1.5) ** 2) * 2 ** (-ages / 1000)
    return min(alt.EVEN, key=lambda action: (float(np.sum(weights * np.abs(aligned - action)) / weights.sum()), action))


def main() -> None:
    root = Path(__file__).resolve().parent
    database = Path("C:/RLDB/data/rldb.sqlite")
    matches_path = root / "snapshots/prod-observed-2026-09-11/matches.json"
    context_path = root / "experiments/EXP-2026-002C-rldb-context/completed_matches_with_rldb_context.csv"
    features_path = root / "experiments/EXP-2026-012-team-list-simple/run-009-round27-final/match_features.csv"
    lineups_path = root / "experiments/EXP-2026-012-team-list-simple/run-009-round27-final/match_lineups.csv"
    connection = sqlite3.connect(f"file:{database.as_posix()}?mode=ro", uri=True)
    _, ratings, state = prior.replay_end_state(matches_path, context_path)
    update_completed_finals(connection, ratings, state)
    data = core.prepare_data(matches_path, context_path)
    base = prior.teamlist.replay_bstar(data)
    rookie_fit = prior.fit_rookie_model(data, base, features_path, lineups_path)
    history = alt.load_data(root)
    index = player_index(connection)
    output, unmatched = [], []
    for snapshot in get_lists():
        if str(snapshot.get("match_state", "")).lower() != "upcoming":
            continue
        home = canonical(snapshot["home"].get("nick_name") or snapshot["home"]["name"])
        away = canonical(snapshot["away"].get("nick_name") or snapshot["away"]["name"])
        kickoff_text = snapshot["kickoff_utc"]
        kickoff = core.parse_date(kickoff_text)
        counts = {}
        for side, team in (("home", home), ("away", away)):
            careers = []
            for player in sorted(snapshot[side]["players"], key=lambda p: int(p.get("order") or 999))[:17]:
                name = f"{player.get('first_name', '')} {player.get('last_name', '')}".strip()
                candidates = index.get(normalise(name), [])
                if not candidates:
                    unmatched.append({"team": team, "player": name})
                games, matched = career_before(connection, candidates, kickoff_text)
                careers.append(games)
            counts[side] = np.array([sum(g == 0 for g in careers), sum(g < 5 for g in careers), sum(g < 20 for g in careers)], float)
        feature_difference = counts["home"] - counts["away"]
        raw_adjustment = float(np.sum(rookie_fit["coefficients"] * (feature_difference - rookie_fit["means"])))
        capped = float(np.clip(raw_adjustment, -18, 18))
        gate = abs(capped) >= 6
        applied = capped if gate else 0.0
        home_rest = (kickoff - state["last_date"][home]).total_seconds() / 604800
        away_rest = (kickoff - state["last_date"][away]).total_seconds() / 604800
        base_dr = (ratings[home] - ratings[away] + 40 + 15 * core.distance_km(away, home) / 1000
                   + 5 * (home_rest - away_rest)
                   + 2.15 * (state["streak"].get(home, 0) - state["streak"].get(away, 0)))
        candidate_dr = base_dr + applied / 0.048406
        probability = 1 / (10 ** (-candidate_dr / 400) + 1)
        margin = int(stable_margin(history, candidate_dr))
        output.append({
            "nrl_match_id": str(snapshot["nrl_match_id"]), "season": int(snapshot["season"]),
            "round": snapshot["round_name"].replace("Finals Week", "Finals Wk"),
            "home": home, "away": away, "kickoff": kickoff_text,
            "source_observed_at": snapshot["observed_at_utc"], "lineupSha256": snapshot["lineup_sha256"],
            "base_dr": base_dr, "bstarP": 1 / (10 ** (-base_dr / 400) + 1),
            "lineupMargin": capped, "rookieGate": gate,
            "candidateDr": candidate_dr, "candidateP": probability,
            "stableMargin": margin, "tip": home if probability >= 0.5 else away,
            "homeCounts": counts["home"].astype(int).tolist(),
            "awayCounts": counts["away"].astype(int).tolist(),
        })
    destination = root.parent / "2027/data/current-finals-forecast.json"
    destination.write_text(json.dumps({
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "model": "2027-candidate-bstar-rookie-gate6-v1",
        "note": "Prospective published-team-list forecast; target results excluded.",
        "forecasts": output, "unmatchedPlayers": unmatched,
    }, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"destination": str(destination), "forecasts": output, "unmatchedPlayers": unmatched}, indent=2))


if __name__ == "__main__":
    main()
