import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here=path.dirname(fileURLToPath(import.meta.url));
const data=JSON.parse(fs.readFileSync(path.join(here,"data","historical-cache.json"),"utf8"));
const assert=(condition,message)=>{if(!condition)throw new Error(message)};
const perf2026=data.performance.find(r=>r.year===2026);
assert(data.meta.version==="2026-09-15-v1","unexpected cache version");
assert(data.matches.length===5824,"unexpected match count");
assert(perf2026.production.correct===130&&perf2026.production.games===204,"2026 production benchmark mismatch");
assert(perf2026.bstar.correct===130&&perf2026.bstar.games===204,"2026 B* benchmark mismatch");
assert(perf2026.candidate.correct===132&&perf2026.candidate.games===204,"2026 Gate 6 benchmark mismatch");
assert(perf2026.open.correct===129&&perf2026.open.games===202,"2026 opening benchmark mismatch");
assert(perf2026.close.correct===127&&perf2026.close.games===203,"2026 effective-close benchmark mismatch");
const souths=data.matches.find(r=>r.id===26399);
assert(souths?.rookieGate&&souths?.r2,"Round 27 Souths/Roosters gate flags missing");
assert(souths.closeHome===1.11&&souths.closeAway===6.5,"Round 27 closing pair mismatch");
const active2026=new Set(data.matches.filter(r=>r.year===2026&&/^Rd\s*\d+/i.test(r.round)).flatMap(r=>[r.home,r.away]));
assert(active2026.size===17,"2026 active-team count must be 17");
assert(data.currentMarkets.every(r=>r.bookmaker==="Sportsbet"&&r.lastHome&&r.lastAway),"current market must be complete Sportsbet pairs");
const historical=JSON.parse(fs.readFileSync(path.join(here,"data","historical-model-comparison.json"),"utf8"));
assert(historical.meta.startYear===2009&&historical.meta.initialRating===1500,"historical comparison start mismatch");
assert(historical.models.length===9&&historical.yearly.length===162,"historical comparison incomplete");
for(const entry of historical.ownYearly){
  const season=data.matches.filter(r=>r.year===entry.year&&r.hs!=null&&r.as!=null),perf=data.performance.find(r=>r.year===entry.year);
  assert(season.every(r=>r.actualForecastP!=null),`${entry.year} reconstructed probability missing`);
  const correct=season.filter(r=>r.hs===r.as||(r.actualForecastP>=.5)===(r.hs>r.as)).length;
  assert(correct===entry.correct&&season.length===entry.games,`${entry.year} reconstructed score mismatch`);
  assert(perf.actualForecast.status==="reconstructed"&&perf.actualForecast.correct===correct,`${entry.year} forecast provenance mismatch`);
}
assert(!data.performance.find(r=>r.year===2017).actualForecast,"2017 historical parameters unknown");
assert(perf2026.actualForecast.status==="observed"&&perf2026.actualForecast.correct===130,"observed forecast overwritten");
assert(historical.periods.find(r=>r.model==="candidate"&&r.period==="2009–2026").correct===2363,"common-start candidate benchmark mismatch");
console.log("Cache validation passed",{matches:data.matches.length,active2026:active2026.size,currentMarkets:data.currentMarkets.length});
