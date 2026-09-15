import { createReplayEngine } from "../shared/replay-engine.js";
import { MODELS, ACTIVE_MODEL, API_URL, CACHE_VERSION, CURRENT_SEASON } from "./model-config.js";

const state={cache:null,current:[],historyPage:0,charts:{},ratings:null};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pct=v=>v==null?"—":`${(100*v).toFixed(1)}%`;
const money=v=>v==null?"—":`$${Number(v).toFixed(2)}`;
const roundNumber=r=>Number(String(r||"").match(/\d+/)?.[0]??999);
const isRegular=r=>/^Rd\s*\d+/i.test(String(r||""));
const logo=n=>`../logos/${String(n).toLowerCase().replace(/\./g,"").replace(/\s+/g,"-")}.png`;
const modelTip=r=>r.candidateP==null?null:(r.candidateP>=.5?r.home:r.away);
const actualWinner=r=>r.hs==null||r.as==null?null:r.hs===r.as?"Draw":r.hs>r.as?r.home:r.away;
const correct=(r,tip)=>{const w=actualWinner(r);return w==null?null:w==="Draw"?true:w===tip};
const sourceLabel=r=>r.explicitClose?"explicit close":r.closeSource==="oddsportal_survey_fallback"?"survey fallback":r.liveOdds?"latest recorded":"no market pair";
const noVig=(home,away)=>home&&away?(1/home)/((1/home)+(1/away)):null;

async function loadCache(){
  const res=await fetch(`data/historical-cache.json?v=${CACHE_VERSION}`);
  if(!res.ok)throw new Error(`Historical cache ${res.status}`);
  state.cache=await res.json();
  if(state.cache.meta.version!==CACHE_VERSION)console.warn("Cache/config version mismatch");
}

async function refreshCurrent(){
  const button=$("#refresh-current"); button.disabled=true; button.textContent="Refreshing…";
  const base=state.cache.matches.filter(r=>r.year===CURRENT_SEASON);
  try{
    const response=await fetch(`${API_URL}/api/matches?limit=20000`);
    if(!response.ok)throw new Error(`API ${response.status}`);
    const live=await response.json(), byId=new Map(base.map(r=>[Number(r.id),r])), marketByTeams=new Map((state.cache.currentMarkets||[]).map(r=>[`${r.home}|${r.away}`,r]));
    state.current=live.filter(r=>Number(r.year)===CURRENT_SEASON).map(m=>{
      const cached=byId.get(Number(m.id))||base.find(r=>r.home===m.home_team&&r.away===m.away_team&&String(r.round).replace("Finals Week","Finals Wk")===String(m.round));
      const pair=Number.isFinite(Number(m.home_odds))&&Number.isFinite(Number(m.away_odds));
      const observed=marketByTeams.get(`${m.home_team}|${m.away_team}`), liveHome=observed?.lastHome??(pair?Number(m.home_odds):null),liveAway=observed?.lastAway??(pair?Number(m.away_odds):null),liveP=noVig(liveHome,liveAway),openP=noVig(observed?.openingHome,observed?.openingAway),candidateP=cached?.candidateP??null;
      const marketFav=liveP==null?null:Math.max(liveP,1-liveP),marketTipHome=liveP==null?null:liveP>.5,modelTipHome=candidateP==null?null:candidateP>=.5;
      return {...cached,id:Number(m.id),year:Number(m.year),round:m.round,matchIndex:Number(m.match_index),game:Number(m.game_num),home:m.home_team,away:m.away_team,hs:m.home_score==null?null:Number(m.home_score),as:m.away_score==null?null:Number(m.away_score),venue:m.venue_name||cached?.venue||null,liveOdds:liveHome!=null&&liveAway!=null,liveHome,liveAway,liveBookmaker:observed?.bookmaker||(pair?"unverified API pair":null),liveObservedAt:observed?.lastObservedAt||null,r1:cached?.r1||(candidateP!=null&&candidateP>=.45&&candidateP<=.55&&marketFav>=.60&&marketTipHome!==modelTipHome),r2:cached?.r2||(candidateP!=null&&marketFav>=.65&&marketTipHome!==modelTipHome),r3:cached?.r3||(openP!=null&&liveP!=null&&Math.abs(liveP-openP)>=.10)};
    });
    $("#current-updated").textContent=`Live data checked ${new Date().toLocaleString("en-AU")}`;
  }catch(error){
    state.current=base;
    $("#current-updated").textContent="Showing frozen cache";
    showNotice(`The live API could not be reached. The ${state.cache.meta.cutoff} cache is displayed.`,"warning");
  }finally{button.disabled=false;button.textContent="Refresh current season"}
  renderCurrent();
}

