"""Classify venue asymmetry and test finals-specific HGA/travel/seed formulations."""
from __future__ import annotations

import argparse, csv, itertools, json, math
from collections import Counter, defaultdict
from pathlib import Path


def read_csv(path: Path) -> list[dict[str,str]]:
    with path.open(encoding="utf-8-sig",newline="") as handle:return list(csv.DictReader(handle))
def logistic(dr: float)->float:return 1/(1+10**(-dr/400))
def haversine(a,b):
    if a is None or b is None:return None
    lat1,lon1,lat2,lon2=map(math.radians,(*a,*b));dlat=lat2-lat1;dlon=lon2-lon1
    x=math.sin(dlat/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return 6371*2*math.atan2(math.sqrt(x),math.sqrt(1-x))
def outcome(row):return 1.0 if float(row["home_score"])>float(row["away_score"]) else 0.0 if float(row["home_score"])<float(row["away_score"]) else .5
def score(rows,config):
    correct=0;brier=0;changed=0
    for row in rows:
        if row["is_finals"]!="1":p=row["current_p"]
        else:
            hga={"final_home_ground":config["home"],"final_shared_ground":config["shared"],"final_opponent_ground":config["opponent"],"grand_final":config["grand"]}.get(row["type"],config["neutral"])
            travel=max(-60,min(60,config["travel"]*row["geo_edge"]/1000)) if row["geo_edge"] is not None else 0
            seed=config["seed"]*row["seed_edge"]
            p=logistic(row["base_dr"]+hga+travel+seed)
        y=outcome(row);correct+=int(y==.5 or (p>=.5)==(y==1));brier+=(p-y)**2;changed+=int((p>=.5)!=(row["current_p"]>=.5))
    return {"games":len(rows),"correct":correct,"brier":brier/len(rows),"changed":changed}


def candidate_probability(row, config):
    hga={"final_home_ground":config["home"],"final_shared_ground":config["shared"],
         "final_opponent_ground":config["opponent"],"grand_final":config["grand"]}.get(row["type"],config["neutral"])
    travel=max(-60,min(60,config["travel"]*row["geo_edge"]/1000)) if row["geo_edge"] is not None else 0
    seed=config["seed"]*row["seed_edge"]
    return logistic(row["base_dr"]+hga+travel+seed)


def main():
    ap=argparse.ArgumentParser();ap.add_argument("--context",type=Path,required=True);ap.add_argument("--predictions",type=Path,required=True);ap.add_argument("--coordinates",type=Path,required=True);ap.add_argument("--out-dir",type=Path,required=True);a=ap.parse_args();a.out_dir.mkdir(parents=True,exist_ok=True)
    context=read_csv(a.context);pred={int(r["match_id"]):r for r in read_csv(a.predictions) if r["baseline"]=="B0-backend"}
    coords={r["rldb_venue"]:(float(r["latitude"]),float(r["longitude"])) for r in read_csv(a.coordinates) if r.get("latitude") and r.get("longitude")}
    home_counts=defaultdict(Counter);ladder=defaultdict(lambda:defaultdict(lambda:{"pts":0,"diff":0,"for":0}))
    for r in context:
        if r["is_finals"]=="0":
            y=int(r["year"]);home_counts[(y,r["home_team"])][r["venue"]]+=1
            hs,ass=int(float(r["home_score"])),int(float(r["away_score"]));h,a_=ladder[y][r["home_team"]],ladder[y][r["away_team"]]
            h["for"]+=hs;a_["for"]+=ass;h["diff"]+=hs-ass;a_["diff"]+=ass-hs
            if hs>ass:h["pts"]+=2
            elif ass>hs:a_["pts"]+=2
            else:h["pts"]+=1;a_["pts"]+=1
    primary={k:v.most_common(1)[0][0] for k,v in home_counts.items()}
    home_sets={k:{venue for venue,n in counts.items() if n>=max(2,math.ceil(sum(counts.values())*.2))} for k,counts in home_counts.items()}
    ranks={}
    for year,teams in ladder.items():
        ordered=sorted(teams,key=lambda t:(-teams[t]["pts"],-teams[t]["diff"],-teams[t]["for"],t));ranks[year]={t:i+1 for i,t in enumerate(ordered)}
    rows=[]
    for r in context:
        p=pred.get(int(r["id"]));
        if not p:continue
        year=int(r["year"]);venue=r["venue"];home=r["home_team"];away=r["away_team"]
        hc,ac=coords.get(primary.get((year,home),"")),coords.get(primary.get((year,away),""));vc=coords.get(venue)
        hd,ad=haversine(hc,vc),haversine(ac,vc);edge=None if hd is None or ad is None else ad-hd
        in_h=venue in home_sets.get((year,home),set());in_a=venue in home_sets.get((year,away),set())
        grand="grand" in r["round"].lower() or r["round"].lower().startswith("gf")
        if grand:kind="grand_final"
        elif r["is_finals"]=="1":kind="final_shared_ground" if in_h and in_a else "final_home_ground" if in_h else "final_opponent_ground" if in_a else "final_remote_showcase" if hd and ad and hd>1000 and ad>1000 else "final_home_leaning_neutral" if edge is not None and edge>=150 else "final_away_leaning_neutral" if edge is not None and edge<=-150 else "final_balanced_neutral"
        else:kind="regular_shared_ground" if in_h and in_a else "regular_home_ground" if in_h else "regular_opponent_ground" if in_a else "regular_remote_showcase" if hd and ad and hd>1000 and ad>1000 else "regular_home_leaning_neutral" if edge is not None and edge>=150 else "regular_away_leaning_neutral" if edge is not None and edge<=-150 else "regular_balanced_neutral"
        hr,ar=ranks.get(year,{}).get(home),ranks.get(year,{}).get(away);seed_edge=0 if hr is None or ar is None else max(-4,min(4,ar-hr))
        current_dr=float(p["rating_difference"]);legacy=float(p["travel_adjustment"])
        rows.append({**r,"type":kind,"home_primary":primary.get((year,home)),"away_primary":primary.get((year,away)),"home_distance_km":hd,"away_distance_km":ad,"geo_edge":edge,"home_seed":hr,"away_seed":ar,"seed_edge":seed_edge,"current_p":float(p["home_win_probability"]),"base_dr":current_dr-40-legacy,"legacy_travel":legacy})
    finals=[r for r in rows if r["is_finals"]=="1"];selection=[r for r in finals if int(r["year"])<=2016];holdout=[r for r in finals if int(r["year"])>=2017]
    configs=[]
    grid_axes=((0,20,40,60,80,100,120),(0,20,40),(-40,-20,0,20),(0,20,40),(0,20,40),(0,5,10,15,20,25,30,35,40),(0,5,10))
    for values in itertools.product(*grid_axes):
        config=dict(zip(("home","shared","opponent","neutral","grand","travel","seed"),values));m=score(selection,config);configs.append({**config,"selection_correct":m["correct"],"selection_brier":m["brier"]})
    configs.sort(key=lambda x:(x["selection_brier"],-x["selection_correct"]));selected=configs[0]
    no_neutral_bonus=min((x for x in configs if x["shared"]==0 and x["neutral"]==0 and x["grand"]==0 and x["opponent"]<=0),key=lambda x:(x["selection_brier"],-x["selection_correct"]))
    no_home_labels=min((x for x in configs if x["home"]==0 and x["shared"]==0 and x["opponent"]==0 and x["neutral"]==0 and x["grand"]==0),key=lambda x:(x["selection_brier"],-x["selection_correct"]))
    current={"home":40,"shared":40,"opponent":40,"neutral":40,"grand":40,"travel":0,"seed":0}
    # current needs its legacy travel, so evaluate it directly rather than through the venue formulation.
    def raw_current(subset):
        ys=[outcome(r) for r in subset];ps=[r["current_p"] for r in subset]
        return {"games":len(subset),"correct":sum(y==.5 or (p>=.5)==(y==1) for p,y in zip(ps,ys)),"brier":sum((p-y)**2 for p,y in zip(ps,ys))/len(subset),"changed":0}
    comparison={"selected":selected,"selection":{"current":raw_current(selection),"candidate":score(selection,selected)},"holdout":{"current":raw_current(holdout),"candidate":score(holdout,selected)}}
    presets={
        "zero_all_finals":{"home":0,"shared":0,"opponent":0,"neutral":0,"grand":0,"travel":0,"seed":0},
        "only_actual_home_ground":{"home":40,"shared":0,"opponent":0,"neutral":0,"grand":0,"travel":0,"seed":0},
        "venue_plus_actual_travel":{"home":40,"shared":0,"opponent":0,"neutral":0,"grand":0,"travel":15,"seed":0},
        "selected_no_neutral_bonus":no_neutral_bonus,
        "selected_no_home_labels":no_home_labels,
        "selected_pre_2017":selected,
    }
    comparisons=[]
    for period,subset in (("all_1998_2025",finals),("selection_through_2016",selection),("holdout_2017_2025",holdout)):
        comparisons.append({"period":period,"system":"current_plus40_legacy_travel",**raw_current(subset)})
        for name,config in presets.items():comparisons.append({"period":period,"system":name,**score(subset,config)})
    for year in sorted({int(r["year"]) for r in finals}):
        subset=[r for r in finals if int(r["year"])==year]
        comparisons.append({"period":str(year),"system":"current_plus40_legacy_travel",**raw_current(subset)})
        for name,config in presets.items():comparisons.append({"period":str(year),"system":name,**score(subset,config)})

    rolling=[]
    for cutoff in range(2008,2021):
        train=[r for r in finals if int(r["year"])<=cutoff];test=[r for r in finals if int(r["year"])>cutoff]
        candidates=[]
        for values in itertools.product(*grid_axes):
            config=dict(zip(("home","shared","opponent","neutral","grand","travel","seed"),values));m=score(train,config)
            candidates.append(({**config},m))
        best_config,best_train=min(candidates,key=lambda item:(item[1]["brier"],-item[1]["correct"]))
        rolling.append({"cutoff":cutoff,**best_config,
                        "train_games":len(train),"train_correct":best_train["correct"],"train_brier":best_train["brier"],
                        "test_games":len(test),"current_test_correct":raw_current(test)["correct"],"candidate_test_correct":score(test,best_config)["correct"],
                        "current_test_brier":raw_current(test)["brier"],"candidate_test_brier":score(test,best_config)["brier"]})
    inventory=[]
    for period,subset in (("all_finals",finals),("finals_holdout_2017_2025",holdout),("all_matches",rows)):
        for kind in sorted({r["type"] for r in subset}):
            group=[r for r in subset if r["type"]==kind];ys=[outcome(r) for r in group]
            inventory.append({"period":period,"type":kind,"games":len(group),"home_wins":sum(y==1 for y in ys),"away_wins":sum(y==0 for y in ys),"draws":sum(y==.5 for y in ys),"mean_geo_edge_km":sum(r["geo_edge"] for r in group if r["geo_edge"] is not None)/max(1,sum(r["geo_edge"] is not None for r in group)),"mean_seed_edge":sum(r["seed_edge"] for r in group)/len(group)})
    nonstandard=[r for r in rows if r["is_finals"]=="0" and r["type"]!="regular_home_ground"]
    regular_train=[r for r in nonstandard if int(r["year"])<=2016];regular_test=[r for r in nonstandard if int(r["year"])>=2017]
    def regular_score(subset,config):
        correct=0;brier=0;changed=0
        for r in subset:
            hga=config["shared"] if r["type"]=="regular_shared_ground" else config["opponent"] if r["type"]=="regular_opponent_ground" else config["neutral"]
            travel=max(-60,min(60,config["travel"]*r["geo_edge"]/1000)) if r["geo_edge"] is not None else 0
            p=logistic(r["base_dr"]+hga+travel);y=outcome(r)
            correct+=int(y==.5 or (p>=.5)==(y==1));brier+=(p-y)**2;changed+=int((p>=.5)!=(r["current_p"]>=.5))
        return {"games":len(subset),"correct":correct,"brier":brier/len(subset),"changed":changed}
    regular_configs=[]
    for values in itertools.product((-20,0,20,40),(-40,-20,0,20),(-20,0,20,40),(0,5,10,15,20,25,30,35,40)):
        config=dict(zip(("shared","opponent","neutral","travel"),values));regular_configs.append((config,regular_score(regular_train,config)))
    regular_selected,regular_train_score=min(regular_configs,key=lambda item:(item[1]["brier"],-item[1]["correct"]))
    regular_comparison={"selected":regular_selected,
      "selection":{"current":raw_current(regular_train),"candidate":regular_train_score},
      "holdout":{"current":raw_current(regular_test),"candidate":regular_score(regular_test,regular_selected)}}
    detail_fields=["id","year","round","home_team","away_team","home_score","away_score","venue","type","home_primary","away_primary","home_distance_km","away_distance_km","geo_edge","home_seed","away_seed","seed_edge","current_p","base_dr","legacy_travel"]
    with (a.out_dir/"classified_finals.csv").open("w",encoding="utf-8",newline="") as f:w=csv.DictWriter(f,fieldnames=detail_fields);w.writeheader();w.writerows([{k:r.get(k) for k in detail_fields} for r in finals])
    with (a.out_dir/"venue_type_inventory.csv").open("w",encoding="utf-8",newline="") as f:w=csv.DictWriter(f,fieldnames=list(inventory[0]));w.writeheader();w.writerows(inventory)
    with (a.out_dir/"grid_top100.csv").open("w",encoding="utf-8",newline="") as f:w=csv.DictWriter(f,fieldnames=list(configs[0]));w.writeheader();w.writerows(configs[:100])
    with (a.out_dir/"system_comparison.csv").open("w",encoding="utf-8",newline="") as f:w=csv.DictWriter(f,fieldnames=list(comparisons[0]));w.writeheader();w.writerows(comparisons)
    with (a.out_dir/"rolling_cutoff_validation.csv").open("w",encoding="utf-8",newline="") as f:w=csv.DictWriter(f,fieldnames=list(rolling[0]));w.writeheader();w.writerows(rolling)
    changed=[]
    for r in holdout:
        cp=candidate_probability(r,selected)
        if (cp>=.5)!=(r["current_p"]>=.5):
            changed.append({k:r.get(k) for k in detail_fields}|{"candidate_p":cp,"current_tip":"home" if r["current_p"]>=.5 else "away","candidate_tip":"home" if cp>=.5 else "away","winner":"home" if outcome(r)==1 else "away"})
    if changed:
        with (a.out_dir/"holdout_changed_tips.csv").open("w",encoding="utf-8",newline="") as f:w=csv.DictWriter(f,fieldnames=list(changed[0]));w.writeheader();w.writerows(changed)
    type_performance=[]
    for period,subset in (("all_1998_2025",finals),("holdout_2017_2025",holdout)):
        for kind in sorted({r["type"] for r in subset}):
            group=[r for r in subset if r["type"]==kind]
            for system,metric in (("current_plus40_legacy_travel",raw_current(group)),("selected_pre_2017",score(group,selected)),("selected_no_neutral_bonus",score(group,no_neutral_bonus))):
                type_performance.append({"period":period,"type":kind,"system":system,**metric})
    with (a.out_dir/"finals_type_performance.csv").open("w",encoding="utf-8",newline="") as f:w=csv.DictWriter(f,fieldnames=list(type_performance[0]));w.writeheader();w.writerows(type_performance)
    summary={"finals":comparison,"constrained_finals":{"no_neutral_bonus":no_neutral_bonus,"no_home_labels":no_home_labels},"regular_nonstandard_venues":regular_comparison}
    (a.out_dir/"summary.json").write_text(json.dumps(summary,indent=2)+"\n",encoding="utf-8");print(json.dumps(summary,indent=2))

if __name__=="__main__":main()
