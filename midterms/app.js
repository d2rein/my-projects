const $ = selector => document.querySelector(selector);
const APP_BASE = new URL(".", import.meta.url);
const els = {
  asOf: $("#as-of"), board: $("#seat-board"), title: $("#board-title"), odds: $("#control-odds"), label: $("#control-label"),
  source: $("#headline-source"), projected: $("#projected-seats"), balance: $("#balance-dem"), threshold: $("#balance-threshold"), majority: $("#majority-note"),
  marketOdds: $("#market-odds"), marketLink: $("#market-link"), genericNow: $("#generic-now"), approvalNow: $("#approval-now"), feed: $("#change-feed"), ledger: $("#source-ledger"), dialog: $("#race-dialog")
};
let data, manual, chamber = "house", snapshots = [];
const snapshotDay = snapshot => snapshot.snapshotDate || snapshot.asOf;

const pct = value => `${Math.round(value * 100)}%`;
const lastName = name => (name || "—").trim().split(/\s+/).at(-1);
const margin = value => value == null ? "—" : value === 0 ? "Even" : `${value > 0 ? "D" : "R"}+${Math.abs(value).toFixed(1)}`;
const ratingClass = chance => { const p = Math.max(chance, 1 - chance); return p < .55 ? "toss" : p < .7 ? "lean" : p < .9 ? "likely" : "safe"; };
const side = chance => chance >= .5 ? "d" : "r";
const link = (href, label) => `<a class="source-link" href="${href}" target="_blank" rel="noreferrer">${label} ↗</a>`;
const money = value => value == null ? "—" : new Intl.NumberFormat("en-US", { notation:"compact", style:"currency", currency:"USD", maximumFractionDigits:1 }).format(value);

async function fetchJson(url) {
  const response = await fetch(new URL(url, APP_BASE), { cache: "no-store" });
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !contentType.includes("application/json")) {
    throw new Error(`Expected JSON from ${url}, received ${response.status} ${contentType || "unknown content type"}`);
  }
  return response.json();
}

async function load() {
  try {
    [data, manual] = await Promise.all([fetchJson("data/current.json"), fetchJson("data/manual-sources.json")]);
    snapshots = await discoverSnapshots();
    els.asOf.textContent = `Forecast ${data.asOf} · cached ${new Date(data.fetchedAt).toLocaleString()}`;
    bind(); renderAll();
  } catch (error) {
    document.body.innerHTML = `<div class="error"><h2>Dashboard data is unavailable</h2><p>Please reload the page. If the problem persists, the cached data may need to be refreshed.</p><pre>${error.message}</pre></div>`;
  }
}

async function discoverSnapshots() {
  let candidates = [];
  try {
    const index = await fetchJson("data/snapshots/index.json");
    candidates = index.dates.slice(-15);
  } catch {
    const date = new Date(`${snapshotDay(data)}T12:00:00Z`);
    candidates.push(snapshotDay(data));
    for (let i = 1; i <= 14; i++) { const d = new Date(date); d.setUTCDate(d.getUTCDate() - i); candidates.push(d.toISOString().slice(0,10)); }
  }
  const found = await Promise.all(candidates.map(async day => {
    try {
      const response = await fetch(new URL(`data/snapshots/${day}.json`, APP_BASE), { cache: "no-store" });
      const contentType = response.headers.get("content-type") || "";
      if (!response.ok || !contentType.includes("application/json")) return null;
      return await response.json();
    } catch {
      return null;
    }
  }));
  return found.filter(Boolean).sort((a,b) => snapshotDay(a).localeCompare(snapshotDay(b)));
}

function raceMovement(race) {
  if (race.notUp) return null;
  const currentDay = snapshotDay(data);
  const prior = [...snapshots].reverse().find(snapshot => snapshotDay(snapshot) < currentDay && snapshot.headline?.source === data.headline?.source);
  const previousRace = prior?.[chamber]?.find(row => row.key === race.key);
  if (!previousRace) return null;
  const delta = (race.chance - previousRace.chance_left) * 100;
  return Math.abs(delta) < .05 ? null : { delta, day: snapshotDay(prior) };
}

function bind() {
  document.querySelectorAll(".tab").forEach(button => button.addEventListener("click", () => {
    chamber = button.dataset.chamber;
    document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b === button));
    renderAll();
  }));
  $("#drawer-close").addEventListener("click", () => els.dialog.close());
  els.dialog.addEventListener("click", event => { if (event.target === els.dialog) els.dialog.close(); });
  $("#competitive-only").addEventListener("click", event => { event.currentTarget.classList.toggle("active"); renderFeed(event.currentTarget.classList.contains("active")); });
}

