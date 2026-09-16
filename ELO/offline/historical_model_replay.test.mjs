import fs from "node:fs";
import assert from "node:assert/strict";
import {createReplayEngine} from "../shared/replay-engine.js";

const snapshot=new URL("./snapshots/prod-observed-2026-09-11/",import.meta.url);
const read=name=>JSON.parse(fs.readFileSync(new URL(name,snapshot),"utf8"));
const matches=read("matches.json").filter(r=>r.year>=2009&&r.home_score!=null&&r.away_score!=null).sort((a,b)=>a.year-b.year||a.match_index-b.match_index||a.game_num-b.game_num);
const source=new URL("./experiments/EXP-2026-031-recovered-historical-models/run-003/",import.meta.url);
const manifest=JSON.parse(fs.readFileSync(new URL("manifest.json",source),"utf8"));
const lines=fs.readFileSync(new URL("game_predictions.csv",source),"utf8").trim().split(/\r?\n/);
const headers=lines.shift().split(",");
const predictions=new Map(lines.map(line=>{
  const cells=line.split(",");
  // This export has no text fields containing commas. Reject instead of misparse.
  assert.equal(cells.length,headers.length,"unexpected quoted CSV field");
  const row=Object.fromEntries(headers.map((header,i)=>[header,cells[i]]));
  return [`${row.model}|${row.match_id}`,Number(row.home_probability)];
}));
let checked=0,maxDifference=0;
for(const id of ["production","browser2026","start2026"]){
  const config=manifest.models.find(r=>r.id===id);
  const engine=createReplayEngine({k:config.k,homeAdvantage:config.home,reversionWeight:config.weight,
    initialRating:1500,travelPer1000km:config.travel,restPerRound:config.rest,streakPts:config.streak,earlyBoost:config.early},read("teams.json"));
  for(const row of engine.replayMatches(matches,{applyByes:true}).rows){
    const expected=predictions.get(`${id}|${row.match.id}`);
    assert.ok(Number.isFinite(expected),"missing exported probability");
    const difference=Math.abs(row.out.expected-expected);
    assert.ok(difference<1e-12,`${id} match ${row.match.id}: ${difference}`);
    maxDifference=Math.max(maxDifference,difference);checked++;
  }
}
assert.equal(checked,10875);
console.log("Historical replay controls passed",{checked,maxDifference});
