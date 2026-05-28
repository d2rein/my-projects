from __future__ import annotations

import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any

import requests
from flask import Flask, render_template


BASE_DIR = Path(__file__).resolve().parent
CONFIG_FILE = BASE_DIR / "match_config.json"
SCORECARD_FILE = BASE_DIR / "match_scorecard.json"
API_SCORECARD_URL = "https://api.cricapi.com/v1/match_scorecard"
DEFAULT_POLL_SECONDS = 20

app = Flask(__name__, template_folder=str(BASE_DIR / "templates"))


def load_json_file(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def short_name(full_name: str) -> str:
    if not full_name:
        return ""
    parts = full_name.strip().split()
    if len(parts) == 1:
        return parts[0]
    return f"{parts[0][0]}. {parts[-1]}"


def clean_name(name: str) -> str:
    if not name:
        return ""
    cleaned = (
        name.replace("(c)", "")
        .replace("†", "")
        .replace("â€\xa0", "")
        .replace("â€\xa0", "")
        .replace("â€\xa0", "")
        .replace("â€ ", "")
        .replace("â€ ", "")
    )
    return " ".join(cleaned.split()).strip()


def normalise_name(name: str) -> str:
    if not name:
        return ""
    compact = re.sub(r"\(.*?\)", " ", name)
    compact = re.sub(r"[^\w\s]", " ", compact)
    compact = re.sub(r"\s+", " ", compact)
    return compact.strip().lower()


def surname(name: str) -> str:
    parts = normalise_name(name).split()
    return parts[-1] if parts else ""


def find_match_in_scorecard(scorecard_obj: Any, match_id: str | None = None) -> dict[str, Any] | None:
    if isinstance(scorecard_obj, dict) and scorecard_obj.get("id"):
        return scorecard_obj

    if isinstance(scorecard_obj, dict) and "data" in scorecard_obj:
        data = scorecard_obj["data"]
        if isinstance(data, dict) and data.get("id"):
            return data
        if isinstance(data, list):
            if match_id:
                for match in data:
                    if match.get("id") == match_id:
                        return match
            return data[0] if data else None

    if isinstance(scorecard_obj, list):
        if match_id:
            for match in scorecard_obj:
                if match.get("id") == match_id:
                    return match
        return scorecard_obj[0] if scorecard_obj else None

    return None


def fetch_scorecard_from_api(match_id: str, api_key: str, timeout: int = 10) -> dict[str, Any] | None:
    if not match_id or not api_key:
        return None

    try:
        response = requests.get(
            API_SCORECARD_URL,
            params={"apikey": api_key, "offset": 0, "id": match_id},
            timeout=timeout,
        )
        response.raise_for_status()
        payload = response.json()
        if isinstance(payload, dict) and isinstance(payload.get("data"), dict):
            return payload["data"]
    except requests.RequestException:
        return None
    except ValueError:
        return None

    return None


def build_lookup(players: list[dict[str, Any]]) -> tuple[dict[str, int], dict[str, int]]:
    full_map: dict[str, int] = {}
    surname_map: dict[str, int] = {}
    for index, player in enumerate(players, start=1):
        raw_name = player.get("name", "")
        full = normalise_name(raw_name)
        last = surname(raw_name)
        if full:
            full_map[full] = index
        if last and last not in surname_map:
            surname_map[last] = index
    return full_map, surname_map


def get_player_number(name_raw: str, bowling_xi: list[dict[str, Any]]) -> str:
    if not name_raw:
        return ""

    full_map, surname_map = build_lookup(bowling_xi)
    full_name = normalise_name(name_raw)
    last_name = surname(name_raw)

    if full_name in full_map:
        return str(full_map[full_name])

    if last_name in surname_map:
        return str(surname_map[last_name])

    for candidate, number in full_map.items():
        if candidate.endswith(f" {last_name}") or candidate.split()[-1:] == [last_name]:
            return str(number)

    return "#"


def dismissal_code(dismissal_text: str, bowling_xi: list[dict[str, Any]]) -> str:
    if not dismissal_text:
        return ""

    raw = dismissal_text.strip()
    lowered = raw.lower()

    if "run out" in lowered:
        return "RO"

    if lowered in {"batting", "not out"}:
        return "*"

    bowler_raw = ""
    prefix = ""

    if " b " in lowered:
        prefix, bowler_raw = raw.rsplit(" b ", 1)
        bowler_raw = bowler_raw.strip()
        prefix = prefix.strip()
    elif lowered.startswith("b "):
        bowler_raw = raw[2:].strip()
    else:
        return raw.upper()

    bowler_number = get_player_number(bowler_raw, bowling_xi) or "#"
    prefix_lower = prefix.lower()

    if prefix_lower.startswith("c") and ("and" in prefix_lower or prefix_lower in {"c", "c and"}):
        return f"C{bowler_number} B{bowler_number}"

    if prefix_lower.startswith("c "):
        catcher_raw = prefix[2:].strip() or bowler_raw
        catcher_number = get_player_number(catcher_raw, bowling_xi) or "#"
        return f"C{catcher_number} B{bowler_number}"

    if prefix_lower.startswith("st "):
        stumper_raw = prefix[3:].strip()
        stumper_number = get_player_number(stumper_raw, bowling_xi) or "#"
        return f"ST{stumper_number} B{bowler_number}"

    if prefix_lower.startswith("lbw"):
        return f"LBW {bowler_number}"

    if not prefix:
        return f"B {bowler_number}"

    return raw.upper()


def build_team_innings_map(teams: list[str], scores: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    team_map = {team: [] for team in teams[:2]}
    for score in scores:
        inning_name = score.get("inning", "")
        for team in team_map:
            if team.lower() in inning_name.lower():
                team_map[team].append(score)
                break
    return team_map


def find_current_batters(current_innings: dict[str, Any]) -> list[dict[str, Any]]:
    live_batters: list[dict[str, Any]] = []
    for batter in current_innings.get("batting", []) or []:
        dismissal = (batter.get("dismissal-text") or batter.get("dismissal") or "").lower()
        if dismissal in {"batting", "not out"}:
            batsman = batter.get("batsman", {}) or {}
            live_batters.append(
                {
                    "name": short_name(clean_name(batsman.get("name", ""))),
                    "runs": batter.get("r", 0),
                    "balls": batter.get("b", 0),
                }
            )
    return live_batters[:2]


def build_fall_of_wickets(current_innings: dict[str, Any]) -> list[str]:
    fallen: list[str] = []
    for batter in current_innings.get("batting", []) or []:
        dismissal = (batter.get("dismissal-text") or batter.get("dismissal") or "").lower()
        if dismissal and dismissal not in {"batting", "not out"}:
            batsman = batter.get("batsman", {}) or {}
            fallen.append(f"{short_name(clean_name(batsman.get('name', '')))} {batter.get('r', 0)}")
    return fallen[:11]


def extract_batting_xi(current_innings: dict[str, Any]) -> list[dict[str, str]]:
    players: list[dict[str, str]] = []
    for entry in current_innings.get("batting", []) or []:
        name = clean_name((entry.get("batsman") or {}).get("name", ""))
        if name:
            players.append({"name": name})
    return players


def extract_bowling_xi(current_innings: dict[str, Any]) -> list[dict[str, str]]:
    players: list[dict[str, str]] = []
    for entry in current_innings.get("bowling", []) or []:
        name = clean_name((entry.get("bowler") or {}).get("name", ""))
        if name:
            players.append({"name": name})
    return players


def sum_team_runs(scores: list[dict[str, Any]], team: str) -> int:
    total = 0
    for score in scores:
        inning_name = score.get("inning", "")
        if team.lower() in inning_name.lower():
            total += int(score.get("r", 0) or 0)
    return total


def build_summary_rows(
    teams: list[str],
    team_innings_map: dict[str, list[dict[str, Any]]],
    current_batters: list[dict[str, Any]],
    curr_wickets: int,
    curr_extras: int,
    curr_runs: int,
    curr_overs: Any,
    lead_text: str,
) -> list[dict[str, str]]:
    def innings_text(team: str, index: int) -> str:
        innings = team_innings_map.get(team, [])
        if index >= len(innings):
            return ""
        item = innings[index]
        wickets = item.get("w", 0)
        runs = item.get("r", 0)
        overs = item.get("o", 0)
        return f"{wickets}/{runs} ({overs} ov)"

    rows = [
        {"label": teams[0] if teams else "Home", "value": "", "kind": "team"},
        {"label": "1st Innings", "value": innings_text(teams[0], 0) if teams else "", "kind": "innings"},
        {"label": "2nd Innings", "value": innings_text(teams[0], 1) if teams else "", "kind": "innings"},
        {"label": teams[1] if len(teams) > 1 else "Away", "value": "", "kind": "team"},
        {"label": "1st Innings", "value": innings_text(teams[1], 0) if len(teams) > 1 else "", "kind": "innings"},
        {"label": "2nd Innings", "value": innings_text(teams[1], 1) if len(teams) > 1 else "", "kind": "innings"},
        {"label": "Wickets", "value": str(curr_wickets), "kind": "major"},
        {
            "label": current_batters[0]["name"] if len(current_batters) > 0 else "Batter 1",
            "value": f"{current_batters[0]['runs']} off {current_batters[0]['balls']}" if len(current_batters) > 0 else "",
            "kind": "player",
        },
        {
            "label": current_batters[1]["name"] if len(current_batters) > 1 else "Batter 2",
            "value": f"{current_batters[1]['runs']} off {current_batters[1]['balls']}" if len(current_batters) > 1 else "",
            "kind": "player",
        },
        {"label": "Sundries", "value": str(curr_extras), "kind": "major"},
        {"label": "Total", "value": f"{curr_wickets}/{curr_runs} ({curr_overs} ov)", "kind": "major"},
        {"label": "Match", "value": lead_text, "kind": "major"},
    ]
    return rows


def build_display_rows(
    summary_rows: list[dict[str, str]],
    bowlers: list[dict[str, Any]],
    batters: list[dict[str, Any]],
    fall_of_wickets: list[str],
) -> list[dict[str, Any]]:
    row_count = max(len(summary_rows), len(bowlers), len(batters), len(fall_of_wickets), 11)
    rows: list[dict[str, Any]] = []

    for index in range(row_count):
        rows.append(
            {
                "summary": summary_rows[index] if index < len(summary_rows) else {"label": "", "value": "", "kind": ""},
                "bowler": bowlers[index] if index < len(bowlers) else {},
                "batter": batters[index] if index < len(batters) else {},
                "fall": fall_of_wickets[index] if index < len(fall_of_wickets) else "",
            }
        )
    return rows


def load_match_data() -> tuple[dict[str, Any], dict[str, Any]]:
    if not CONFIG_FILE.exists():
        raise FileNotFoundError(f"Missing config file: {CONFIG_FILE}")

    if not SCORECARD_FILE.exists():
        raise FileNotFoundError(f"Missing scorecard file: {SCORECARD_FILE}")

    config = load_json_file(CONFIG_FILE)
    local_payload = load_json_file(SCORECARD_FILE)
    match_id = config.get("match_id", "")
    api_key = config.get("api_key", "")
    use_local_only = bool(config.get("use_local_only", True))

    match_data = None if use_local_only else fetch_scorecard_from_api(match_id, api_key)
    if not match_data:
        match_data = find_match_in_scorecard(local_payload, match_id)
    if not match_data:
        raise ValueError("Could not load match data from local file or API.")

    return config, match_data


def prepare_scoreboard_view(config: dict[str, Any], match_data: dict[str, Any]) -> dict[str, Any]:
    teams = match_data.get("teams", ["Home", "Away"])
    scores = match_data.get("score", []) or []
    scorecard = match_data.get("scorecard", []) or []
    current_innings = scorecard[-1] if scorecard else {}
    current_inning_name = current_innings.get("inning", "")
    status = match_data.get("status", "")
    team_innings_map = build_team_innings_map(teams, scores)

    batting_side = teams[0] if teams and teams[0].lower() in current_inning_name.lower() else (teams[1] if len(teams) > 1 else teams[0])
    bowling_side = teams[1] if len(teams) > 1 and batting_side == teams[0] else (teams[0] if teams else "")

    home_xi = config.get("home_team", [])
    away_xi = config.get("away_team", [])
    batting_xi = home_xi if batting_side == (teams[0] if teams else "") else away_xi
    bowling_xi = away_xi if batting_xi is home_xi else home_xi

    current_batting_names = {
        clean_name((entry.get("batsman") or {}).get("name", ""))
        for entry in current_innings.get("batting", []) or []
    }
    current_bowling_names = {
        clean_name((entry.get("bowler") or {}).get("name", ""))
        for entry in current_innings.get("bowling", []) or []
    }

    batting_matches = sum(1 for player in batting_xi if clean_name(player.get("name", "")) in current_batting_names)
    bowling_matches = sum(1 for player in bowling_xi if clean_name(player.get("name", "")) in current_bowling_names)

    if batting_matches < 2:
        batting_xi = extract_batting_xi(current_innings)
    if bowling_matches < 2:
        bowling_xi = extract_bowling_xi(current_innings)

    batters = []
    for index, player in enumerate(batting_xi, start=1):
        name = clean_name(player.get("name", ""))
        batters.append(
            {
                "num": index,
                "name": name,
                "display_name": short_name(name),
                "runs": "",
                "balls": "",
                "bcode": "",
            }
        )

    bowlers = []
    for index, player in enumerate(bowling_xi, start=1):
        name = clean_name(player.get("name", ""))
        bowlers.append(
            {
                "num": index,
                "name": name,
                "display_name": short_name(name),
                "overs": "",
                "maidens": "",
                "wickets": "",
                "runs": "",
            }
        )

    totals_map = {score.get("inning", ""): score for score in scores if isinstance(score, dict)}

    if current_innings:
        batting_by_name = {row["name"]: row for row in batters}
        for entry in current_innings.get("batting", []) or []:
            raw_name = clean_name((entry.get("batsman") or {}).get("name", ""))
            row = batting_by_name.get(raw_name)
            if row:
                row["runs"] = entry.get("r", 0)
                row["balls"] = entry.get("b", 0)
                row["bcode"] = dismissal_code(entry.get("dismissal-text", "") or entry.get("dismissal", ""), bowling_xi)

        bowling_by_name = {row["name"]: row for row in bowlers}
        for entry in current_innings.get("bowling", []) or []:
            raw_name = clean_name((entry.get("bowler") or {}).get("name", ""))
            row = bowling_by_name.get(raw_name)
            if row:
                row["overs"] = entry.get("o", 0)
                row["maidens"] = entry.get("m", 0)
                row["wickets"] = entry.get("w", 0)
                row["runs"] = entry.get("r", 0)

    current_totals = totals_map.get(current_inning_name, {})
    curr_runs = int(current_totals.get("r", 0) or 0)
    curr_wickets = int(current_totals.get("w", 0) or 0)
    curr_overs = current_totals.get("o", 0)
    current_batters = find_current_batters(current_innings)
    batting_runs = sum(int(row["runs"]) for row in batters if row["runs"] != "")
    curr_extras = max(curr_runs - batting_runs, 0)
    fall_of_wickets = build_fall_of_wickets(current_innings)

    if len(teams) > 1:
        team_a_total = sum_team_runs(scores, teams[0])
        team_b_total = sum_team_runs(scores, teams[1])
        if team_a_total == team_b_total:
            lead_text = "Scores level"
        elif team_a_total > team_b_total:
            lead_text = f"{teams[0]} lead by {team_a_total - team_b_total}"
        else:
            lead_text = f"{teams[1]} lead by {team_b_total - team_a_total}"
    else:
        lead_text = status

    summary_rows = build_summary_rows(
        teams=teams,
        team_innings_map=team_innings_map,
        current_batters=current_batters,
        curr_wickets=curr_wickets,
        curr_extras=curr_extras,
        curr_runs=curr_runs,
        curr_overs=curr_overs,
        lead_text=lead_text,
    )

    display_rows = build_display_rows(summary_rows, bowlers, batters, fall_of_wickets)

    return {
        "match_name": match_data.get("name", "Cricket Scoreboard"),
        "status": status,
        "venue": match_data.get("venue", ""),
        "updated_time": datetime.now().strftime("%d %b %Y %H:%M:%S"),
        "rows": display_rows,
        "teams": teams,
        "batting_side": batting_side,
        "bowling_side": bowling_side,
        "current_total": f"{curr_runs}/{curr_wickets}",
        "current_overs": curr_overs,
        "refresh_seconds": int(config.get("refresh_seconds", DEFAULT_POLL_SECONDS)),
        "data_mode": "Local file" if config.get("use_local_only", True) else "API with local fallback",
    }


@app.route("/")
def scoreboard() -> str:
    try:
        config, match_data = load_match_data()
        context = prepare_scoreboard_view(config, match_data)
        return render_template("scoreboard.html", **context)
    except Exception as exc:
        return f"<pre>{type(exc).__name__}: {exc}</pre>", 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=True)
