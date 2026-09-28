"""Fixed-rating audit of the men's +40 home term by inferred venue type."""
from __future__ import annotations

import argparse
import csv
import json
import math
from collections import Counter, defaultdict
from pathlib import Path


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def logistic(dr: float) -> float:
    return 1 / (1 + 10 ** (-dr / 400))


def actual(row: dict) -> float:
    return 1.0 if float(row["home_score"]) > float(row["away_score"]) else 0.0 if float(row["home_score"]) < float(row["away_score"]) else 0.5


def metrics(rows: list[dict], hga: float) -> dict:
    if not rows:
        return {"games": 0, "correct": 0, "brier": None, "homeWinRateExDraws": None}
    ps = [logistic(row["no_hga_dr"] + hga) for row in rows]; ys = [actual(row) for row in rows]
    decided = [(p, y) for p, y in zip(ps, ys) if y != 0.5]
    home_wins = sum(y == 1 for y in ys); away_wins = sum(y == 0 for y in ys)
    return {"games": len(rows), "correct": sum(y == .5 or (p >= .5) == (y == 1) for p, y in zip(ps, ys)),
            "brier": sum((p-y)**2 for p, y in zip(ps, ys))/len(rows),
            "homeWinRateExDraws": home_wins/(home_wins+away_wins) if home_wins+away_wins else None,
            "homeWins": home_wins, "awayWins": away_wins, "draws": len(rows)-len(decided)}


def policy_metrics(rows: list[dict], name: str, choose_hga) -> dict:
    probabilities = [logistic(row["no_hga_dr"] + choose_hga(row)) for row in rows]
    outcomes = [actual(row) for row in rows]
    return {"policy": name, "games": len(rows),
            "correct": sum(y == .5 or (p >= .5) == (y == 1) for p, y in zip(probabilities, outcomes)),
            "brier": sum((p-y)**2 for p, y in zip(probabilities, outcomes))/len(rows),
            "changedTipsVsAlways40": sum((p >= .5) != (logistic(row["no_hga_dr"]+40) >= .5) for row, p in zip(rows, probabilities))}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--context", required=True, type=Path)
    parser.add_argument("--predictions", required=True, type=Path)
    parser.add_argument("--out-dir", required=True, type=Path)
    args = parser.parse_args(); args.out_dir.mkdir(parents=True, exist_ok=True)
    context = read_csv(args.context)
    predictions = {int(row["match_id"]): row for row in read_csv(args.predictions) if row["baseline"] == "B0-backend"}
    primary_counts: dict[tuple[int, str], Counter] = defaultdict(Counter)
    for row in context:
        if row["is_finals"] == "0": primary_counts[(int(row["year"]), row["home_team"])][row["venue"]] += 1
    primary = {key: counts.most_common(1)[0][0] for key, counts in primary_counts.items()}
    prepared = []
    for row in context:
        prediction = predictions.get(int(row["id"])); year = int(row["year"])
        if prediction is None: continue
        venue, home, away = row["venue"], row["home_team"], row["away_team"]
        home_primary, away_primary = primary.get((year, home)), primary.get((year, away))
        at_home, at_away = venue == home_primary, venue == away_primary
        finals = row["is_finals"] == "1"; grand_final = "grand" in row["round"].lower() or row["round"].lower().startswith("gf")
        if grand_final: category = "grand_final"
        elif finals: category = "final_shared_primary" if at_home and at_away else "final_home_primary" if at_home else "final_away_primary" if at_away else "final_neutral_other"
        else: category = "regular_shared_primary" if at_home and at_away else "regular_home_primary" if at_home else "regular_away_primary" if at_away else "regular_alternate_or_neutral"
        probability = float(prediction["home_win_probability"]); dr = float(prediction["rating_difference"])
        prepared.append({**row, "category": category, "home_primary": home_primary, "away_primary": away_primary,
                         "current_probability": float(probability), "no_hga_dr": dr-40})
    hga_grid = list(range(-40, 81, 5)); categories = sorted({row["category"] for row in prepared})
    summary_rows = []
    for period, selected in (("all_1998_2026", prepared), ("recent_2009_2026", [r for r in prepared if int(r["year"]) >= 2009]), ("recent_2019_2026", [r for r in prepared if int(r["year"]) >= 2019])):
        for category in ["all", *categories]:
            rows = selected if category == "all" else [row for row in selected if row["category"] == category]
            if not rows: continue
            candidates = [(hga, metrics(rows, hga)) for hga in hga_grid]; best_hga, best = min(candidates, key=lambda item: item[1]["brier"])
            current, zero = metrics(rows, 40), metrics(rows, 0)
            summary_rows.append({"period": period, "category": category, **{f"current_{k}": v for k, v in current.items()},
                                 "zero_correct": zero["correct"], "zero_brier": zero["brier"],
                                 "best_hga": best_hga, "best_correct": best["correct"], "best_brier": best["brier"]})
    fields = list(summary_rows[0])
    with (args.out_dir / "category_summary.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields); writer.writeheader(); writer.writerows(summary_rows)
    detail_fields = ["id","year","round","home_team","away_team","home_score","away_score","venue","category","home_primary","away_primary","current_probability","no_hga_dr"]
    with (args.out_dir / "classified_matches.csv").open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=detail_fields); writer.writeheader(); writer.writerows([{k:r.get(k) for k in detail_fields} for r in prepared])
    recent = [row for row in prepared if int(row["year"]) >= 2009]
    neutral_finals = {"grand_final", "final_neutral_other", "final_away_primary", "final_shared_primary"}
    policies = [
        policy_metrics(recent, "always_40", lambda _row: 40),
        policy_metrics(recent, "grand_final_zero", lambda row: 0 if row["category"] == "grand_final" else 40),
        policy_metrics(recent, "inferred_neutral_finals_zero", lambda row: 0 if row["category"] in neutral_finals else 40),
        policy_metrics(recent, "all_finals_zero", lambda row: 0 if row["is_finals"] == "1" else 40),
    ]
    focus = [row for row in summary_rows if row["period"] == "recent_2009_2026" and (row["category"] == "all" or "final" in row["category"])]
    changed = []
    for row in recent:
        if row["category"] != "grand_final": continue
        current, zero = logistic(row["no_hga_dr"]+40), logistic(row["no_hga_dr"])
        if (current >= .5) != (zero >= .5):
            changed.append({key: row[key] for key in ("year","round","home_team","away_team","home_score","away_score","venue")} | {"currentP": current, "zeroP": zero})
    payload = {"method": "Fixed-rating probability overlay; subtracts the deployed +40 term and tests alternatives without replaying later rating updates.", "rows": focus, "policies": policies, "grandFinalChangedTips": changed}
    (args.out_dir / "summary.json").write_text(json.dumps(payload, indent=2)+"\n", encoding="utf-8")
    print(json.dumps(payload, indent=2)); return 0


if __name__ == "__main__":
    raise SystemExit(main())
