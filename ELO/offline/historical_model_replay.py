"""EXP-2026-031: recovered historical models, read-only inputs, offline outputs.

Run: python ELO/offline/historical_model_replay.py
Every fixed model is replayed independently from 2009. Rookie coefficients are
refitted annually on earlier seasons only; player experience remains prior-only.
"""
from pathlib import Path
import json
import math
import traceback
import numpy as np
import big_joint_sweep as core
import team_list_sweep as s8
import rookie_gate_sweep as rookie

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "experiments/EXP-2026-031-recovered-historical-models/run-003"
MATCHES = ROOT / "snapshots/prod-observed-2026-09-11/matches.json"
CONTEXT = ROOT / "experiments/EXP-2026-002C-rldb-context/completed_matches_with_rldb_context.csv"
FEATURES = ROOT / "experiments/EXP-2026-012-team-list-simple/run-009-round27-final/match_features.csv"
LINEUPS = FEATURES.with_name("match_lineups.csv")
YEARS = tuple(range(2009, 2027))

def model(id, label, k, home, weight, margin="none", early=0., rest=0., streak=0., travel=0., own=()):
    return dict(id=id, label=label, k=k, home=home, weight=weight, margin=margin,
                early=early, rest=rest, streak=streak, travel=travel, ownYears=list(own))

MODELS = [
    model("legacy2018", "2018", 15, 25, 14, own=(2018,)),
    model("legacy2019", "2019–2022", 10, 25, 2, own=range(2019,2023)),
    model("legacy2023", "2023/2024", 10, 25, 2, "legacy", own=(2023,2024)),
    model("legacy2025", "2025", 11, 45, 2, "legacy", 1., own=(2025,)),
    model("start2026", "2026 preseason", 9.455, 40, 3, "current", .95, 3., 2.5, 15.),
    model("production", "2026 production", 9.455, 40, 3, "current", .95, 3.2, 2.15, 15.),
    model("browser2026", "2026 browser K=9.5", 9.5, 40, 3, "current", .95, 3.2, 2.15, 15.),
    model("bstar", "B*", 9.455, 40, 3, "current", .95, 5., 2.15, 15.),
]

def legacy_multiplier(margin):
    units = abs(margin) / 6.
    index = max(1, min(4, math.ceil(units)))
    return (.5, 1., 1.5, 1.75)[index-1] + max(0., units-3.)/8.

def run_fixed(config, data, start=2009):
    ratings = np.full(len(data.teams), 1500.)
    probability = np.full(len(data.year), np.nan)
    drs = probability.copy()
    for i in np.flatnonzero(data.year >= start):
        if data.new_season[i]:
            ratings = (1500. + config["weight"] * ratings)/(config["weight"]+1.)
        h, a = int(data.home[i]), int(data.away[i])
        rest = data.day_rest_difference_units[i] if config["id"] == "bstar" else data.round_rest_difference[i]
        dr = (ratings[h]-ratings[a]+config["home"]+config["travel"]*data.travel_units[i]
              +config["rest"]*rest+config["streak"]*data.streak_difference[i])
        p = 1./(1.+10.**(-dr/400.))
        probability[i], drs[i] = p, dr
        multiplier = (legacy_multiplier(data.margin[i]) if config["margin"] == "legacy"
                      else data.margin_current[i] if config["margin"] == "current" else 1.)
        delta = (config["k"]+config["early"]*data.early_round[i])*multiplier*(data.actual[i]-p)
        ratings[h] += delta
        ratings[a] -= delta
        assert abs(ratings.sum()-1500.*len(ratings)) < 1e-7, "zero-sum drift"
    return {"probability": probability, "dr": drs, "expected_margin": .048406*drs}

def score(indices, base, data):
    p = np.clip(base["probability"][indices], 1e-12, 1-1e-12)
    actual = data.actual[indices]
    good = np.where(actual == .5, True, (p >= .5) == (actual == 1.))
    return dict(games=len(indices), correct=int(good.sum()), accuracy=float(good.mean()),
                brier=float(np.mean((p-actual)**2)),
                logLoss=float(np.mean(-(actual*np.log(p)+(1-actual)*np.log(1-p)))))

