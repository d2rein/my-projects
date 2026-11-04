const API = '/api/midterms-live?office=';
const SOURCE = 'https://openamerica.io/elections/api/';
const FORECAST = 'data/seats.json';
const state = { chamber: 'house', forecast: null, live: { house: null, senate: null }, errors: {house:null,senate:null}, nextAt: 0, timer: null, countdown: null, selected: null };

const $ = (s) => document.querySelector(s);
const fmt = new Intl.NumberFormat('en-US');
const partySide = (p) => p === 'D' || p === 'DFL' ? 'D' : p === 'R' ? 'R' : p || '—';
const forecastSide = (race) => Number(race.chance_left ?? .5) >= .5 ? 'd' : 'r';
const ratingClass = (race) => {
  if (race.notUp) return 'safe';
  const p = Math.max(Number(race.chance_left ?? .5), 1-Number(race.chance_left ?? .5));
  return p < .55 ? 'toss' : p < .7 ? 'lean' : p < .9 ? 'likely' : 'safe';
};
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time = (v) => v ? new Date(v).toLocaleString([], {month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}) : 'unknown';

function races(payload) { return payload?.races || {}; }
function liveKey(race, chamber) {
  if (chamber === 'senate') return race.state;
  const key = race.key.toUpperCase();
  return key.endsWith('-00') ? key.slice(0,-2) + 'AL' : key;
}
function resultFor(race, chamber) {
  const rs = races(state.live[chamber]);
  const key = liveKey(race, chamber);
  return rs[key] || rs[race.key] || null;
}
function sortedCandidates(result) { return [...(result?.cands || [])].sort((a,b) => (b.v || 0) - (a.v || 0)); }
function resultFacts(result) {
  const cands = sortedCandidates(result);
  const top = cands[0];
  const next = cands[1];
  const hasVotes = (result?.total || 0) > 0 && top;
  const leader = hasVotes ? partySide(top.p) : '';
  const margin = hasVotes ? Math.max(0, (top.pct || 0) - (next?.pct || 0)) : null;
  return { cands, top, next, hasVotes, leader, margin };
}
function reportingText(result) {
  if (!result) return 'No live feed';
  if (result.pct_in == null) return result.total > 0 ? 'Reporting n/a' : 'Waiting';
  return `${Number(result.pct_in).toFixed(result.pct_in % 1 ? 1 : 0)}% in`;
}
function marginText(result) {
  const f = resultFacts(result);
  if (!f.hasVotes) return result ? 'No votes yet' : 'Forecast only';
  return `${f.leader} +${f.margin.toFixed(1)}`;
}
function sideClass(result) {
  const leader = resultFacts(result).leader;
  return leader === 'D' ? 'dem' : leader === 'R' ? 'rep' : 'uncovered';
}
function allSeats(chamber) {
  if (!state.forecast) return [];
  if (chamber === 'house') return state.forecast.house.map(r => ({...r, notUp:false}));
  return [...state.forecast.senate.map(r => ({...r, notUp:false})), ...(state.forecast.senateHolds || []).map(r => ({...r,kind:'Senate',held_by:r.caucus || r.party,left_candidate:r.caucus === 'D' ? r.senator : '',rep_candidate:r.caucus === 'R' ? r.senator : '',chance_left:r.caucus === 'D' ? 1 : 0,winner:r.caucus}))];
}
function card(race, chamber) {
  const result = race.notUp ? null : resultFor(race, chamber);
  const facts = resultFacts(result);
  const side = forecastSide(race);
  const grade = ratingClass(race);
  const pickup = !race.notUp && race.winner && race.held_by && race.winner !== race.held_by;
  const key = chamber === 'house' ? race.key : race.state;
  const candidateNames = facts.hasVotes ? facts.cands.slice(0,2).map(c => c.n.split(' ').at(-1)).join(' · ') : [race.left_candidate,race.rep_candidate].filter(Boolean).map(n => n.split(' ').at(-1)).join(' · ') || race.senator || '—';
  const inPct = result?.pct_in == null ? 0 : Math.max(0,Math.min(100,result.pct_in));
  const liveSide = sideClass(result);
  const forecastPct = race.notUp ? 'HOLD' : `${Math.round(Math.max(race.chance_left,1-race.chance_left)*100)}%`;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `seat-card ${side} ${grade}${pickup ? ' pickup' : ''}${race.notUp ? ' hold' : ''}${facts.hasVotes ? ' has-votes' : ''}`;
  button.style.setProperty('--in', inPct);
  const resultLeft = race.notUp ? 'Not up' : facts.hasVotes ? marginText(result) : result ? 'No votes yet' : 'No live feed';
  const resultRight = race.notUp ? (race.caucus || race.party) : result ? reportingText(result) : (race.rating || 'Forecast');
  button.innerHTML = `<span class="seat-head"><span>${esc(key)}</span><span>${esc(forecastPct)}</span></span><span class="candidates">${esc(candidateNames)}</span><span class="result"><span class="live-margin ${liveSide}">${esc(resultLeft)}</span><span>${esc(resultRight)}</span></span>`;
  button.setAttribute('aria-label', `${race.name || key}: ${race.notUp ? 'not up' : `${marginText(result)}, ${reportingText(result)}`}`);
  button.addEventListener('click', () => openRace(race, chamber));
  return button;
}
function renderBoard() {
  const chamber = state.chamber;
  const seats = allSeats(chamber).sort((a,b) => Number(b.chance_left ?? .5)-Number(a.chance_left ?? .5) || (a.key || a.state).localeCompare(b.key || b.state));
  const threshold = chamber === 'house' ? 218 : 50;
  const board = $('#seat-board');
  board.replaceChildren();
  seats.forEach((race,i) => {
    board.append(card(race,chamber));
    if (i === threshold-1) {
      const line = document.createElement('div');
      line.className = 'majority-line';
      line.textContent = chamber === 'house' ? '218-seat majority line' : '50 seats · next seat gives outright control';
      board.append(line);
    }
  });
  $('#board-title').textContent = chamber === 'house' ? 'House seats' : 'Senate seats';
  renderSummary();
}
function renderSummary() {
  const chamber = state.chamber;
  const payload = state.live[chamber];
  const entries = Object.values(races(payload));
  const reporting = entries.filter(r => (r.total || 0) > 0);
  const d = reporting.filter(r => resultFacts(r).leader === 'D').length;
  const r = reporting.filter(race => resultFacts(race).leader === 'R').length;
  $('#reporting-count').textContent = reporting.length;
  $('#dem-leading').textContent = d;
  $('#rep-leading').textContent = r;
  $('#feed-coverage').textContent = `${entries.length} races`;
  const failed = state.errors[chamber];
  const status = payload?.stale ? 'Feed stale' : payload?.live || payload?.counting ? 'Live counting' : payload ? 'Results feed' : failed ? 'Feed unavailable' : 'Connecting';
  $('#feed-state').textContent = status;
  $('#feed-state').className = `live-pill ${payload?.stale || failed ? 'stale' : payload ? 'live' : ''}`;
  $('#status-dot').className = payload?.stale || failed ? 'stale' : payload ? 'live' : '';
  $('#as-of').textContent = payload ? `State data as of ${time(payload.as_of)}` : failed ? `Final forecast locked · live feed retrying` : 'Loading live results…';
}
function openRace(race, chamber) {
  state.selected = {race,chamber};
  const result = race.notUp ? null : resultFor(race,chamber);
  const facts = resultFacts(result);
  $('#drawer-kind').textContent = `${chamber} · ${race.key || race.state}`;
  $('#drawer-title').textContent = race.name || `${race.state} ${chamber}`;
  let body = '';
  if (race.notUp) {
    body = `<div class="drawer-summary"><div><span>Status</span><strong>Not up in 2026</strong></div><div><span>Senator</span><strong>${esc(race.senator)}</strong></div></div>`;
  } else if (!result) {
    body = `<div class="drawer-summary"><div><span>Live result</span><strong>No feed</strong></div><div><span>Pre-election forecast</span><strong>${Math.round((race.chance_left ?? .5)*100)}% D</strong></div></div><p class="drawer-note">Open America has no live result for this race. This is an explicit coverage gap, not a zero-vote report.</p>`;
  } else {
    body = `<div class="drawer-summary"><div><span>Current margin</span><strong>${esc(marginText(result))}</strong></div><div><span>Reporting</span><strong>${esc(reportingText(result))}</strong></div></div>`;
    body += facts.cands.map(c => `<div class="candidate-row"><span><b class="party">${esc(c.p)}</b>${esc(c.n)}</span><strong>${c.pct == null ? '—' : Number(c.pct).toFixed(2)+'%'}</strong><strong>${fmt.format(c.v || 0)}</strong></div>`).join('');
    body += `<p class="drawer-note">${fmt.format(result.total || 0)} votes currently counted. State data timestamp: ${esc(time(state.live[chamber]?.as_of))}. Open America supplies counts and leaders but does not call races.</p>`;
  }
  body += `<div class="drawer-links"><a href="${SOURCE}" target="_blank" rel="noreferrer">Open America methodology ↗</a>${race.model_source_url ? `<a href="${esc(race.model_source_url)}" target="_blank" rel="noreferrer">Pre-election forecast ↗</a>` : ''}</div>`;
  $('#drawer-content').innerHTML = body;
  const dialog = $('#race-dialog');
  if (!dialog.open) dialog.showModal();
}
async function fetchJson(url) {
  const res = await fetch(`${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`, {cache:'no-store'});
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}
async function update() {
  $('#refresh-now').disabled = true;
  try {
    if (!state.forecast) {
      state.forecast = await fetchJson(FORECAST);
      renderBoard();
      $('#as-of').textContent = `Final forecast ${state.forecast.asOf || state.forecast.snapshotDate || ''} · loading live results…`;
    }
    const [houseResult,senateResult] = await Promise.allSettled([fetchJson(API+'House'),fetchJson(API+'Senate')]);
    if (houseResult.status === 'fulfilled') { state.live.house = houseResult.value; state.errors.house = null; }
    else state.errors.house = houseResult.reason;
    if (senateResult.status === 'fulfilled') { state.live.senate = senateResult.value; state.errors.senate = null; }
    else state.errors.senate = senateResult.reason;
    $('#last-checked').textContent = `Last checked ${new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit',second:'2-digit'})}`;
    const active = Object.values(state.live).some(p => p && (p.live || p.counting) && !p.final);
    schedule(active ? 60000 : 600000);
    renderBoard();
    if (state.selected) openRace(state.selected.race,state.selected.chamber);
  } catch (err) {
    console.error(err);
    $('#feed-state').textContent = 'Feed unavailable';
    $('#feed-state').className = 'live-pill stale';
    $('#status-dot').className = 'stale';
    $('#as-of').textContent = state.forecast ? 'Final forecast locked · live feed retrying' : 'Dashboard data unavailable — retrying';
    schedule(60000);
    if (state.forecast) renderBoard();
  } finally { $('#refresh-now').disabled = false; }
}
function schedule(ms) {
  clearTimeout(state.timer);
  state.nextAt = Date.now()+ms;
  state.timer = setTimeout(update,ms);
  tick();
}
function tick() {
  clearInterval(state.countdown);
  const draw = () => {
    const sec = Math.max(0,Math.ceil((state.nextAt-Date.now())/1000));
    $('#next-update').textContent = `Next update ${sec < 120 ? `${sec}s` : `${Math.ceil(sec/60)}m`}`;
  };
  draw(); state.countdown = setInterval(draw,1000);
}
document.querySelectorAll('.tab').forEach(tab => tab.addEventListener('click', () => {
  state.chamber = tab.dataset.chamber;
  document.querySelectorAll('.tab').forEach(t => { const on=t===tab;t.classList.toggle('active',on);t.setAttribute('aria-selected',String(on)); });
  renderBoard();
}));
$('#refresh-now').addEventListener('click',update);
$('#drawer-close').addEventListener('click',() => $('#race-dialog').close());
$('#race-dialog').addEventListener('click',e => { if(e.target === e.currentTarget) e.currentTarget.close(); });
$('#race-dialog').addEventListener('close',() => { state.selected = null; });
update();
