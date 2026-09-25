"""Build auditable player-level hover details for the 2027 preview cache.

The output explains the already-frozen Rookie/Lineup adjustments. It does not
fit a model or change a prediction. The RLDB database is opened read-only.
"""
from __future__ import annotations

import csv
import json
import sqlite3
from collections import defaultdict
from pathlib import Path

import stage4_expected_minutes as s4


def rows(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def main() -> None:
    offline = Path(__file__).resolve().parent
    site = offline.parent / "2027"
    database = Path("C:/RLDB/data/rldb.sqlite")
    lineups = offline / "experiments/EXP-2026-036-stage3-role-retest/run-001/role-lineups/match_lineups_role_based.csv"
    decisions = offline / "experiments/EXP-2026-039-stage4c-relative-market/run-001/selected_decisions.csv"
    coefficients = offline / "experiments/EXP-2026-037-stage4-expected-minutes/run-001/selected_coefficient_history.csv"

    grouped, _ = s4.grouped_lineups(lineups)
    minute_map = s4.load_minutes(database)
    expected = s4.expected_rows(grouped, minute_map, {"recent_window": 3, "shrink_games": 2.0})
    selected = {int(row["elo_index"]): row for row in rows(decisions)}
    coefficient_map: dict[int, dict[str, float]] = defaultdict(dict)
    intercept: dict[int, float] = {}
    for row in rows(coefficients):
        if row["selection_label"] != "tip_selected" or row["family"] != "minutes_rookie_role5" or int(row["config_index"]) != 41:
            continue
        year = int(row["target_year"])
        coefficient_map[year][row["feature"].removeprefix("mw_burden_")] = float(row["margin_points_per_feature_unit"])
        intercept[year] = float(row["raw_formula_intercept"])

    connection = sqlite3.connect(f"file:{database.as_posix()}?mode=ro", uri=True)
    connection.execute("PRAGMA query_only=ON")
    names = {f"id:{int(pid)}": str(name) for pid, name in connection.execute("SELECT player_id,display_name FROM players")}
    connection.close()

    output: dict[str, object] = {}
    for index, match_rows in grouped.items():
        decision = selected.get(index)
        if not decision:
            continue
        if decision["strong_overturn"] != "1":
            # Keep Gate-6 applications too; build-cache decides whether to attach.
            pass
        year = int(match_rows[0]["year"])
        coefs = coefficient_map.get(year)
        by_team: dict[str, list[dict[str, str]]] = defaultdict(list)
        for row in match_rows:
            by_team[row["team_id"]].append(row)
        sides: dict[str, object] = {}
        for team_rows in by_team.values():
            side = team_rows[0]["side"]
            actual_entries = [(row, *expected[(index, row["team_id"], row["player_key"])]) for row in team_rows if row["actual"] == "1"]
            actual_entries = s4.normalize(actual_entries)
            current = []
            for row, minutes, role in actual_entries:
                games = int(row["career_games_before"])
                contribution = None if not coefs else coefs[role] * s4.burden(games) * minutes / 80.0
                if side == "away" and contribution is not None:
                    contribution = -contribution
                current.append({
                    "name": names.get(row["player_key"], row["player_key"]), "role": role,
                    "games": games, "minutes": round(minutes, 1),
                    "incoming": row["recent5_reference"] != "1",
                    "homeMarginPoints": None if contribution is None else round(contribution, 2),
                })
            current.sort(key=lambda item: (-(abs(item["homeMarginPoints"]) if item["homeMarginPoints"] is not None else 0), item["name"]))
            outgoing = []
            for row in team_rows:
                if row["recent5_reference"] == "1" and row["actual"] != "1":
                    minutes, role = expected[(index, row["team_id"], row["player_key"])]
                    outgoing.append({"name": names.get(row["player_key"], row["player_key"]), "role": role, "games": int(row["career_games_before"]), "minutes": round(minutes, 1)})
            outgoing.sort(key=lambda item: (-item["minutes"], item["name"]))
            sides[side] = {"current": current, "outgoing": outgoing}
        output[str(index)] = {"intercept": intercept.get(year), **sides}

    destination = site / "data/team-list-details.json"
    destination.write_text(json.dumps({"version": "LA_v1.0", "matches": output}, separators=(",", ":")), encoding="utf-8")
    print(json.dumps({"destination": str(destination), "matches": len(output)}))


if __name__ == "__main__":
    main()