function racesFor(ch) {
  if (ch === "house") return data.house.map(r => ({...r, displayKey:r.key, chance:r.chance_left}));
  const contests = data.senate.map(r => ({...r, displayKey:r.key, chance:r.chance_left}));
  const holds = data.senateHolds.map(r => ({...r, displayKey:r.state, left_candidate:r.caucus === "D" ? r.senator : null, rep_candidate:r.caucus === "R" ? r.senator : null, held_by:r.caucus, winner:r.caucus, rating:"Not up", chance:r.chance_left}));
  return [...contests, ...holds];
}

function renderAll() { renderTopline(); renderBoard(); renderTrends(); renderFeed(false); renderLedger(); }

function renderTopline() {
  const h = manual.headlineOverride || data.headline;
  const isHouse = chamber === "house";
  const odds = isHouse ? h.houseDemControl : h.senateDemControl;
  const demSeats = isHouse ? h.houseDemSeats : h.senateDemSeats;
  const total = isHouse ? 435 : 100;
  els.odds.textContent = odds == null ? "—" : `${odds}%`;
  els.label.textContent = "chance of Democratic control";
  const headlineUrl = isHouse ? h.sourceUrl : (h.senateSourceUrl || h.sourceUrl);
  els.source.innerHTML = `Headline · <a href="${headlineUrl}" target="_blank" rel="noreferrer">${h.source}</a>${h.asOf ? ` · ${h.asOf}` : ""}`;
  els.projected.textContent = demSeats == null ? "—" : `${demSeats}–${total-demSeats}`;
  els.balance.style.width = `${(demSeats ?? total/2)/total*100}%`;
  els.threshold.style.left = `${(isHouse ? 218/435 : 51/100)*100}%`;
  els.majority.textContent = isHouse ? "218 seats for a House majority" : "51 seats for outright Senate control; Republicans win a 50–50 tie via the vice president";
  const market = data.polymarket?.chambers?.[chamber];
  els.marketOdds.textContent = market?.currentDem == null ? "not cached" : pct(market.currentDem);
  els.marketLink.href = market?.url || "https://polymarket.com/";
  drawChart("#market-chart", marketSeries(market), { compact:true, domain:[0,1], ticks:[0,.5,1], reference:.5, percent:true });
}

function renderBoard() {
  const races = racesFor(chamber).sort((a,b) => b.chance - a.chance || a.displayKey.localeCompare(b.displayKey));
  const thresholdAfter = chamber === "house" ? 218 : 50;
  els.title.textContent = chamber === "house" ? "House seats" : "Senate seats, including 65 not up";
  els.board.innerHTML = "";
  races.forEach((race, index) => {
    const button = document.createElement("button");
    const pickup = !race.notUp && race.winner && race.held_by && race.winner !== race.held_by;
    const s = side(race.chance);
    button.className = `seat ${s} ${ratingClass(race.chance)} ${pickup ? "pickup" : ""} ${race.notUp ? "locked" : ""}`;
    const favorite = s === "d" ? race.left_candidate : race.rep_candidate;
    const underdog = s === "d" ? race.rep_candidate : race.left_candidate;
    const movement = raceMovement(race);
    const movementLabel = movement ? `${movement.delta > 0 ? "+" : "−"}${Math.abs(movement.delta).toFixed(Math.abs(movement.delta) < 1 ? 1 : 0)}` : "";
    button.innerHTML = `<span class="seat-top"><span>${race.displayKey}</span><span class="seat-prob"><span>${race.notUp ? "HOLD" : pct(Math.max(race.chance,1-race.chance))}</span>${movement ? `<span class="seat-move ${movement.delta > 0 ? "up" : "down"}">${movementLabel}</span>` : ""}</span></span><span class="seat-names">${lastName(favorite)} · ${lastName(underdog)}</span><span class="seat-rating">${race.notUp ? race.party : race.rating}</span>`;
    button.title = `${race.name}: ${race.notUp ? `${race.senator}, not up` : `${race.left_candidate} vs ${race.rep_candidate}; ${pct(race.chance)} D${movement ? `; D chance ${movement.delta > 0 ? "+" : ""}${movement.delta.toFixed(1)} points since ${movement.day}` : ""}`}`;
    button.addEventListener("click", () => openRace(race));
    els.board.append(button);
    if (index + 1 === thresholdAfter) {
      const marker = document.createElement("div"); marker.className = "threshold";
      marker.textContent = chamber === "house" ? "218-seat majority line" : "50 seats · next seat gives outright control";
      els.board.append(marker);
    }
  });
}

