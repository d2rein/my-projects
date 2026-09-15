"""EXP-2026-021: append-only prospective NRL information collector.

This script reads public web sources and writes evidence beneath its --archive-dir.
When explicitly configured, it also uploads normalized, append-only official
team-list snapshots to the read-only forecast-data area of the Elo API. It never
calls rating calculation routes or changes model parameters. Daily runs archive fixtures,
odds, prediction-market searches and newly published official expert-tip pages.
Weekly offseason runs archive rugby-league outright/futures pages and
prediction-market searches without requesting match fixtures or tipping pages.
Pregame runs use the locally cached fixture list and only access odds sources
when a match is 45-75 minutes from kickoff.
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import html
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode, urljoin
from urllib.request import Request, urlopen


USER_AGENT = "NRL-Elo-Research/1.0 (low-frequency archival research)"
NRL_DRAW = "https://www.nrl.com/draw/data"
NRL_ORIGIN = "https://www.nrl.com"
NRL_TIPPING = "https://www.nrl.com/news/topic/tipping/"
SPORTSBET_NRL = "https://www.sportsbet.com.au/betting/rugby-league/nrl"
SPORTSBET_RL_OUTRIGHTS = "https://www.sportsbet.com.au/betting/rugby-league/outrights"
SPORTSBET_NRL_FUTURES = "https://www.sportsbet.com.au/betting/rugby-league/nrl-futures-byo"
ODDS_SNIFFER_NRL = "https://www.theoddssniffer.com/rugby-league/nrl"
MANIFOLD_SEARCH = "https://api.manifold.markets/v0/search-markets"
POLYMARKET_SEARCH = "https://gamma-api.polymarket.com/public-search"

BOOKMAKER_CODES = {
    "SB": "Sportsbet",
    "TAB": "TAB",
    "LAD": "Ladbrokes",
    "BR": "BetRight",
    "PB": "PointsBet",
    "365": "bet365",
    "BTR": "Betr",
    "CB": "CrownBet",
}

TEAM_ALIASES = {
    "brisbane broncos": "Broncos", "canberra raiders": "Raiders",
    "canterbury bulldogs": "Bulldogs", "canterbury-bankstown bulldogs": "Bulldogs",
    "cronulla sharks": "Sharks", "cronulla-sutherland sharks": "Sharks",
    "dolphins": "Dolphins", "the dolphins": "Dolphins",
    "gold coast titans": "Titans", "manly sea eagles": "Sea Eagles",
    "manly-warringah sea eagles": "Sea Eagles", "melbourne storm": "Storm",
    "new zealand warriors": "Warriors", "newcastle knights": "Knights",
    "north queensland cowboys": "Cowboys", "nth queensland cowboys": "Cowboys",
    "parramatta eels": "Eels", "penrith panthers": "Panthers",
    "south sydney rabbitohs": "Rabbitohs", "st george illawarra dragons": "Dragons",
    "st. george illawarra dragons": "Dragons", "sydney roosters": "Roosters",
    "wests tigers": "Tigers",
}

MARKET_FIELDS = [
    "run_id", "observed_at_utc", "mode", "source", "bookmaker",
    "source_url", "source_event_id", "home_team", "away_team",
    "kickoff_utc", "market_type", "selection", "line", "decimal_odds",
    "implied_probability_raw", "source_reported_at", "raw_sha256",
]

FUTURES_FIELDS = [
    "run_id", "observed_at_utc", "mode", "source", "source_url",
    "source_outcome_id", "market_type", "selection", "decimal_odds",
    "implied_probability_raw", "raw_sha256",
]


def extract_nrl_match_data(payload: bytes) -> dict[str, Any]:
    """Extract NRL's structured Match Centre JSON from an official page."""
    body = payload.decode("utf-8", errors="replace")
    match = re.search(
        r'<div\b(?=[^>]*\bid=["\']vue-match-centre["\'])[^>]*\bq-data=["\'](?P<data>.*?)["\'][^>]*>',
        body,
        re.I | re.S,
    )
    if not match:
        raise ValueError("Official Match Centre q-data was not found")
    parsed = json.loads(html.unescape(match.group("data")))
    if not isinstance(parsed, dict) or not isinstance(parsed.get("match"), dict):
        raise ValueError("Official Match Centre q-data has no match object")
    return parsed["match"]


