"""Generate current finals forecasts from published NRL team lists.

This is a prospective snapshot: completed matches may update Elo, but the target
fixtures' scores are never read. Player experience is counted strictly before
each target kickoff.
"""
from __future__ import annotations

import json
import argparse
import re
import sqlite3
import unicodedata
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np

import forecast_finals_week1_holdout as prior
import margin_alternative_models as alt
import big_joint_sweep as core
import stage4_expected_minutes as stage4
import stage5_basic_player_stats as stage5
import stage7_advanced_combined_stats as stage7
import stage7b_opportunity_adjusted_stats as stage7b
import stage7c_o10_lite as stage7c


API_ROOT = "https://nrl-elo-api.d2-rein.workers.dev"
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


def get_lists(season: int, api_root: str = API_ROOT) -> list[dict]:
    url = api_root.rstrip("/") + f"/api/prospective/team-lists?season={season}&view=announced"
    request = urllib.request.Request(url, headers={"User-Agent": "NRL-ELO-Prospective-Forecast/1.0"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def upload_forecasts(api_root: str, token: str, payload: dict) -> dict:
    url = api_root.rstrip("/") + "/api/prospective/forecasts"
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = urllib.request.Request(url, data=body, method="POST", headers={
        "User-Agent": "NRL-ELO-Prospective-Forecast/1.0",
        "Content-Type": "application/json", "Authorization": f"Bearer {token}",
    })
    with urllib.request.urlopen(request, timeout=45) as response:
        return json.load(response)


def player_index(connection: sqlite3.Connection) -> dict[str, list[tuple[int, str]]]:
    rows = connection.execute("SELECT player_id, display_name FROM players").fetchall()
    result: dict[str, list[tuple[int, str]]] = {}
    for player_id, name in rows:
        result.setdefault(normalise(str(name)), []).append((int(player_id), str(name)))
    return result


def already_completed(connection: sqlite3.Connection, home: str, away: str, kickoff: str) -> bool:
    row = connection.execute("""
        SELECT 1 FROM matches m
        JOIN teams h ON h.team_id=m.home_team_id JOIN teams a ON a.team_id=m.away_team_id
        WHERE m.match_date_utc=? AND h.canonical_name=? AND a.canonical_name=?
          AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL LIMIT 1
    """, (kickoff, home, away)).fetchone()
    return row is not None


def career_before(connection: sqlite3.Connection, candidates: list[tuple[int, str]], kickoff: str) -> tuple[int, str, int | None]:
    scored = []
    for player_id, name in candidates:
        games = connection.execute("""
            SELECT COUNT(DISTINCT summary.match_id)
            FROM player_match_summary summary
            JOIN matches match ON match.match_id=summary.match_id
            WHERE summary.player_id=? AND match.match_date_utc < ?
        """, (player_id, kickoff)).fetchone()[0]
        scored.append((int(games or 0), name, player_id))
    return max(scored, default=(0, "unmatched", None))


def top_reference(lineups: list[set[int]], limit: int = 17) -> set[int]:
    counts: Counter[int] = Counter()
    recency: dict[int, int] = {}
    for age, lineup in enumerate(lineups):
        for player_id in lineup:
            counts[player_id] += 1
            recency.setdefault(player_id, age)
    return {player_id for player_id, _ in sorted(counts.items(), key=lambda item: (-item[1], recency[item[0]], item[0]))[:limit]}


def recent_reference(connection: sqlite3.Connection, team: str, kickoff: str) -> tuple[set[int], dict[int, str]]:
    team_row = connection.execute("SELECT team_id FROM teams WHERE canonical_name=?", (team,)).fetchone()
    if not team_row:
        return set(), {}
    team_id = int(team_row[0])
    matches = connection.execute("""
        SELECT m.match_id
        FROM matches m JOIN competitions c ON c.competition_id=m.competition_id
        JOIN teams h ON h.team_id=m.home_team_id JOIN teams a ON a.team_id=m.away_team_id
        WHERE c.code='NRL' AND m.match_date_utc < ? AND m.home_score IS NOT NULL
          AND (h.canonical_name=? OR a.canonical_name=?)
        ORDER BY m.match_date_utc DESC LIMIT 5
    """, (kickoff, team, team)).fetchall()
    lineups, positions = [], {}
    for (match_id,) in matches:
        rows = connection.execute("""
            SELECT player_id,position_label FROM player_match_summary
            WHERE match_id=? AND team_id=? AND player_id IS NOT NULL AND jumper_number IS NOT NULL
              AND COALESCE(position_label,'') NOT IN ('Reserve','Replacement')
            ORDER BY COALESCE(jumper_number,999),player_match_summary_id
        """, (match_id, team_id)).fetchall()
        lineup = set()
        for player_id, position in rows[:17]:
            player_id = int(player_id); lineup.add(player_id)
            positions.setdefault(player_id, str(position or "Interchange"))
        lineups.append(lineup)
    return top_reference(lineups), positions


def expected_minutes(connection: sqlite3.Connection, player_id: int | None, role: str, kickoff: str) -> float:
    if player_id is None:
        return stage4.DEFAULT_MINUTES[role]
    rows = connection.execute("""
        SELECT v.stat_value_num
        FROM player_match_summary p JOIN matches m ON m.match_id=p.match_id
        JOIN player_match_stat_values v ON v.player_match_summary_id=p.player_match_summary_id
        WHERE p.player_id=? AND m.match_date_utc < ? AND v.stat_key='minutes_played'
          AND v.stat_value_num IS NOT NULL
        ORDER BY m.match_date_utc DESC LIMIT 3
    """, (player_id, kickoff)).fetchall()
    values = [float(row[0]) for row in rows]
    if not values:
        return stage4.DEFAULT_MINUTES[role]
    weight = len(values) / (len(values) + 2.0)
    return float(np.clip(weight * np.mean(values) + (1.0 - weight) * stage4.DEFAULT_MINUTES[role], 0, 90))


def lineup_stage4(connection: sqlite3.Connection, snapshot: dict, index: dict[str, list[tuple[int, str]]], kickoff: str) -> dict:
    coefficients = {"spine": -1.605976350723666, "middle": -2.1658928122485372,
                    "edge": -1.0671023012309602, "outside": -1.0625672147715697,
                    "bench": -1.2891001545838663}
    sides, vectors, model_rows = {}, {}, []
    for side in ("home", "away"):
        team = canonical(snapshot[side].get("nick_name") or snapshot[side]["name"])
        reference, reference_positions = recent_reference(connection, team, kickoff)
        current, current_ids = [], set()
        for player in sorted(snapshot[side]["players"], key=lambda p: int(p.get("order") or 999))[:17]:
            raw_name = f"{player.get('first_name', '')} {player.get('last_name', '')}".strip()
            games, matched_name, player_id = career_before(connection, index.get(normalise(raw_name), []), kickoff)
            position = str(player.get("position") or "Interchange")
            group = stage4.role(position)
            minutes = expected_minutes(connection, player_id, group, kickoff)
            current.append({"name": matched_name if player_id is not None else raw_name, "player_id": player_id,
                            "position": position, "role": group, "games": games, "minutes": minutes})
            if player_id is not None: current_ids.add(player_id)
        outgoing = []
        for player_id in reference - current_ids:
            name = connection.execute("SELECT display_name FROM players WHERE player_id=?", (player_id,)).fetchone()
            games, matched_name, _ = career_before(connection, [(player_id, str(name[0]) if name else str(player_id))], kickoff)
            position = reference_positions.get(player_id, "Interchange")
            group = stage4.role(position)
            outgoing.append({"name": matched_name, "player_id": player_id, "role": group, "games": games,
                             "position": position, "minutes": expected_minutes(connection, player_id, group, kickoff)})
        current_total = sum(p["minutes"] for p in current) or 1040
        reference_players = [p for p in current if p["player_id"] in reference] + outgoing
        reference_total = sum(p["minutes"] for p in reference_players) or 1040
        vector = defaultdict(float)
        for player in current:
            player["minutes"] *= 1040 / current_total
            vector[player["role"]] += stage4.burden(player["games"]) * player["minutes"] / 80
        reference_vector = defaultdict(float)
        for player in reference_players:
            minutes = player["minutes"] * 1040 / reference_total
            reference_vector[player["role"]] += stage4.burden(player["games"]) * minutes / 80
        vectors[side] = {role: vector[role] for role in stage4.ROLES}
        by_id = {p["player_id"]: p for p in current + outgoing if p["player_id"] is not None}
        for player_id in current_ids | reference:
            player = by_id[player_id]
            model_rows.append({"year": "2026", "team_id": team, "side": side,
                               "player_key": f"id:{player_id}",
                               "actual": "1" if player_id in current_ids else "0",
                               "recent5_reference": "1" if player_id in reference else "0",
                               "position": player["position"],
                               "career_games_before": str(player["games"]), "rldb_match_id": "0"})
        sign = 1 if side == "home" else -1
        for player in current:
            player["incoming"] = player["player_id"] not in reference
            player["homeMarginPoints"] = round(sign * coefficients[player["role"]] * stage4.burden(player["games"]) * player["minutes"] / 80, 2)
            player["minutes"] = round(player["minutes"], 1)
            player.pop("player_id")
            player.pop("position")
        for player in outgoing:
            player["minutes"] = round(player["minutes"] * 1040 / reference_total, 1)
            player.pop("player_id")
            player.pop("position")
        current.sort(key=lambda p: (-abs(p["homeMarginPoints"]), p["name"]))
        outgoing.sort(key=lambda p: (-p["minutes"], p["name"]))
        sides[side] = {"current": current, "outgoing": outgoing}
    difference = {role: vectors["home"][role] - vectors["away"][role] for role in stage4.ROLES}
    raw = -0.08368612716292846 + sum(coefficients[role] * difference[role] for role in stage4.ROLES)
    return {"raw": raw, "capped": float(np.clip(raw, -18, 18)),
            "vectors": difference, "modelRows": model_rows,
            "drivers": {"intercept": -0.08368612716292846, **sides}}


def player_shadows(root: Path, database: Path, model_rows: list[dict], base_dr: float) -> dict:
    """Run the frozen O10/O9/Creation shadow architecture for one prospective lineup."""
    lineups = root / "experiments/EXP-2026-036-stage3-role-retest/run-001/role-lineups/match_lineups_role_based.csv"
    decisions = root / "experiments/EXP-2026-039-stage4c-relative-market/run-001/selected_decisions.csv"
    matches = root / "snapshots/prod-observed-2026-09-11/matches.json"
    context = root / "experiments/EXP-2026-002C-rldb-context/completed_matches_with_rldb_context.csv"
    grouped, _ = stage4.grouped_lineups(lineups)
    target_index = max(grouped) + 1
    for row in model_rows:
        row["elo_index"] = str(target_index)
    grouped[target_index] = model_rows
    indices = np.asarray(sorted(grouped), dtype=int)
    stats = stage7b.load_opportunity_stats(database)
    minute_map = {(m, p): values["minutes_played"] for (m, p), values in stats.items() if "minutes_played" in values}
    expected = stage4.expected_rows(grouped, minute_map, {"recent_window": 3, "shrink_games": 2.0})
    stage7.RAW_STATS = stage7b.OPPORTUNITY_STATS
    stage7.SPARSE_ZERO = set(stage7b.OPPORTUNITY_STATS)
    stage7.METRIC_NAMES = stage7b.OPPORTUNITY_STATS
    stage7.metrics = stage7b.opportunity_metrics
    columns, _ = stage7.build_features(indices, grouped, expected, stats)
    rookie, _ = stage4.build_minutes_features(indices, grouped, expected)
    z = np.column_stack([rookie[f"mw_burden_{role}"] for role in stage4.ROLES])
    decision_rows = stage5.read_csv(decisions)
    base_margin = {int(row["elo_index"]): .048406 * (-400 * np.log10(1 / float(row["selected_gate_home_probability"]) - 1))
                   for row in decision_rows}
    years = {int(row["elo_index"]): int(row["year"]) for row in decision_rows}
    train_indices = np.asarray([i for i in indices if i != target_index and 2018 <= years.get(int(i), 0) <= 2025
                                and int(i) in base_margin], dtype=int)
    lookup = {int(index): pos for pos, index in enumerate(indices)}
    train_rows = np.asarray([lookup[int(i)] for i in train_indices])
    target_row = np.asarray([lookup[target_index]])
    prepared = core.prepare_data(matches, context)
    residual = prepared.margin[train_indices].astype(float) - np.asarray([base_margin[int(i)] for i in train_indices])

    def ridge_shadow(names: tuple[str, ...]) -> tuple[float, float]:
        x = np.column_stack([columns[name] for name in names])
        x_train, x_target = x[train_rows].copy(), x[target_row].copy()
        z_train, z_target = z[train_rows], z[target_row]
        z_mean, z_scale = z_train.mean(axis=0), z_train.std(axis=0)
        z_scale[z_scale < 1e-8] = 1.0
        ztr, zte = (z_train - z_mean) / z_scale, (z_target - z_mean) / z_scale
        center = x_train.mean(axis=0)
        projection = np.linalg.solve(ztr.T @ ztr + 100 * np.eye(ztr.shape[1]), ztr.T @ (x_train - center))
        x_train, x_target = (x_train - center) - ztr @ projection, (x_target - center) - zte @ projection
        prediction, _beta, _mean, _scale = prior.teamlist.fit_predict_ridge(x_train, residual, x_target, 100.0)
        adjustment = float(np.clip(prediction[0], -6, 6))
        applied = adjustment if abs(adjustment) >= 4 else 0.0
        probability = 1 / (10 ** (-(base_dr + applied / .048406) / 400) + 1)
        return probability, adjustment

    prefix = "w10s5_replacement_"
    full_names = tuple(prefix + name for name in stage7b.OPPORTUNITY_STATS)
    o10_p, o10_adjustment = ridge_shadow(full_names)
    o9_p, o9_adjustment = ridge_shadow(tuple(name for name in full_names if not name.endswith("errors_per_100_team_runs")))
    creation = columns[prefix + "creation_per_100_team_runs"]
    x_train, x_target = creation[train_rows, None], creation[target_row, None]
    mean, scale = x_train.mean(axis=0), x_train.std(axis=0); scale[scale < 1e-8] = 1
    beta = stage7c.nn_ridge((x_train - mean) / scale, residual, 30.0)
    creation_adjustment = float(np.clip((((x_target - mean) / scale) @ beta)[0], -6, 6))
    creation_applied = creation_adjustment if abs(creation_adjustment) >= 4 else 0.0
    creation_p = 1 / (10 ** (-(base_dr + creation_applied / .048406) / 400) + 1)
    base_p = 1 / (10 ** (-base_dr / 400) + 1)
    reversals = [(value >= .5) != (base_p >= .5) for value in (o10_p, o9_p, creation_p)]
    return {"o10P": o10_p, "o9P": o9_p, "creationP": creation_p,
            "playerAlert": bool(reversals[0]), "playerConsensus": bool(all(reversals)),
            "playerDrivers": {"top": f"Full {o10_adjustment:+.2f}; Core {o9_adjustment:+.2f}; Creation {creation_adjustment:+.2f} margin points"}}


def update_completed_since_baseline(connection: sqlite3.Connection, ratings: dict[str, float], state: dict) -> None:
    cutoff = max(state["last_date"].values())
    rows = connection.execute("""
        SELECT m.match_date_utc, ht.canonical_name, at.canonical_name,
               m.home_score, m.away_score
        FROM matches m
        JOIN competitions c ON c.competition_id=m.competition_id
        JOIN teams ht ON ht.team_id=m.home_team_id
        JOIN teams at ON at.team_id=m.away_team_id
        WHERE c.code='NRL' AND m.match_date_utc > ?
          AND m.home_score IS NOT NULL AND m.away_score IS NOT NULL
        ORDER BY m.match_date_utc
    """, (cutoff.isoformat().replace("+00:00", "Z"),)).fetchall()
    active_year = cutoff.year
    for date_text, home_raw, away_raw, home_score, away_score in rows:
        home, away = canonical(str(home_raw)), canonical(str(away_raw))
        kickoff = core.parse_date(date_text)
        if kickoff.year != active_year:
            for team in list(ratings):
                ratings[team] = (1500.0 + 3.0 * ratings[team]) / 4.0
            state["streak"].clear(); state["last_date"].clear(); active_year = kickoff.year
        ratings.setdefault(home, 1500.0); ratings.setdefault(away, 1500.0)
        home_rest = (kickoff - state["last_date"][home]).total_seconds() / 604800 if home in state["last_date"] else 0.0
        away_rest = (kickoff - state["last_date"][away]).total_seconds() / 604800 if away in state["last_date"] else 0.0
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
    parser = argparse.ArgumentParser()
    parser.add_argument("--season", type=int, default=datetime.now(timezone.utc).year)
    parser.add_argument("--api-url", default=API_ROOT)
    parser.add_argument("--api-token-file", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent
    database = Path("C:/RLDB/data/rldb.sqlite")
    matches_path = root / "snapshots/prod-observed-2026-09-11/matches.json"
    context_path = root / "experiments/EXP-2026-002C-rldb-context/completed_matches_with_rldb_context.csv"
    features_path = root / "experiments/EXP-2026-012-team-list-simple/run-009-round27-final/match_features.csv"
    lineups_path = root / "experiments/EXP-2026-012-team-list-simple/run-009-round27-final/match_lineups.csv"
    connection = sqlite3.connect(f"file:{database.as_posix()}?mode=ro", uri=True)
    _, ratings, state = prior.replay_end_state(matches_path, context_path)
    update_completed_since_baseline(connection, ratings, state)
    data = core.prepare_data(matches_path, context_path)
    base = prior.teamlist.replay_bstar(data)
    rookie_fit = prior.fit_rookie_model(data, base, features_path, lineups_path)
    history = alt.load_data(root)
    index = player_index(connection)
    output, unmatched = [], []
    for snapshot in get_lists(args.season, args.api_url):
        if str(snapshot.get("match_state", "")).lower() != "upcoming":
            continue
        if " Women" in str(snapshot["home"].get("name", "")) or " Women" in str(snapshot["away"].get("name", "")):
            continue
        home = canonical(snapshot["home"].get("nick_name") or snapshot["home"]["name"])
        away = canonical(snapshot["away"].get("nick_name") or snapshot["away"]["name"])
        kickoff_text = snapshot["kickoff_utc"]
        if core.parse_date(kickoff_text) < datetime.now(timezone.utc) - timedelta(days=2):
            continue
        if already_completed(connection, home, away, kickoff_text):
            continue
        kickoff = core.parse_date(kickoff_text)
        counts = {}
        for side, team in (("home", home), ("away", away)):
            careers = []
            for player in sorted(snapshot[side]["players"], key=lambda p: int(p.get("order") or 999))[:17]:
                name = f"{player.get('first_name', '')} {player.get('last_name', '')}".strip()
                candidates = index.get(normalise(name), [])
                if not candidates:
                    unmatched.append({"team": team, "player": name})
                games, matched, _player_id = career_before(connection, candidates, kickoff_text)
                careers.append(games)
            counts[side] = np.array([sum(g == 0 for g in careers), sum(g < 5 for g in careers), sum(g < 20 for g in careers)], float)
        feature_difference = counts["home"] - counts["away"]
        raw_adjustment = float(np.sum(rookie_fit["coefficients"] * (feature_difference - rookie_fit["means"])))
        capped = float(np.clip(raw_adjustment, -18, 18))
        gate = abs(capped) >= 6
        applied = capped if gate else 0.0
        home_rest = (kickoff - state["last_date"][home]).total_seconds() / 604800
        away_rest = (kickoff - state["last_date"][away]).total_seconds() / 604800
        # The grand-final home label is administrative at a neutral venue. It
        # must not create either the normal +40 or away-to-home travel points.
        neutral_grand_final = str(snapshot.get("round_name", "")).strip().lower() in {"grand final", "gf"}
        venue_home = 0 if neutral_grand_final else 40
        venue_travel = 0 if neutral_grand_final else 15 * core.distance_km(away, home) / 1000
        base_dr = (ratings[home] - ratings[away] + venue_home + venue_travel
                   + 5 * (home_rest - away_rest)
                   + 2.15 * (state["streak"].get(home, 0) - state["streak"].get(away, 0)))
        gate6_dr = base_dr + applied / 0.048406
        gate6_probability = 1 / (10 ** (-gate6_dr / 400) + 1)
        stage4_result = lineup_stage4(connection, snapshot, index, kickoff_text)
        stage4_applied = stage4_result["capped"] if abs(stage4_result["capped"]) >= 2 else 0.0
        stage4_dr = base_dr + stage4_applied / 0.048406
        stage4_probability = 1 / (10 ** (-stage4_dr / 400) + 1)
        base_probability = 1 / (10 ** (-base_dr / 400) + 1)
        lineup_gate = bool((stage4_probability >= 0.5) != (base_probability >= 0.5)
                           and abs(base_probability - 0.5) >= 0.10)
        candidate_dr = stage4_dr if lineup_gate else gate6_dr
        probability = stage4_probability if lineup_gate else gate6_probability
        shadows = player_shadows(root, database, stage4_result["modelRows"], candidate_dr)
        margin = int(stable_margin(history, candidate_dr))
        output.append({
            "nrl_match_id": str(snapshot["nrl_match_id"]), "season": int(snapshot["season"]),
            "round": snapshot["round_name"].replace("Finals Week", "Finals Wk"),
            "home": home, "away": away, "kickoff": kickoff_text,
            "source_observed_at": snapshot["observed_at_utc"], "lineupSha256": snapshot["lineup_sha256"],
            "base_dr": base_dr, "bstarP": base_probability,
            "rookieMargin": capped, "rookieGate": gate, "gate6P": gate6_probability,
            "lineupMargin": stage4_result["capped"], "lineupGate": lineup_gate,
            "stage4P": stage4_probability, "teamListDrivers": stage4_result["drivers"],
            "candidateDr": candidate_dr, "candidateP": probability,
            **shadows,
            "stableMargin": margin, "tip": home if probability >= 0.5 else away,
            "homeCounts": counts["home"].astype(int).tolist(),
            "awayCounts": counts["away"].astype(int).tolist(),
        })
    destination = args.output or (root.parent / "2027/data/current-finals-forecast.json")
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "model": "2027_v1.1.1",
        "note": "Prospective 2027 v1.1.1 forecast using actual-date rest, Rookie Gate 6 and Stage 4C; grand finals have zero home/travel adjustment; target results excluded. Player-impact models remain diagnostic shadows and are not used automatically.",
        "forecasts": output, "unmatchedPlayers": unmatched,
    }
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    upload_result = None
    if args.api_token_file:
        token = args.api_token_file.read_text(encoding="utf-8-sig").strip()
        upload_result = upload_forecasts(args.api_url, token, payload)
    print(json.dumps({"destination": str(destination), "forecasts": output,
                      "unmatchedPlayers": unmatched, "upload": upload_result}, indent=2))


if __name__ == "__main__":
    main()