function openRace(race) {
  $("#drawer-kind").textContent = race.notUp ? `Senate · Class ${race.class} · not up in 2026` : `${race.kind} · ${race.rating}`;
  $("#drawer-title").textContent = race.name;
  const ratings = manual.raceRatings[race.key] || {};
  if (race.notUp) {
    $("#drawer-content").innerHTML = `<div class="race-odds"><div class="candidate ${race.caucus.toLowerCase()}"><strong>${race.senator}</strong><span>${race.party} · current seat</span></div></div><p>This seat is not on the 2026 ballot and is treated as a locked hold, not a probabilistic forecast.</p>${link(race.source_url,"Senator source")}`;
  } else {
    const market = data.polymarket?.races?.[race.key];
    const publicRatings = data.ratings?.raceRatings?.[race.key] || [];
    const ratingRows = [
      [race.model_source || "FiftyPlusOne",race.rating,race.model_source_url],
      ...(race.polling_forecast_chance == null ? [] : [["Polling Forecast",`${pct(race.polling_forecast_chance)} D`, `https://www.pollingforecast.com${race.page}`]]),
      ...(market?.currentDem == null ? [] : [["Polymarket",`${pct(market.currentDem)} D`,market.url]]),
      ...publicRatings.map(row => [row.source,row.rating,row.url]),
      ...Object.entries(ratings).map(([source,value]) => [source, typeof value === "string" ? value : value.rating, typeof value === "string" ? null : value.url])
    ];
    const changes = (data.ratings?.rcpSenateChanges || []).filter(row => row.key === race.key);
    const marketBlock = `<section class="drawer-section"><div class="drawer-section-head"><div><p class="kicker">Prediction market</p><h3>Polymarket trend</h3></div><strong>${market?.currentDem == null ? "not matched" : `${pct(market.currentDem)} D`}</strong></div>${market ? `<svg id="race-market-chart" class="drawer-chart" viewBox="0 0 520 132" role="img" aria-label="Polymarket Democratic win-price history"></svg><p class="board-note">${money(market.volume)} event volume · ${market.outcomes.map(row=>`${row.candidate} ${pct(row.current)}`).join(" · ")}</p>${link(market.url,"Open market")}` : `<p class="board-note">No confidently matched public market was cached for this race.</p>`}</section>`;
    const historyBlock = changes.length ? `<section class="drawer-section"><p class="kicker">RCP rating history</p><div class="mini-history">${changes.map(row=>`<a href="${row.url}" target="_blank" rel="noreferrer"><time>${row.date.slice(5)}</time><span>${row.previous} → ${row.rating}</span></a>`).join("")}</div></section>` : "";
    $("#drawer-content").innerHTML = `<div class="race-odds"><div class="candidate d"><strong>${pct(race.chance)}</strong>${race.left_candidate}<span>${race.left_party || "D"} win probability · ${race.model_source || "FiftyPlusOne"}</span></div><div class="candidate r"><strong>${pct(1-race.chance)}</strong>${race.rep_candidate}<span>R win probability · ${race.model_source || "FiftyPlusOne"}</span></div></div><div class="detail-grid"><div class="datum"><small>50+1 projected margin</small><b>${margin(race.best_bet_margin)}</b></div><div class="datum"><small>50+1 80% range</small><b>${margin(race.range80_low)} to ${margin(race.range80_high)}</b></div><div class="datum"><small>Polling average · metadata feed</small><b>${race.poll_average == null ? "No polls" : margin(race.poll_average)}</b></div><div class="datum"><small>Polls used · metadata feed</small><b>${race.polls_used ?? 0}</b></div><div class="datum"><small>Seat held by</small><b>${race.held_by}</b></div><div class="datum"><small>2024 presidential</small><b>${margin(race.pres2024_margin)}</b></div></div>${race.source_note ? `<p class="board-note">${race.source_note}</p>` : ""}<table class="ratings-table"><thead><tr><th>Source</th><th>Rating / odds</th><th></th></tr></thead><tbody>${ratingRows.map(([s,r,u])=>`<tr><td>${s}</td><td>${r || "—"}</td><td>${u ? `<a href="${u}" target="_blank" rel="noreferrer">source</a>` : "local entry"}</td></tr>`).join("")}</tbody></table>${marketBlock}${historyBlock}${link(race.model_source_url || `https://www.pollingforecast.com${race.page}`,"Primary race forecast")}${link(`https://www.pollingforecast.com${race.page}`,"Metadata and poll list")}`;
    if (market) drawChart($("#race-market-chart"), marketSeries(market, race.key), { domain:[0,1], ticks:[0,.5,1], reference:.5, percent:true });
  }
  els.dialog.showModal();
}