function showNotice(message){const el=$("#global-message");el.textContent=message;el.classList.remove("hidden")}
function metric(rows,selector){const values=rows.map(selector).filter(v=>v!==null);return {correct:values.filter(Boolean).length,games:values.length}}
function scoreCard(label,value,note){return `<div class="scorecard"><small>${esc(label)}</small><strong>${esc(value)}</strong><em>${esc(note)}</em></div>`}

function renderCurrent(){
  const completed=state.current.filter(r=>r.hs!=null&&r.as!=null), candidate=metric(completed,r=>correct(r,modelTip(r)));
  const gates=state.current.filter(r=>r.rookieGate).length, market=state.current.filter(r=>r.r1||r.r2||r.r3).length;
  const marginRows=completed.filter(r=>r.game===1&&isRegular(r.round)&&r.stableMargin!=null);
  const exact=marginRows.filter(r=>{const signed=(r.candidateP>=.5?1:-1)*Math.abs(r.stableMargin);return signed===r.hs-r.as}).length;
  $("#season-scorecards").innerHTML=[scoreCard("Candidate tips",candidate.games?`${candidate.correct} / ${candidate.games}`:"—",candidate.games?pct(candidate.correct/candidate.games):"Awaiting evaluated predictions"),scoreCard("Rookie gate",gates,"large lineup adjustments"),scoreCard("Market flags",market,"R1 / R2 / R3 review signals"),scoreCard("Margin bullseyes",`${exact} / ${marginRows.length}`,"first match of each round")].join("");
  const rows=[...state.current].sort((a,b)=>b.matchIndex-a.matchIndex);
  $("#current-table").innerHTML=`<thead><tr><th>Round</th><th>Home</th><th>Away</th><th>Model</th><th>Tip</th><th>Margin</th><th>Market pair</th><th>Flags</th><th>Result</th></tr></thead><tbody>${rows.map(r=>{
    const tip=modelTip(r), win=actualWinner(r), margin=r.stableMargin??r.generalMargin;
    const marketHome=r.liveOdds?r.liveHome:r.closeHome,marketAway=r.liveOdds?r.liveAway:r.closeAway;
    const flags=[r.rookieGate?'<span class="badge rookie">ROOKIE GATE</span>':"",r.r1?'<span class="badge market">R1 COIN FLIP</span>':"",r.r2?'<span class="badge market">R2 VETO</span>':"",r.r3?'<span class="badge shadow">R3 MOVE</span>':""].filter(Boolean).join("")||'<span class="muted">—</span>';
    const result=win==null?"Upcoming":`${r.hs}–${r.as}${correct(r,tip)?" ✓":" ✕"}`;
    return `<tr><td>${esc(r.round)}</td><td class="team ${win===r.home?'winner':''}">${esc(r.home)}</td><td class="team ${win===r.away?'winner':''}">${esc(r.away)}</td><td class="prob">${pct(r.candidateP)} home</td><td class="team">${esc(tip||"No candidate output")}</td><td>${margin==null?"—":`${esc(tip)} by ${Math.abs(margin)}`}</td><td>${money(marketHome)} / ${money(marketAway)}<br><small class="muted">${esc(r.liveOdds?`${r.liveBookmaker||"latest recorded"}${r.liveObservedAt?` · ${new Date(r.liveObservedAt).toLocaleString("en-AU")}`:""}`:sourceLabel(r))}</small></td><td>${flags}</td><td>${result}</td></tr>`
  }).join("")}</tbody>`;
}

function populateSelectors(){
  const years=[...new Set(state.cache.matches.map(r=>r.year))].sort((a,b)=>b-a);
  for(const id of ["#ladder-year","#history-year"]){$(id).innerHTML=years.map(y=>`<option>${y}</option>`).join("");$(id).value=String(CURRENT_SEASON)}
  $("#joker-year").innerHTML=Object.keys(state.cache.joker).sort((a,b)=>b-a).map(y=>`<option>${y}</option>`).join("");
  const teams=[...new Set(state.cache.matches.flatMap(r=>[r.home,r.away]))].sort();
  $("#history-team").innerHTML='<option value="">All teams</option>'+teams.map(t=>`<option>${esc(t)}</option>`).join("");
  $("#ratings-teams").innerHTML=teams.map(t=>`<option ${["Brisbane Broncos","Melbourne Storm","Penrith Panthers"].includes(t)?"selected":""}>${esc(t)}</option>`).join("");
  $("#ratings-from").innerHTML=years.slice().reverse().map(y=>`<option>${y}</option>`).join("");$("#ratings-from").value="1998";
  updateLadderRounds(); renderHistory(); renderJoker();
}