def normalize_nrl_team_list(payload: bytes, source_url: str, observed: str) -> dict[str, Any]:
    match = extract_nrl_match_data(payload)

    def team(side: str) -> dict[str, Any]:
        source = match.get(side) or {}
        players = []
        for order, player in enumerate(source.get("players") or [], start=1):
            if not isinstance(player, dict):
                continue
            players.append({
                "order": order,
                "player_id": str(player.get("playerId") or ""),
                "first_name": str(player.get("firstName") or "").strip(),
                "last_name": str(player.get("lastName") or "").strip(),
                "number": player.get("number"),
                "position": str(player.get("position") or "").strip(),
                "is_captain": bool(player.get("isCaptain")),
                "is_on_field": bool(player.get("isOnField")),
                "profile_url": str(player.get("url") or ""),
            })
        return {
            "team_id": str(source.get("teamId") or ""),
            "name": str(source.get("name") or "").strip(),
            "nick_name": canonical_team(str(source.get("nickName") or source.get("name") or "")),
            "captain_player_id": str(source.get("captainPlayerId") or ""),
            "players": players,
        }

    normalized = {
        "schema_version": 1,
        "nrl_match_id": str(match.get("matchId") or ""),
        "season": int(str(match.get("startTime") or "0000")[:4] or 0),
        "round_number": match.get("roundNumber"),
        "round_name": str(match.get("roundTitle") or ""),
        "kickoff_utc": str(match.get("startTime") or ""),
        "match_state": str(match.get("matchState") or ""),
        "match_mode": str(match.get("matchMode") or ""),
        "venue": str(match.get("venue") or ""),
        "source_url": source_url,
        "source_updated_at_utc": str(match.get("updated") or ""),
        "observed_at_utc": observed,
        "home": team("homeTeam"),
        "away": team("awayTeam"),
    }
    if not normalized["nrl_match_id"]:
        raise ValueError("Official Match Centre data has no match ID")
    if not normalized["home"]["players"] or not normalized["away"]["players"]:
        raise ValueError("Official pre-match team lists are not yet published")
    hash_input = {
        key: value for key, value in normalized.items()
        if key not in {"observed_at_utc", "source_updated_at_utc", "source_url"}
    }
    normalized["lineup_sha256"] = sha256(canonical_json(hash_input))
    return normalized


def upload_team_lists(api_url: str, token: str, snapshots: list[dict[str, Any]]) -> dict[str, Any]:
    target = api_url.rstrip("/") + "/api/prospective/team-lists"
    body = json.dumps({"snapshots": snapshots}, ensure_ascii=False).encode("utf-8")
    request = Request(target, data=body, headers={
        "User-Agent": USER_AGENT,
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
    }, method="POST")
    with urlopen(request, timeout=45) as response:
        if response.status not in {200, 201}:
            raise RuntimeError(f"POST {target} returned HTTP {response.status}")
        return json.loads(response.read().decode("utf-8"))