function marketSeries(market, raceKey) {
  const byDay = new Map();
  (market?.history || []).forEach(row => byDay.set(new Date(row.t*1000).toISOString().slice(0,10), { date:new Date(row.t*1000).toISOString().slice(0,10), v:row.p }));
  if (raceKey) snapshots.forEach(snapshot => { const value=snapshot.polymarket?.races?.[raceKey]?.currentDem, date=snapshotDay(snapshot); if(value!=null) byDay.set(date,{date,v:value}); });
  if (market?.currentDem != null) byDay.set(snapshotDay(data),{date:snapshotDay(data),v:market.currentDem});
  return [...byDay.values()].sort((a,b)=>a.date.localeCompare(b.date));
}

function chartFrame(svg, series, options={}) {
  const [, , W=560, H=140] = (svg.getAttribute("viewBox") || "0 0 560 140").split(/\s+/).map(Number);
  const compact=!!options.compact, L=compact?25:36, R=8, T=compact?6:18, B=compact?14:20;
  const [min,max]=options.domain || [0,1], span=max-min||1;
  const all=series.flat(), times=all.map(d=>new Date(`${d.date}T00:00:00Z`).getTime()), start=Math.min(...times), end=Math.max(...times);
  const x=d=>L+(new Date(`${d.date}T00:00:00Z`).getTime()-start)/Math.max(1,end-start)*(W-L-R);
  const y=v=>H-B-(v-min)/span*(H-T-B);
  const value=v=>options.percent?`${Math.round(v*100)}%`:`${Math.round(v)}%`;
  const ticks=options.ticks || [min,(min+max)/2,max];
  const grid=ticks.map(t=>`<line class="chart-grid ${t===options.reference?"reference":""}" x1="${L}" y1="${y(t)}" x2="${W-R}" y2="${y(t)}"/><text class="chart-axis" x="${L-5}" y="${y(t)+3}" text-anchor="end">${value(t)}</text>`).join("");
  const date=d=>new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US",{month:"short",day:"numeric",timeZone:"UTC"});
  const dates=`<text class="chart-axis" x="${L}" y="${H-3}">${date(all[0].date)}</text><text class="chart-axis" x="${W-R}" y="${H-3}" text-anchor="end">${date(all.at(-1).date)}</text>`;
  return {W,H,L,R,T,B,x,y,grid,dates};
}

function drawChart(selector, series, options={}) {
  const svg = typeof selector === "string" ? $(selector) : selector; if (!svg || !series.length) { if(svg) svg.innerHTML=""; return; }
  const f=chartFrame(svg,[series],options), points=series.map(d=>`${f.x(d)},${f.y(d.v)}`).join(" ");
  svg.innerHTML=`${f.grid}${f.dates}<polyline class="chart-line" points="${points}"/><circle class="chart-dot" cx="${f.x(series.at(-1))}" cy="${f.y(series.at(-1).v)}" r="4"/>`;
}

function drawMultiChart(selector, datasets, options={}) {
  const svg=$(selector), usable=datasets.filter(set=>set.series.length); if(!svg||!usable.length){if(svg)svg.innerHTML="";return;}
  const f=chartFrame(svg,usable.map(set=>set.series),options);
  const lines=usable.map(set=>{const points=set.series.map(d=>`${f.x(d)},${f.y(d.v)}`).join(" ");const last=set.series.at(-1);return `<polyline class="chart-line" style="stroke:${set.color}" points="${points}"/><circle class="chart-dot" style="stroke:${set.color}" cx="${f.x(last)}" cy="${f.y(last.v)}" r="3.5"/>`;}).join("");
  const legend=usable.map((set,index)=>`<circle cx="${f.L+index*108}" cy="8" r="3" fill="${set.color}"/><text class="chart-axis" x="${f.L+7+index*108}" y="11">${set.label}</text>`).join("");
  svg.innerHTML=`${f.grid}${f.dates}${legend}${lines}`;
}