function seasonMatches(year){return state.cache.matches.filter(r=>r.year===Number(year))}
function updateLadderRounds(){const year=Number($("#ladder-year").value),rounds=[...new Set(seasonMatches(year).filter(r=>isRegular(r.round)).map(r=>r.round))].sort((a,b)=>roundNumber(a)-roundNumber(b));$("#ladder-round").innerHTML=rounds.map(r=>`<option>${esc(r)}</option>`).join("");$("#ladder-round").value=rounds.at(-1)||"";renderLadder()}
function computeLadder(year,through){
  const rows=seasonMatches(year).filter(r=>isRegular(r.round)&&roundNumber(r.round)<=roundNumber(through));
  const active=[...new Set(seasonMatches(year).filter(r=>isRegular(r.round)).flatMap(r=>[r.home,r.away]))], table=Object.fromEntries(active.map(t=>[t,{team:t,points:0,for:0,against:0}]));
  for(const round of [...new Set(rows.map(r=>r.round))].sort((a,b)=>roundNumber(a)-roundNumber(b))){const games=rows.filter(r=>r.round===round),played=new Set(games.flatMap(r=>[r.home,r.away]));for(const r of games){if(r.hs==null||r.as==null)continue;const h=table[r.home],a=table[r.away];h.for+=r.hs;h.against+=r.as;a.for+=r.as;a.against+=r.hs;if(r.hs>r.as)h.points+=2;else if(r.as>r.hs)a.points+=2;else{h.points++;a.points++}}for(const t of active)if(!played.has(t))table[t].points+=2}
  return Object.values(table).map(r=>({...r,diff:r.for-r.against})).sort((a,b)=>b.points-a.points||b.diff-a.diff||b.for-a.for);
}
function ratingsAt(year,round){
  const matches=state.cache.matches.map(r=>({year:r.year,round:r.round,match_index:r.matchIndex,home_team:r.home,away_team:r.away,home_score:r.hs,away_score:r.as}));
  const teams=[...new Set(matches.flatMap(r=>[r.home_team,r.away_team]))].map(name=>({name}));
  const p=MODELS.production2026.parameters,engine=createReplayEngine(p,teams),replay=engine.replayMatches(matches,{applyByes:false,stopAt:{year,round}});return replay.state.ratings;
}
function renderLadder(){const year=Number($("#ladder-year").value),round=$("#ladder-round").value,rows=computeLadder(year,round),ratings=ratingsAt(year,round);$("#ladder-table").innerHTML=`<thead><tr><th>#</th><th>Team</th><th>Pts</th><th>For</th><th>Against</th><th>Diff</th><th>Elo</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td class="team"><img src="${logo(r.team)}" width="18" height="18" alt="" onerror="this.style.display='none'"> ${esc(r.team)}</td><td><b>${r.points}</b></td><td>${r.for}</td><td>${r.against}</td><td>${r.diff>0?"+":""}${r.diff}</td><td>${Math.round(ratings[r.team]??1500)}</td></tr>`).join("")}</tbody>`}

function renderHistory(){
  const year=Number($("#history-year").value),team=$("#history-team").value,q=$("#history-search").value.toLowerCase();let rows=seasonMatches(year).filter(r=>(!team||r.home===team||r.away===team)&&(!q||`${r.round} ${r.venue}`.toLowerCase().includes(q))).sort((a,b)=>b.matchIndex-a.matchIndex);
  const size=100,pages=Math.max(1,Math.ceil(rows.length/size));state.historyPage=Math.min(state.historyPage,pages-1);const page=rows.slice(state.historyPage*size,(state.historyPage+1)*size);
  $("#history-cache-note").innerHTML=`Cache <b>${esc(state.cache.meta.version)}</b> · ${rows.length} matching games · Historical odds show ${esc(state.cache.meta.odds)}`;
  $("#history-table").innerHTML=`<thead><tr><th>Round</th><th>Home</th><th>Away</th><th>Score</th><th>Candidate</th><th>Underlying margin</th><th>Closing pair</th><th>Source / flags</th></tr></thead><tbody>${page.map(r=>`<tr><td>${esc(r.round)}</td><td class="team">${esc(r.home)}</td><td class="team">${esc(r.away)}</td><td>${r.hs==null?"—":`${r.hs}–${r.as}`}</td><td>${pct(r.candidateP)}</td><td>${r.candidateDr==null?"—":(0.048406*r.candidateDr).toFixed(1)}</td><td>${money(r.closeHome)} / ${money(r.closeAway)}</td><td>${esc(sourceLabel(r))} ${r.rookieGate?'<span class="badge rookie">G6</span>':""} ${r.r2?'<span class="badge market">R2</span>':""}</td></tr>`).join("")}</tbody>`;
  $("#history-page").textContent=`Page ${state.historyPage+1} of ${pages}`;$("#history-prev").disabled=state.historyPage===0;$("#history-next").disabled=state.historyPage>=pages-1;
}

function renderAccuracy(){const which=$("#performance-model").value;$("#accuracy-table").innerHTML=`<thead><tr><th>Season</th><th>Model used</th><th>Expected</th><th>Actual forecast</th><th>Selected replay</th><th>Ladder</th><th>Opening</th><th>Effective close</th><th>Margin exact</th><th>Margin error</th></tr></thead><tbody>${state.cache.performance.map(r=>{const selected=r[which],fmt=m=>m?.games?`${m.correct}/${m.games} (${pct(m.correct/m.games)})`:"—";return `<tr><td><b>${r.year}</b></td><td>${r.year===2026?"2026 production":"Not archived"}</td><td>${r.expected?pct(r.expected):"—"}</td><td>${fmt(r.actualForecast)}</td><td>${fmt(selected)}</td><td>${fmt(r.ladder)}</td><td>${fmt(r.open)}</td><td>${fmt(r.close)}</td><td>${r.margin.games?`${r.margin.exact}/${r.margin.games}`:"—"}</td><td>${r.margin.games?r.margin.error:"—"}</td></tr>`}).join("")}</tbody>`;renderCharts(which)}
function destroyChart(name){state.charts[name]?.destroy();state.charts[name]=null}
function renderCharts(which){
  const years=state.cache.performance.map(r=>r.year).slice(-5),rows=state.cache.matches.filter(r=>years.includes(r.year)&&r.hs!=null&&r.as!=null);destroyChart("calibration");destroyChart("margin");
  const colors=[.18,.28,.4,.58,1];const datasets=years.map((year,i)=>{const bins=Array.from({length:10},()=>({n:0,w:0}));rows.filter(r=>r.year===year).forEach(r=>{const p=which==="production"?r.productionP:which==="bstar"?r.bstarP:r.candidateP;if(p==null)return;const b=Math.min(9,Math.floor(p*10));bins[b].n++;bins[b].w+=r.hs===r.as?.5:r.hs>r.as?1:0});return {label:String(year),data:bins.map((b,j)=>({x:j*10+5,y:b.n?100*b.w/b.n:null})),borderColor:`rgba(35,106,75,${colors[i]})`,backgroundColor:`rgba(35,106,75,${colors[i]})`,borderWidth:i===years.length-1?3:2,tension:.25,spanGaps:true}});
  state.charts.calibration=new Chart($("#calibration-chart"),{type:"line",data:{datasets:[{label:"Perfect calibration",data:[{x:0,y:0},{x:100,y:100}],borderColor:"#aeb5af",borderDash:[5,5],pointRadius:0},...datasets]},options:{responsive:true,scales:{x:{type:"linear",min:0,max:100,title:{display:true,text:"Predicted home win %"}},y:{min:0,max:100,title:{display:true,text:"Observed home win %"}}}}});
  const current=rows.filter(r=>r.year===CURRENT_SEASON&&r.candidateDr!=null);state.charts.margin=new Chart($("#margin-chart"),{type:"scatter",data:{datasets:[{label:String(CURRENT_SEASON),data:current.map(r=>({x:.048406*r.candidateDr,y:r.hs-r.as})),backgroundColor:"rgba(35,106,75,.48)",pointRadius:3},{label:"Perfect",type:"line",data:[{x:-50,y:-50},{x:50,y:50}],borderColor:"#bd852d",pointRadius:0}]},options:{responsive:true,scales:{x:{title:{display:true,text:"Underlying predicted home margin"}},y:{title:{display:true,text:"Actual home margin"}}}}})
}

function renderJoker(){const year=$("#joker-year").value,data=state.cache.joker[year];if(!data)return;$("#joker-summary").innerHTML=`Frozen with <b>${esc(data.model)}</b>. Selected rounds: <b>${data.selected.map(esc).join(", ")}</b>.`;$("#joker-table").innerHTML=`<thead><tr><th>Round</th><th>10%</th><th>15%</th><th>20%</th><th>25%</th><th>30%</th><th>Elo EV</th><th>Broncos EV</th><th>Actual</th><th>Games</th></tr></thead><tbody>${data.rows.map(r=>`<tr ${r.selected?'style="background:#fff4d8"':''}><td><b>${esc(r.round)}</b>${r.selected?' <span class="badge market">SELECTED</span>':''}</td><td>${r.c10}</td><td>${r.c15}</td><td>${r.c20}</td><td>${r.c25}</td><td>${r.c30}</td><td>${r.eloEv.toFixed(2)}</td><td>${r.broncosEv.toFixed(2)}</td><td>${r.actual}</td><td>${r.games}</td></tr>`).join("")}</tbody>`}

function renderModel(){const p=ACTIVE_MODEL.parameters;$("#model-content").innerHTML=`
  <article class="model-card"><h2>B* core Elo</h2><div class="parameter-grid">${Object.entries(p).slice(0,10).map(([k,v])=>`<span>${esc(k)}</span><span>${esc(v)}</span>`).join("")}</div><h3>Pre-match strength</h3><div class="formula">actualRestAdj = 5 × (homeRestDays − awayRestDays) / 7\n\nDR_B* = (Rhome − Raway) + 40\n      + 15 × awayTravelKm / 1000\n      + actualRestAdj\n      + 2.15 × (homeStreak − awayStreak)\n\nP(home) = 1 / (1 + 10^(−DR_B* / 400))</div></article>
  <article class="model-card"><h2>Rookie Gate 6</h2><p>A prediction-only lineup adjustment. It does not flow into the zero-sum Elo ledger.</p><div class="formula">raw = β₀ × Δdebutants\n    + β₅ × Δunder5\n    + β₂₀ × Δunder20\n\nlineupMargin = clamp(raw, −18, +18)\napply only when |lineupMargin| ≥ 6\n\nDR_candidate = DR_B* + lineupMargin / 0.048406</div><p class="muted">Eight-year prior-only fit · ridge 300 · nested player counts. Non-NRL senior experience remains a deployment prerequisite.</p></article>
  <article class="model-card"><h2>Stable discrete margin</h2><p>The submitted margin is selected separately from winner probability.</p><div class="formula">x = |0.048406 × Gate6_DR|\nwⱼ = exp(−0.5 × ((xⱼ − x) / 1.5)²)\n   × 2^(−gamesAgo / 1000)\n\nchoose even a ∈ {2,4,…,32}\nminimising weighted mean |actual aligned margin − a|</div></article>
  <article class="model-card"><h2>Market rules</h2><p><b>Odds never enter Elo.</b> One paired market observation is converted to no-vig probability and used only in the tipping layer.</p><div class="formula">pH = (1 / home $) / ((1 / home $) + (1 / away $))\n\nR1: model 45–55% and market favourite ≥60%\nR2: explicit paired checkpoint favourite ≥65% disagrees\nR3: probability moves ≥10 percentage points</div><p class="muted">Historical display: explicit single-book close where available, otherwise a labelled OddsPortal survey fallback. R2 never fires from the fallback.</p></article>
  <article class="model-card wide"><h2>Version boundary</h2><p><b>${esc(ACTIVE_MODEL.id)}</b> is a preview candidate. The production 2026 formula remains available as a control and has not been altered. Historical ratings are reconstructed under a named core method; historical forecast claims require an archived prediction.</p></article>`}

function csvEscape(v){return `"${String(v??"").replace(/"/g,'""')}"`}
function downloadDiagnostic(){const candidate=$("#diagnostic-model").value==="candidate";if(!candidate){window.open(`${API_URL}/api/diagnostic`,"_blank","noopener");return}const rows=state.cache.matches,headers=["id","year","round","home","away","home_score","away_score","bstar_probability","candidate_probability","candidate_dr","underlying_margin","lineup_margin","rookie_gate","open_home_$","open_away_$","close_home_$","close_away_$","close_source","R1","R2","R3","stable_margin","refined_shadow_margin"];
  const body=rows.map(r=>[r.id,r.year,r.round,r.home,r.away,r.hs,r.as,r.bstarP,r.candidateP,r.candidateDr,r.candidateDr==null?null:.048406*r.candidateDr,r.lineupMargin,r.rookieGate,r.openHome,r.openAway,r.closeHome,r.closeAway,r.closeSource,r.r1,r.r2,r.r3,r.stableMargin,r.refinedMargin]);
  const blob=new Blob([[headers,...body].map(row=>row.map(csvEscape).join(",")).join("\r\n")],{type:"text/csv"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`nrl-elo-${candidate?'2027-candidate':'2026-production'}-diagnostic.csv`;a.click();URL.revokeObjectURL(a.href)}

function buildRatingSeries(){if(state.ratings)return state.ratings;const matches=state.cache.matches.map(r=>({year:r.year,round:r.round,match_index:r.matchIndex,home_team:r.home,away_team:r.away,home_score:r.hs,away_score:r.as})),teams=[...new Set(matches.flatMap(r=>[r.home_team,r.away_team]))].map(name=>({name})),engine=createReplayEngine(MODELS.production2026.parameters,teams),replay=engine.replayMatches(matches,{applyByes:false}),series={};for(const r of replay.rows){if(!r.out.updated)continue;const label=`${r.match.year} ${r.match.round}`;for(const team of [r.match.home_team,r.match.away_team]){series[team]??=[];series[team].push({x:r.match.match_index+1000*r.match.year,y:r.out[team===r.match.home_team?"newHomeElo":"newAwayElo"],label,year:r.match.year})}}state.ratings=series;return series}
function renderRatings(){const selected=[...$("#ratings-teams").selectedOptions].map(o=>o.value).slice(0,8),from=Number($("#ratings-from").value),series=buildRatingSeries(),palette=["#236a4b","#ae3e3e","#285a78","#bd852d","#68447d","#555","#cf6a3d","#1296a5"];destroyChart("ratings");state.charts.ratings=new Chart($("#ratings-chart"),{type:"line",data:{datasets:selected.map((team,i)=>({label:team,data:(series[team]||[]).filter(p=>p.year>=from),parsing:false,borderColor:palette[i],pointRadius:0,borderWidth:2,tension:.12}))},options:{responsive:true,interaction:{mode:"nearest",intersect:false},scales:{x:{type:"linear",ticks:{callback:value=>Math.floor(value/1000)}},y:{title:{display:true,text:"Elo rating"}}},plugins:{tooltip:{callbacks:{title:items=>items[0]?.raw?.label||""}}}}})}

function activate(tab){$$('[data-tab]').forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));$$('.tab-panel').forEach(p=>p.classList.toggle("active",p.id===`tab-${tab}`));history.replaceState(null,"",`#${tab}`);if(tab==="performance")renderAccuracy();if(tab==="ratings")renderRatings();if(tab==="ladder")renderLadder()}
function wire(){$$('[data-tab]').forEach(b=>b.addEventListener("click",()=>activate(b.dataset.tab)));$("#refresh-current").addEventListener("click",refreshCurrent);$("#ladder-year").addEventListener("change",updateLadderRounds);$("#ladder-round").addEventListener("change",renderLadder);for(const id of ["#history-year","#history-team","#history-search"]){$(id).addEventListener("input",()=>{state.historyPage=0;renderHistory()})}$("#history-prev").addEventListener("click",()=>{state.historyPage--;renderHistory()});$("#history-next").addEventListener("click",()=>{state.historyPage++;renderHistory()});$("#performance-model").addEventListener("change",renderAccuracy);$("#joker-year").addEventListener("change",renderJoker);$("#diagnostic-model").addEventListener("change",()=>{});$("#download-diagnostic").addEventListener("click",downloadDiagnostic);$("#ratings-teams").addEventListener("change",renderRatings);$("#ratings-from").addEventListener("change",renderRatings)}

async function init(){try{await loadCache();$("#model-chip-label").textContent=ACTIVE_MODEL.label;$("#current-season-label").textContent=CURRENT_SEASON;populateSelectors();renderModel();wire();await refreshCurrent();activate(location.hash.slice(1)||"season")}catch(error){console.error(error);showNotice(`Preview failed to initialise: ${error.message}`)}}
init();