def canonical_json(value: Any) -> bytes:
    return (json.dumps(value, indent=2, ensure_ascii=False, sort_keys=True) + "\n").encode("utf-8")


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest().upper()


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def iso_utc(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def strip_tags(value: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", value))).strip()


def canonical_team(value: str) -> str:
    cleaned = re.sub(r"\s+", " ", html.unescape(value)).strip()
    return TEAM_ALIASES.get(cleaned.lower(), cleaned)


def fetch(url: str, timeout: int = 45) -> bytes:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"}, method="GET")
    with urlopen(request, timeout=timeout) as response:
        if response.status != 200:
            raise RuntimeError(f"GET {url} returned HTTP {response.status}")
        return response.read()


def write_jsonl(path: Path, rows: list[dict[str, Any]]) -> None:
    if not rows:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8", newline="") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")


def write_csv(path: Path, rows: list[dict[str, Any]], fields: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def append_csv(path: Path, rows: list[dict[str, Any]], fields: list[str]) -> None:
    if not rows:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    exists = path.exists() and path.stat().st_size > 0
    with path.open("a", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        if not exists:
            writer.writeheader()
        writer.writerows(rows)


def parse_datetime(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


def decimal(value: str) -> float | None:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if result > 1 else None


def market_row(base: dict[str, Any], *, market_type: str, selection: str,
               odds: float | None, line: float | None = None,
               bookmaker: str | None = None) -> dict[str, Any]:
    return {
        **base,
        "bookmaker": bookmaker or base.get("bookmaker", ""),
        "market_type": market_type,
        "selection": selection,
        "line": "" if line is None else line,
        "decimal_odds": "" if odds is None else odds,
        "implied_probability_raw": "" if odds is None else 1.0 / odds,
    }


def parse_nrl_fixtures(payload: bytes, round_number: int) -> list[dict[str, Any]]:
    data = json.loads(payload.decode("utf-8"))
    rows: list[dict[str, Any]] = []
    for fixture in data.get("fixtures", []):
        clock = fixture.get("clock") or {}
        home = fixture.get("homeTeam") or {}
        away = fixture.get("awayTeam") or {}
        rows.append({
            "competition": 111,
            "season": 2026,
            "round_number": round_number,
            "round_name": fixture.get("roundTitle") or fixture.get("roundName") or "",
            "home_team": home.get("nickName") or home.get("name") or "",
            "away_team": away.get("nickName") or away.get("name") or "",
            "kickoff_utc": clock.get("kickOffTimeLong") or "",
            "match_state": fixture.get("matchState") or "",
            "match_mode": fixture.get("matchMode") or "",
            "match_centre_url": fixture.get("matchCentreUrl") or "",
            "venue": (fixture.get("venue") or {}).get("name", "") if isinstance(fixture.get("venue"), dict) else (fixture.get("venue") or ""),
        })
    return rows


def extract_sportsbet(payload: bytes, observed: str, run_id: str, mode: str) -> list[dict[str, Any]]:
    body = payload.decode("utf-8", errors="replace")
    digest = sha256(payload)
    rows: list[dict[str, Any]] = []
    card_pattern = re.compile(
        r'data-automation-id="(?P<id>\d+)-competition-event-card"(?P<body>.*?)(?=</li>)',
        re.S,
    )
    for card in card_pattern.finditer(body):
        block = card.group("body")
        teams = re.findall(r'data-automation-id="participant-(?:one|two)">([^<]+)', block)
        kickoff = re.search(r'<time dateTime="([^"]+)"', block)
        link = re.search(r'href="([^"]+/nrl/[^"]+)"', block)
        if len(teams) != 2 or not kickoff:
            continue
        home, away = map(canonical_team, teams)
        try:
            kickoff_utc = iso_utc(parse_datetime(kickoff.group(1)))
        except ValueError:
            kickoff_utc = kickoff.group(1)
        source_url = "https://www.sportsbet.com.au" + link.group(1) if link and link.group(1).startswith("/") else SPORTSBET_NRL
        base = {
            "run_id": run_id, "observed_at_utc": observed, "mode": mode,
            "source": "sportsbet_public_listing", "bookmaker": "Sportsbet",
            "source_url": source_url, "source_event_id": card.group("id"),
            "home_team": home, "away_team": away, "kickoff_utc": kickoff_utc,
            "source_reported_at": "", "raw_sha256": digest,
        }
        sections = list(re.finditer(r'data-automation-id="market-coupon-label">([^<]+)</div>', block))
        for index, section in enumerate(sections):
            label = html.unescape(section.group(1)).strip()
            end = sections[index + 1].start() if index + 1 < len(sections) else len(block)
            section_body = block[section.end():end]
            buttons = re.findall(
                r'data-automation-id="multi-market-sports-outcome-button"(?P<button>.*?</button>)',
                section_body,
                re.S,
            )
            for position, button in enumerate(buttons[:2]):
                price_match = re.search(r'column-grid-text">([0-9.]+)</span>', button)
                odds = decimal(price_match.group(1)) if price_match else None
                if label == "Head to Head":
                    rows.append(market_row(base, market_type="h2h", selection=(home, away)[position], odds=odds))
                elif label == "Line":
                    line_match = re.search(r'\(([+-]?\d+(?:\.\d+)?)\)', strip_tags(button))
                    line = float(line_match.group(1)) if line_match else None
                    rows.append(market_row(base, market_type="handicap", selection=(home, away)[position], odds=odds, line=line))
                elif label == "Total Match Points":
                    text = strip_tags(button)
                    total_match = re.search(r'(Over|Under)\s*\([OU]\s*([0-9.]+)\)', text, re.I)
                    selection = total_match.group(1).lower() if total_match else ("over", "under")[position]
                    line = float(total_match.group(2)) if total_match else None
                    rows.append(market_row(base, market_type="total", selection=selection, odds=odds, line=line))
    return rows


def extract_odds_sniffer(payload: bytes, observed: str, run_id: str, mode: str,
                         fixtures: list[dict[str, Any]]) -> list[dict[str, Any]]:
    body = payload.decode("utf-8", errors="replace")
    digest = sha256(payload)
    reported = ""
    reported_match = re.search(r'Last updated:\s*([^<]+)', body)
    if reported_match:
        reported = strip_tags(reported_match.group(1))
    headings = list(re.finditer(r'<h3[^>]*class="game-name[^>]*>(.*?)</h3>', body, re.S))
    rows: list[dict[str, Any]] = []
    for index, heading in enumerate(headings):
        event_name = strip_tags(heading.group(1))
        end = headings[index + 1].start() if index + 1 < len(headings) else len(body)
        block = body[heading.end():end]
        parts = re.split(r'\s+vs\s+', event_name, maxsplit=1, flags=re.I)
        if len(parts) != 2:
            continue
        home, away = map(canonical_team, parts)
        headers = [strip_tags(value) for value in re.findall(r'<span class="bm-header[^>]*>(.*?)</span>', block, re.S)]
        selection_rows = re.findall(
            r'<div class="table-row(?! header-row)[^"]*[^>]*>\s*<span class="sel-name[^>]*>(.*?)</span>(.*?)(?=</div>)',
            block,
            re.S,
        )
        kickoff = ""
        normalized = {re.sub(r"[^a-z]", "", value.lower()) for value in (home, away)}
        for fixture in fixtures:
            candidate = {re.sub(r"[^a-z]", "", str(fixture[key]).lower()) for key in ("home_team", "away_team")}
            if normalized == candidate:
                kickoff = str(fixture.get("kickoff_utc", ""))
                break
        for selection_html, price_html in selection_rows[:2]:
            selection = canonical_team(strip_tags(selection_html))
            prices = re.findall(r'<span class="price[^>]*>(.*?)</span>', price_html, re.S)
            for position, price_html_value in enumerate(prices):
                if position >= len(headers):
                    break
                price_text = strip_tags(price_html_value).replace("$", "")
                odds = decimal(price_text)
                if odds is None:
                    continue
                base = {
                    "run_id": run_id, "observed_at_utc": observed, "mode": mode,
                    "source": "odds_sniffer_comparison", "bookmaker": BOOKMAKER_CODES.get(headers[position], headers[position]),
                    "source_url": ODDS_SNIFFER_NRL, "source_event_id": event_name,
                    "home_team": home, "away_team": away, "kickoff_utc": kickoff,
                    "source_reported_at": reported, "raw_sha256": digest,
                }
                rows.append(market_row(base, market_type="h2h", selection=selection, odds=odds))
    return rows


def extract_sportsbet_futures(payload: bytes, observed: str, run_id: str,
                              mode: str, source: str, source_url: str) -> list[dict[str, Any]]:
    body = payload.decode("utf-8", errors="replace")
    digest = sha256(payload)
    names = re.finditer(
        r'data-automation-id="(?P<id>\d+)-list-outcome-name">(?P<name>.*?)</span>',
        body, re.S,
    )
    rows: list[dict[str, Any]] = []
    for match in names:
        outcome_id = match.group("id")
        tail = body[match.end():match.end() + 2500]
        price = re.search(
            rf'data-automation-id="{re.escape(outcome_id)}-list-outcome-text">([0-9.]+)</span>',
            tail, re.S,
        )
        odds = decimal(price.group(1)) if price else None
        if odds is None:
            continue
        selection = strip_tags(match.group("name"))
        lowered = selection.lower()
        if "minor premiership" in lowered:
            market_type = "minor_premiership"
        elif "top 4" in lowered:
            market_type = "top_4"
        elif "top 8" in lowered:
            market_type = "top_8"
        elif "least wins" in lowered or "wooden spoon" in lowered:
            market_type = "wooden_spoon"
        elif "grand final" in lowered or "premiership" in lowered:
            market_type = "premiership_winner"
        else:
            market_type = "other_futures"
        rows.append({
            "run_id": run_id, "observed_at_utc": observed, "mode": mode,
            "source": source, "source_url": source_url,
            "source_outcome_id": outcome_id, "market_type": market_type,
            "selection": selection, "decimal_odds": odds,
            "implied_probability_raw": 1.0 / odds, "raw_sha256": digest,
        })
    return rows


def find_tip_urls(payload: bytes) -> list[str]:
    body = payload.decode("utf-8", errors="replace")
    paths = set(re.findall(r'href="([^"#?]+)"', body))
    return sorted(
        "https://www.nrl.com" + path if path.startswith("/") else path
        for path in paths
        if re.search(r'/news/2026/.+(?:expert-)?tipping', path, re.I)
    )


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def due_pregame_fixtures(archive: Path, now: datetime) -> list[dict[str, Any]]:
    fixtures_path = archive / "state" / "latest_fixtures.json"
    fixtures = load_json(fixtures_path, [])
    captured = load_json(archive / "state" / "pregame_captured.json", {})
    due = []
    for fixture in fixtures:
        kickoff_text = fixture.get("kickoff_utc")
        if not kickoff_text or str(fixture.get("match_state", "")).lower() not in {"upcoming", "prematch", ""}:
            continue
        try:
            kickoff = parse_datetime(str(kickoff_text))
        except ValueError:
            continue
        minutes = (kickoff - now).total_seconds() / 60
        key = fixture.get("match_centre_url") or f"{fixture.get('home_team')}|{fixture.get('away_team')}|{kickoff_text}"
        if 45 <= minutes <= 75 and key not in captured:
            due.append({**fixture, "capture_key": key, "minutes_to_kickoff": minutes})
    return due


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive-dir", type=Path, required=True)
    parser.add_argument("--mode", choices=("daily", "pregame", "offseason", "manual"), default="manual")
    parser.add_argument("--season", type=int, default=2026)
    parser.add_argument("--rounds", default="28,29,30,31")
    parser.add_argument("--delay-seconds", type=float, default=1.0)
    parser.add_argument("--team-list-api-url", default=os.environ.get("NRL_ELO_TEAMLIST_API_URL", ""))
    parser.add_argument("--team-list-api-token-file", type=Path)
    args = parser.parse_args()

    archive = args.archive_dir.resolve()
    now = utc_now()
    observed = iso_utc(now)
    run_id = now.strftime("%Y%m%dT%H%M%SZ") + "-" + args.mode
    run_dir = archive / "runs" / run_id
    raw_dir = run_dir / "raw"
    raw_dir.mkdir(parents=True, exist_ok=False)
    events: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    fixtures: list[dict[str, Any]] = []
    market_rows: list[dict[str, Any]] = []
    prediction_rows: list[dict[str, Any]] = []
    futures_rows: list[dict[str, Any]] = []
    team_list_snapshots: list[dict[str, Any]] = []

    def record_error(source: str, url: str, exc: Exception) -> None:
        row = {"at": iso_utc(utc_now()), "run_id": run_id, "source": source, "url": url,
               "error_type": type(exc).__name__, "message": str(exc)}
        errors.append(row)
        events.append({**row, "event": "source_error"})

    def collect_bytes(source: str, url: str, filename: str) -> bytes | None:
        try:
            payload = fetch(url)
            # Sports pages are large, repetitive HTML. Preserve the exact
            # response bytes inside a deterministic gzip member; raw_sha256
            # continues to identify the uncompressed source response.
            compressed = gzip.compress(payload, compresslevel=9, mtime=0)
            path = raw_dir / (filename + ".gz")
            path.write_bytes(compressed)
            events.append({"at": iso_utc(utc_now()), "run_id": run_id, "event": "source_captured",
                           "source": source, "url": url, "bytes": len(payload),
                           "stored_bytes": len(compressed), "content_encoding": "gzip",
                           "sha256": sha256(payload), "stored_sha256": sha256(compressed),
                           "file": str(path.relative_to(archive))})
            time.sleep(max(0, args.delay_seconds))
            return payload
        except Exception as exc:  # each source must fail independently
            record_error(source, url, exc)
            return None

    due: list[dict[str, Any]] = []
    if args.mode == "pregame":
        due = due_pregame_fixtures(archive, now)
        if not due:
            manifest = {"schema_version": 1, "run_id": run_id, "mode": args.mode,
                        "started_at_utc": observed, "status": "no_match_in_45_to_75_minute_window",
                        "live_model_changed": False, "network_requests": 0}
            (run_dir / "manifest.json").write_bytes(canonical_json(manifest))
            print(json.dumps(manifest, indent=2))
            return 0

    if args.mode not in {"pregame", "offseason"}:
        for round_number in [int(value) for value in args.rounds.split(",") if value.strip()]:
            query = urlencode({"competition": 111, "round": round_number, "season": args.season})
            url = f"{NRL_DRAW}?{query}"
            payload = collect_bytes("nrl_draw", url, f"nrl_draw_round_{round_number}.json")
            if payload:
                try:
                    fixtures.extend(parse_nrl_fixtures(payload, round_number))
                except Exception as exc:
                    record_error("nrl_draw_parser", url, exc)
        if fixtures:
            # Invalid/not-yet-published finals round numbers can temporarily
            # return the latest available round. Preserve one canonical copy.
            unique: dict[str, dict[str, Any]] = {}
            for fixture in fixtures:
                key = str(fixture.get("match_centre_url") or
                          f"{fixture.get('home_team')}|{fixture.get('away_team')}|{fixture.get('kickoff_utc')}")
                unique.setdefault(key, fixture)
            fixtures = list(unique.values())
            state = archive / "state"
            state.mkdir(parents=True, exist_ok=True)
            (state / "latest_fixtures.json").write_bytes(canonical_json(fixtures))
    elif args.mode == "pregame":
        fixtures = load_json(archive / "state" / "latest_fixtures.json", [])

    # NRL.com publishes Tuesday squads and later reductions on each official
    # Match Centre page. Daily captures preserve the week-long evolution;
    # pregame captures preserve the last list available near kickoff.
    if args.mode != "offseason":
        eligible = due if args.mode == "pregame" else [
            fixture for fixture in fixtures
            if str(fixture.get("match_state", "")).lower() in {"upcoming", "prematch", ""}
        ]
        for position, fixture in enumerate(eligible, start=1):
            relative_url = str(fixture.get("match_centre_url") or "")
            if not relative_url:
                continue
            source_url = urljoin(NRL_ORIGIN, relative_url)
            payload = collect_bytes("nrl_official_team_list", source_url,
                                    f"nrl_team_list_{position}.html")
            if not payload:
                continue
            try:
                snapshot = normalize_nrl_team_list(payload, source_url, observed)
                team_list_snapshots.append(snapshot)
                events.append({"at": iso_utc(utc_now()), "run_id": run_id,
                               "event": "team_list_parsed", "source": "nrl_official_team_list",
                               "nrl_match_id": snapshot["nrl_match_id"],
                               "home_players": len(snapshot["home"]["players"]),
                               "away_players": len(snapshot["away"]["players"]),
                               "lineup_sha256": snapshot["lineup_sha256"]})
            except Exception as exc:
                record_error("nrl_official_team_list_parser", source_url, exc)

    sources = [] if args.mode == "offseason" else [
        ("sportsbet_public_listing", SPORTSBET_NRL, "sportsbet_nrl.html", extract_sportsbet),
        ("odds_sniffer_comparison", ODDS_SNIFFER_NRL, "odds_sniffer_nrl.html", extract_odds_sniffer),
    ]
    for source, url, filename, extractor in sources:
        payload = collect_bytes(source, url, filename)
        if payload:
            try:
                if source == "odds_sniffer_comparison":
                    rows = extractor(payload, observed, run_id, args.mode, fixtures)
                else:
                    rows = extractor(payload, observed, run_id, args.mode)
                market_rows.extend(rows)
                events.append({"at": iso_utc(utc_now()), "run_id": run_id, "event": "source_parsed",
                               "source": source, "rows": len(rows)})
            except Exception as exc:
                record_error(source + "_parser", url, exc)

    if args.mode == "offseason":
        # Preserve raw pages even before a stable all-team market is published.
        # A later parser can recover the exact prices from these immutable files.
        for source, url, filename in (
            ("sportsbet_rugby_league_outrights", SPORTSBET_RL_OUTRIGHTS,
             "sportsbet_rugby_league_outrights.html"),
            ("sportsbet_nrl_futures", SPORTSBET_NRL_FUTURES,
             "sportsbet_nrl_futures_byo.html"),
        ):
            payload = collect_bytes(source, url, filename)
            if payload:
                try:
                    rows = extract_sportsbet_futures(payload, observed, run_id, args.mode, source, url)
                    futures_rows.extend(rows)
                    events.append({"at": iso_utc(utc_now()), "run_id": run_id,
                                   "event": "source_parsed", "source": source,
                                   "rows": len(rows)})
                except Exception as exc:
                    record_error(source + "_parser", url, exc)

    if args.mode != "pregame":
        prediction_sources = [
            ("manifold", MANIFOLD_SEARCH + "?" + urlencode({"term": "NRL", "sort": "liquidity", "filter": "open", "limit": 100}), "manifold_nrl.json"),
            ("polymarket", POLYMARKET_SEARCH + "?" + urlencode({"q": "NRL"}), "polymarket_nrl.json"),
        ]
        for source, url, filename in prediction_sources:
            payload = collect_bytes(source, url, filename)
            if not payload:
                continue
            try:
                parsed = json.loads(payload.decode("utf-8"))
                if source == "manifold":
                    markets = parsed if isinstance(parsed, list) else []
                    for market in markets:
                        prediction_rows.append({"run_id": run_id, "observed_at_utc": observed, "source": source,
                                                "question": market.get("question"), "probability": market.get("probability"),
                                                "volume": market.get("volume"), "liquidity": market.get("totalLiquidity"),
                                                "url": market.get("url"), "raw_sha256": sha256(payload)})
                else:
                    for event in parsed.get("events", []) if isinstance(parsed, dict) else []:
                        prediction_rows.append({"run_id": run_id, "observed_at_utc": observed, "source": source,
                                                "question": event.get("title"), "probability": "",
                                                "volume": event.get("volume"), "liquidity": event.get("liquidity"),
                                                "url": event.get("slug"), "raw_sha256": sha256(payload)})
            except Exception as exc:
                record_error(source + "_parser", url, exc)

        tips_payload = None
        if args.mode != "offseason":
            tips_payload = collect_bytes("nrl_official_tipping_index", NRL_TIPPING, "nrl_tipping_index.html")
        if tips_payload:
            tip_urls = find_tip_urls(tips_payload)
            seen_path = archive / "state" / "seen_tip_urls.json"
            seen = set(load_json(seen_path, []))
            new_urls = [url for url in tip_urls if url not in seen]
            # Fetch at most the three newest unseen pages in one daily run.
            for position, url in enumerate(new_urls[-3:]):
                payload = collect_bytes("nrl_official_expert_tips", url, f"nrl_expert_tips_{position + 1}.html")
                if payload:
                    seen.add(url)
                    events.append({"at": iso_utc(utc_now()), "run_id": run_id, "event": "tip_page_archived",
                                   "source": "nrl_official_expert_tips", "url": url, "parsed": False})
            seen_path.parent.mkdir(parents=True, exist_ok=True)
            seen_path.write_bytes(canonical_json(sorted(seen)))

    if args.mode == "pregame" and due:
        captured_path = archive / "state" / "pregame_captured.json"
        captured = load_json(captured_path, {})
        for fixture in due:
            captured[fixture["capture_key"]] = {"run_id": run_id, "observed_at_utc": observed,
                                                "minutes_to_kickoff": fixture["minutes_to_kickoff"]}
        captured_path.write_bytes(canonical_json(captured))

    write_csv(run_dir / "fixtures.csv", fixtures, [
        "competition", "season", "round_number", "round_name", "home_team", "away_team",
        "kickoff_utc", "match_state", "match_mode", "match_centre_url", "venue",
    ])
    write_csv(run_dir / "market_observations.csv", market_rows, MARKET_FIELDS)
    write_csv(run_dir / "futures_observations.csv", futures_rows, FUTURES_FIELDS)
    (run_dir / "team_list_snapshots.json").write_bytes(canonical_json(team_list_snapshots))
    prediction_fields = ["run_id", "observed_at_utc", "source", "question", "probability", "volume", "liquidity", "url", "raw_sha256"]
    write_csv(run_dir / "prediction_markets.csv", prediction_rows, prediction_fields)
    write_jsonl(run_dir / "events.jsonl", events)
    write_jsonl(run_dir / "errors.jsonl", errors)
    append_csv(archive / "observations" / "market_observations.csv", market_rows, MARKET_FIELDS)
    append_csv(archive / "observations" / "futures_observations.csv", futures_rows, FUTURES_FIELDS)
    append_csv(archive / "observations" / "prediction_markets.csv", prediction_rows, prediction_fields)
    write_jsonl(archive / "observations" / "events.jsonl", events)
    write_jsonl(archive / "observations" / "errors.jsonl", errors)

    # The local archive records a lineup only when the named players/roles
    # change. Repeated observations remain visible in run evidence and API
    # upload results without bloating the long-term change history.
    if team_list_snapshots:
        hashes_path = archive / "state" / "latest_team_list_hashes.json"
        known_hashes = load_json(hashes_path, {})
        changed = []
        for snapshot in team_list_snapshots:
            match_id = snapshot["nrl_match_id"]
            if known_hashes.get(match_id) != snapshot["lineup_sha256"]:
                changed.append(snapshot)
                known_hashes[match_id] = snapshot["lineup_sha256"]
        write_jsonl(archive / "observations" / "team_list_snapshots.jsonl", changed)
        hashes_path.parent.mkdir(parents=True, exist_ok=True)
        hashes_path.write_bytes(canonical_json(known_hashes))

    upload_result: dict[str, Any] | None = None
    if team_list_snapshots and args.team_list_api_url:
        try:
            if not args.team_list_api_token_file:
                raise ValueError("--team-list-api-token-file is required when API upload is enabled")
            token = args.team_list_api_token_file.read_text(encoding="utf-8-sig").strip()
            if not token:
                raise ValueError("Team-list API token file is empty")
            upload_result = upload_team_lists(args.team_list_api_url, token, team_list_snapshots)
            events.append({"at": iso_utc(utc_now()), "run_id": run_id,
                           "event": "team_lists_uploaded", "source": "elo_forecast_data_api",
                           "received": upload_result.get("received"),
                           "inserted": upload_result.get("inserted")})
            write_jsonl(run_dir / "events.jsonl", [events[-1]])
            write_jsonl(archive / "observations" / "events.jsonl", [events[-1]])
        except Exception as exc:
            record_error("elo_team_list_api_upload", args.team_list_api_url, exc)
            write_jsonl(run_dir / "errors.jsonl", [errors[-1]])
            write_jsonl(archive / "observations" / "errors.jsonl", [errors[-1]])

    manifest = {
        "schema_version": 1, "experiment": "EXP-2026-021", "run_id": run_id,
        "mode": args.mode, "started_at_utc": observed, "completed_at_utc": iso_utc(utc_now()),
        "offline_only": not bool(args.team_list_api_url), "live_model_changed": False,
        "team_list_api_upload_enabled": bool(args.team_list_api_url),
        "team_list_api_upload": upload_result,
        "counts": {"fixtures": len(fixtures), "market_observations": len(market_rows),
                   "futures_observations": len(futures_rows),
                   "prediction_market_observations": len(prediction_rows),
                   "team_list_snapshots": len(team_list_snapshots), "events": len(events),
                   "errors": len(errors)},
        "due_pregame_fixtures": due,
    }
    (run_dir / "manifest.json").write_bytes(canonical_json(manifest))
    print(json.dumps(manifest, indent=2))
    # An empty market is a valid observation, especially during the offseason.
    # Source failures are already explicit in errors.jsonl.
    return 0


if __name__ == "__main__":
    sys.exit(main())