function renderTrends() {
  const generic=(data.nationalClimate?.generic||[]).slice(-180), approval=(data.nationalClimate?.approval||[]).slice(-180);
  const dem=generic.map(row=>({date:row.end_date,v:row.dem_estimate})), rep=generic.map(row=>({date:row.end_date,v:row.rep_estimate}));
  const approve=approval.map(row=>({date:row.end_date,v:row.approve_estimate})), disapprove=approval.map(row=>({date:row.end_date,v:row.disapprove_estimate}));
  const g=generic.at(-1), a=approval.at(-1), gMargin=g?.dem_estimate-g?.rep_estimate, aMargin=a?.approve_estimate-a?.disapprove_estimate;
  els.genericNow.textContent = g ? `D ${g.dem_estimate.toFixed(1)}% · R ${g.rep_estimate.toFixed(1)}% · D+${gMargin.toFixed(1)}` : "No cached average";
  els.approvalNow.textContent = a ? `Approve ${a.approve_estimate.toFixed(1)}% · disapprove ${a.disapprove_estimate.toFixed(1)}% · net ${aMargin.toFixed(1)}` : "No cached average";
  const scale={domain:[30,70],ticks:[30,40,50,60,70],reference:50};
  drawMultiChart("#generic-chart",[{series:dem,color:"#378be6",label:"Democratic"},{series:rep,color:"#e65355",label:"Republican"}],scale);
  drawMultiChart("#approval-chart",[{series:approve,color:"#72c49a",label:"Approve"},{series:disapprove,color:"#e65355",label:"Disapprove"}],scale);
}

function changesBetween(before, after) {
  if (!before) return [];
  if (before.headline?.source !== after.headline?.source) return [];
  const out=[];
  for (const ch of ["house","senate"]) {
    const old=new Map(before[ch].map(r=>[r.key,r]));
    after[ch].forEach(r=>{ const p=old.get(r.key); if (!p) return; const delta=Math.round((r.chance_left-p.chance_left)*100); if (p.rating!==r.rating || Math.abs(delta)>=2) out.push({date:snapshotDay(after),key:r.key,competitive:Math.max(r.chance_left,1-r.chance_left)<.8,text:p.rating!==r.rating?`${p.rating} → ${r.rating}`:`Democratic chance ${delta>0?"+":""}${delta} pts`,delta}); });
  }
  return out.sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));
}

function renderFeed(competitiveOnly) {
  let items=[]; for(let i=1;i<snapshots.length;i++) items.push(...changesBetween(snapshots[i-1],snapshots[i]));
  items.push(...(data.ratings?.rcpSenateChanges || []).map(row => ({ date:row.date, key:row.key, competitive:!/^Safe|^Solid/.test(row.rating), text:`RCP: ${row.previous} → ${row.rating}`, delta:0 })));
  if (competitiveOnly) items=items.filter(i=>i.competitive);
  items.sort((a,b)=>a.date.localeCompare(b.date));
  els.feed.innerHTML = items.length ? items.slice(-60).reverse().map(item=>`<div class="feed-item"><time>${item.date.slice(5)}</time><div><b>${item.key}</b><br>${item.text}</div><small>${item.competitive?"key race":"all seats"}</small></div>`).join("") : `<div class="feed-item"><time>${data.asOf.slice(5)}</time><div><b>Baseline saved</b><br>Run the refresh script on a later source date to generate the first change set.</div><small>system</small></div>`;
}

function renderLedger() {
  const houseMarket=data.polymarket?.chambers?.house, senateMarket=data.polymarket?.chambers?.senate;
  const links=[["FiftyPlusOne · forecasts + national polling averages","https://fiftyplusone.news/polls/generic-ballot/generic-ballot"],[`Polling Forecast · race metadata and comparison odds`,"https://www.pollingforecast.com/us/data"],[`Cook · ${Object.values(data.ratings?.raceRatings||{}).flat().filter(x=>x.source==="Cook").length} public ratings`,"https://www.cookpolitical.com/ratings"],[`Inside Elections · ${Object.values(data.ratings?.raceRatings||{}).flat().filter(x=>x.source==="Inside Elections").length} public ratings`,"https://insideelections.com/ratings/"],[`RCP · ratings + ${data.ratings?.rcpSenateChanges?.length||0} Senate changes`,"https://www.realclearpolling.com/maps/senate/2026/toss-up/race-changes"],[`Polymarket · House ${houseMarket?.currentDem==null?"—":pct(houseMarket.currentDem)} D · Senate ${senateMarket?.currentDem==null?"—":pct(senateMarket.currentDem)} D`,"https://polymarket.com/event/balance-of-power-2026-midterms"]];
  els.ledger.innerHTML=links.map(([label,url])=>`<a href="${url}" target="_blank" rel="noreferrer">${label} ↗</a>`).join("");
}

load();