def old_margin(year, dr):
    if year < 2023:
        return None
    if year == 2023:
        return 2
    if year == 2024:
        return math.floor(.08*abs(dr)+.5)
    return max(1, 2*math.floor((.048406*abs(dr)-1)/2.+.5))

def self_test():
    assert legacy_multiplier(6)==.5
    assert legacy_multiplier(12)==1.
    assert legacy_multiplier(18)==1.5
    assert legacy_multiplier(24)==1.875
    assert legacy_multiplier(30)==2.
    assert legacy_multiplier(0)==.5
    assert (11+max(0,11-1))*legacy_multiplier(24)==39.375
    assert (11+max(0,11-11))*legacy_multiplier(24)==20.625
    assert (14*1800+1500)/15==1780
    assert (2*1800+1500)/3==1700
    assert old_margin(2022,100) is None
    assert old_margin(2023,100)==2
    assert old_margin(2024,-100)==8
    assert old_margin(2025,0)==1

def main():
    self_test()
    OUT.mkdir(parents=True, exist_ok=False)
    s8.atomic_json(OUT/"manifest.json", dict(experiment="EXP-2026-031",createdUtc=s8.now(),
        offlineOnly=True, liveModelChanged=False, initialRating=1500, startYear=2009,
        cutoff="2026 Round 27; frozen snapshot excludes finals results", models=MODELS,
        inputs={str(p.relative_to(ROOT)):s8.sha256(p) for p in (MATCHES,CONTEXT,FEATURES,LINEUPS,Path(__file__))},
        assumptions=["No travel/rest/streak before 2026; home advantage always applied as supplied.",
            "CHOOSE index clamped to 1–4, including draws; tail uses continuous abs(margin)/6−3, NOT current ceil−4.",
            "2018 uses the written formula (14*R+1500)/15; 2019–2025 use (2*R+1500)/3.",
            "2025 K'=(11+max(0,11-round))*margin multiplier, confirmed by user.",
            "Pre-2023 margin rules unknown: not scored. 2023 pick 2. 2024 margin: round(.08*abs(effective DR)), no added minimum. 2025: nearest multiple of 2 to .048406*abs(effective DR)−1, minimum 1.",
            "Home advantage occurs once in effective DR; forecasts precede updates; draws count as correct tips.",
            "Rookie layer: existing prior-only career features, annual refit restricted to 2009 onward; B* fallback where insufficient fitting/lineup data.",
            "No pre-2018 parameter provenance supplied; earlier results are model exercises, not historical forecast claims."]))
    s8.append_jsonl(OUT/"events.jsonl", dict(event="started", time=s8.now()))
    try:
        data = core.prepare_data(MATCHES, CONTEXT)
        raw = json.loads(MATCHES.read_text())
        raw = sorted([r for r in raw if r.get("home_score") is not None and r.get("away_score") is not None],
                     key=lambda r:(int(r["year"]),int(r["match_index"]),int(r["game_num"])))
        bases = {}
        for config in MODELS:
            bases[config["id"]] = run_fixed(config,data)
            print(f'Finished {config["label"]}', flush=True)
            s8.append_jsonl(OUT/"events.jsonl",dict(event="model_complete",model=config["id"],time=s8.now()))
        # Preserve full snapshot indices to match immutable player-feature files.
        indices, columns = rookie.build_features(FEATURES, LINEUPS)
        keep = data.year[indices] >= 2009
        indices = indices[keep]
        columns = {name: values[keep] for name, values in columns.items()}
        spec = dict(features=("debut_all","under5_all","under20_all"),training_window_years=8,ridge=300.,margin_cap=18.)
        _, adjustment = rookie.predict(spec, YEARS, indices, columns, bases["bstar"], data)
        candidate = {key:value.copy() for key,value in bases["bstar"].items()}
        use = np.isfinite(adjustment) & (np.abs(adjustment)>=6.) & (data.year>=2009)
        candidate["dr"][use] += adjustment[use]/.048406
        candidate["expected_margin"][use] += adjustment[use]
        candidate["probability"][use] = 1./(1.+10.**(-candidate["dr"][use]/400.))
        bases["candidate"] = candidate
        models = MODELS+[dict(id="candidate",label="B* + Rookie Gate 6",ownYears=[],**spec)]
        native = run_fixed(MODELS[5],data,start=1998)
        assert score(np.flatnonzero(data.year==2026),native,data)["correct"]==130, "native production parity"
        assert np.allclose(bases["bstar"]["probability"][data.year>=2009],
            s8.replay_bstar(core.PreparedData(**{name:(getattr(data,name)[data.year>=2009] if name!="teams" else data.teams)
                for name in data.__dataclass_fields__}))["probability"]), "B* engine parity"
        summaries, predictions, own = [], [], []
        for model_config in models:
            id = model_config["id"]
            for year in YEARS:
                ix = np.flatnonzero(data.year==year)
                summaries.append(dict(model=id,year=year,**score(ix,bases[id],data)))
            for i in np.flatnonzero(data.year>=2009):
                r,p,dr = raw[i],float(bases[id]["probability"][i]),float(bases[id]["dr"][i])
                predictions.append(dict(model=id,match_id=r["id"],year=int(data.year[i]),round=r["round"],
                    home=r["home_team"],away=r["away_team"],home_probability=p,effective_dr=dr,
                    actual_margin=int(data.margin[i]),correct=int(data.actual[i]==.5 or (p>=.5)==(data.actual[i]==1.))))
                if int(data.year[i]) in model_config.get("ownYears",[]):
                    own.append(dict(id=r["id"],year=int(data.year[i]),model=id,p=p,margin=old_margin(int(data.year[i]),dr)))
        s8.write_csv(OUT/"yearly_results.csv",summaries)
        s8.write_csv(OUT/"game_predictions.csv",predictions)
        periods=[]
        for m in models:
            for label, low in (("2009–2026",2009),("2018–2026",2018),("2022–2026",2022),("2026",2026)):
                ix=np.flatnonzero(data.year>=low)
                periods.append(dict(model=m["id"],period=label,**score(ix,bases[m["id"]],data)))
        s8.write_csv(OUT/"period_results.csv",periods)
        own_yearly=[]
        for config in MODELS:
            for year in config["ownYears"]:
                rows=[r for r in own if r["year"]==year]
                by_id={r["id"]:r for r in rows}
                first=[r for r in raw if int(r["year"])==year and int(r["game_num"])==1 and str(r["round"]).startswith("Rd") and by_id[r["id"]]["margin"] is not None]
                errs=[abs((1 if by_id[r["id"]]["p"]>=.5 else -1)*by_id[r["id"]]["margin"]
                    -(int(r["home_score"])-int(r["away_score"]))) for r in first]
                result=next(r for r in summaries if r["model"]==config["id"] and r["year"]==year)
                own_yearly.append(dict(**result,label=f'{year} historical',status="reconstructed",marginExact=errs.count(0),
                                       marginGames=len(errs),marginError=sum(errs) if errs else None))
        payload=dict(meta=dict(experiment="EXP-2026-031",startYear=2009,initialRating=1500,cutoff="2026 Rd 27",
            note="All fixed systems use an independent 2009 start. Rookie prior-only annual fits; fallback to B* where unavailable. Historical forecast column is reconstructed, not an archived prediction."),
            models=models,yearly=summaries,periods=periods,ownYearly=own_yearly,ownPredictions=own)
        s8.atomic_json(OUT/"website_payload.json",payload)
        s8.atomic_json(OUT/"checkpoint.json",dict(status="complete",models=len(models),errors=0,games=int((data.year>=2009).sum()),time=s8.now()))
        print(json.dumps(periods,indent=2), flush=True)
    except Exception:
        s8.append_jsonl(OUT/"errors.jsonl",dict(time=s8.now(),traceback=traceback.format_exc()))
        s8.atomic_json(OUT/"checkpoint.json",dict(status="failed",time=s8.now()))
        raise

if __name__=="__main__":
    main()
