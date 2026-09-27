import { createReplayEngine } from "../shared/replay-engine.js";
import { buildFinalsBracket, FINALS_ROUNDS } from "../shared/finals-bracket.js";
import { MODELS, SYSTEMS, TIPPING_POLICY, ACTIVE_MODEL, API_URL, CACHE_VERSION, CURRENT_SEASON } from "./model-config.js?v=20260925-3";

const state={cache:null,nrlwCache:null,competition:"NRL",historicalComparison:null,current:[],teamLists:[],currentMarkets:[],currentForecasts:[],currentForecastModel:null,charts:{},ratings:null,replayDetails:null,projectionContext:null,selectedRatingTeams:new Set(),historySignature:null};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const pct=v=>v==null?"—":`${(100*v).toFixed(1)}%`;
const validNumber=v=>v!==null&&v!==undefined&&v!==""&&Number.isFinite(Number(v));
const money=v=>validNumber(v)?`$${Number(v).toFixed(2)}`:"—";
const roundNumber=r=>Number(String(r||"").match(/\d+/)?.[0]??999);
const isRegular=r=>/^Rd\s*\d+/i.test(String(r||""));
const logo=n=>{const slug=String(n).toLowerCase().replace(/\./g,"").replace(/\s+/g,"-");return `../logos/${({"canterbury-bankstown-bulldogs":"canterbury-bulldogs","cronulla-sutherland-sharks":"cronulla-sharks","north-queensland-cowboys":"nq-cowboys","manly-warringah-sea-eagles":"manly-sea-eagles"}[slug]||slug)}.png`};
const modelTip=r=>r.candidateP==null?null:(r.candidateP>=.5?r.home:r.away);
const actualWinner=r=>r.hs==null||r.as==null?null:r.hs===r.as?"Draw":r.hs>r.as?r.home:r.away;
const correct=(r,tip)=>{const w=actualWinner(r);return w==null?null:w==="Draw"?true:w===tip};
const noVig=(home,away)=>home&&away?(1/home)/((1/home)+(1/away)):null;
const shortTeam=value=>({"Sydney Roosters":"Roosters","Cronulla-Sutherland Sharks":"Sharks","Cronulla Sharks":"Sharks","New Zealand Warriors":"Warriors","Newcastle Knights":"Knights","South Sydney Rabbitohs":"Rabbitohs","Penrith Panthers":"Panthers","North Queensland Cowboys":"Cowboys","NQ Cowboys":"Cowboys","Brisbane Broncos":"Broncos","Canberra Raiders":"Raiders","Canterbury-Bankstown Bulldogs":"Bulldogs","Gold Coast Titans":"Titans","Manly-Warringah Sea Eagles":"Sea Eagles","Melbourne Storm":"Storm","Parramatta Eels":"Eels","St George Illawarra Dragons":"Dragons","St. George Illawarra Dragons":"Dragons","Wests Tigers":"Tigers"}[value]||value);
const roundKey=value=>String(value||"").replace(/Finals Week/i,"Finals Wk").replace(/\s+/g," ").trim().toLowerCase();

async function loadCache(){
  const [res,nrlwResponse]=await Promise.all([fetch(`data/historical-cache.json?v=${CACHE_VERSION}`),fetch(`data/nrlw-cache.json?v=20260927-1`)]);
  if(!res.ok)throw new Error(`Historical cache ${res.status}`);
  state.cache=await res.json();
  if(!nrlwResponse.ok)throw new Error(`NRLW cache ${nrlwResponse.status}`);
  state.nrlwCache=await nrlwResponse.json();
  const comparison=await fetch(`data/historical-model-comparison.json?v=20260917-1`);
  if(!comparison.ok)throw new Error(`Historical model comparison ${comparison.status}`);
  state.historicalComparison=await comparison.json();
  if(state.cache.meta.version!==CACHE_VERSION)console.warn("Cache/config version mismatch");
}

function activeCache(){return state.competition==="NRLW"?state.nrlwCache:state.cache}
function competitionMatches(){return activeCache()?.matches||[]}
function marginCoefficient(){return state.competition==="NRLW"?Number(state.nrlwCache?.meta?.marginCoefficient||.1325):.048406}

async function refreshCurrent(){
  const button=$("#refresh-current"); button.disabled=true; button.textContent="Refreshing…";
  const base=state.cache.matches.filter(r=>r.year===CURRENT_SEASON);
  try{
    const [response,teamListResponse,forecastApiResponse,marketResponse,forecastFileResponse]=await Promise.all([
      fetch(`${API_URL}/api/matches?limit=20000`),
      fetch(`${API_URL}/api/prospective/team-lists?season=${CURRENT_SEASON}&view=announced`,{cache:"no-store"}).catch(()=>null),
      fetch(`${API_URL}/api/prospective/forecasts?season=${CURRENT_SEASON}`,{cache:"no-store"}).catch(()=>null),
      fetch(`${API_URL}/api/prospective/markets?season=${CURRENT_SEASON}&competition=NRL`,{cache:"no-store"}).catch(()=>null),
      fetch(`data/current-finals-forecast.json`,{cache:"no-store"}).catch(()=>null)
    ]);
    if(!response.ok)throw new Error(`API ${response.status}`);
    const live=await response.json();
    state.teamLists=teamListResponse?.ok?await teamListResponse.json():[];
    state.currentMarkets=marketResponse?.ok?await marketResponse.json():[];
    const apiForecast=forecastApiResponse?.ok?await forecastApiResponse.json():null;
    const fileForecast=forecastFileResponse?.ok?await forecastFileResponse.json():null;
    const forecastPayload=apiForecast?.forecasts?.length?apiForecast:fileForecast;
    state.currentForecastModel=forecastPayload?.model||null;
    state.currentForecasts=state.currentForecastModel===ACTIVE_MODEL.id?forecastPayload.forecasts||[]:[];
    const liveSportsbet=state.currentMarkets.filter(r=>r.bookmaker==="Sportsbet"&&String(r.source).includes("sportsbet_public_listing"));
    const byId=new Map(base.map(r=>[Number(r.id),r])), marketByTeams=new Map([...(state.cache.currentMarkets||[]),...liveSportsbet].map(r=>[`${shortTeam(r.home)}|${shortTeam(r.away)}`,r])), listByTeams=new Map(state.teamLists.map(r=>[`${shortTeam(r.home?.nick_name||r.home?.name)}|${shortTeam(r.away?.nick_name||r.away?.name)}|${roundKey(r.round_name)}`,r])),forecastByTeams=new Map(state.currentForecasts.map(r=>[`${r.home}|${r.away}|${roundKey(r.round)}`,r]));
    state.current=live.filter(r=>Number(r.year)===CURRENT_SEASON).map(m=>{
      const cached=byId.get(Number(m.id))||base.find(r=>r.home===m.home_team&&r.away===m.away_team&&String(r.round).replace("Finals Week","Finals Wk")===String(m.round));
      const teamList=listByTeams.get(`${shortTeam(m.home_team)}|${shortTeam(m.away_team)}|${roundKey(m.round)}`)||null;
      const pair=validNumber(m.home_odds)&&validNumber(m.away_odds);
      const forecast=forecastByTeams.get(`${m.home_team}|${m.away_team}|${roundKey(m.round)}`)||null,forecastStale=Boolean(forecast&&teamList&&forecast.lineupSha256&&forecast.lineupSha256!==teamList.lineup_sha256),observed=marketByTeams.get(`${shortTeam(m.home_team)}|${shortTeam(m.away_team)}`), liveHome=validNumber(observed?.lastHome)?Number(observed.lastHome):(pair?Number(m.home_odds):null),liveAway=validNumber(observed?.lastAway)?Number(observed.lastAway):(pair?Number(m.away_odds):null),liveP=noVig(liveHome,liveAway),openP=noVig(observed?.openingHome,observed?.openingAway),candidateP=forecast?.candidateP??cached?.candidateP??null;
      const marketFav=liveP==null?null:Math.max(liveP,1-liveP),marketTipHome=liveP==null?null:liveP>.5,modelTipHome=candidateP==null?null:candidateP>=.5;
      return {...cached,id:Number(m.id),year:Number(m.year),round:m.round,matchIndex:Number(m.match_index),game:Number(m.game_num),home:m.home_team,away:m.away_team,hs:m.home_score==null?null:Number(m.home_score),as:m.away_score==null?null:Number(m.away_score),venue:m.venue_name||cached?.venue||null,teamList,forecastStale,bstarP:forecast?.bstarP??cached?.bstarP??null,gate6P:forecast?.gate6P??cached?.gate6P??null,stage4P:forecast?.stage4P??cached?.stage4P??null,candidateP,candidateDr:forecast?.candidateDr??cached?.candidateDr??null,rookieMargin:forecast?.rookieMargin??cached?.rookieMargin??null,rookieGate:forecast?.rookieGate??cached?.rookieGate??false,lineupMargin:forecast?.lineupMargin??cached?.lineupMargin??null,lineupGate:forecast?.lineupGate??cached?.lineupGate??false,teamListDrivers:forecast?.teamListDrivers??cached?.teamListDrivers??null,o10P:forecast?.o10P??cached?.o10P??null,o9P:forecast?.o9P??cached?.o9P??null,creationP:forecast?.creationP??cached?.creationP??null,playerAlert:forecast?.playerAlert??cached?.playerAlert??false,playerConsensus:forecast?.playerConsensus??cached?.playerConsensus??false,playerDrivers:forecast?.playerDrivers??cached?.playerDrivers??null,stableMargin:forecast?.stableMargin??cached?.stableMargin??null,forecastObservedAt:forecast?.source_observed_at||null,forecastStatus:forecast?.forecastStatus||null,oddsTip:m.odds_tip||cached?.oddsTip||null,userTip:m.user_tip||cached?.userTip||null,liveOdds:validNumber(liveHome)&&validNumber(liveAway),liveHome,liveAway,openHome:validNumber(observed?.openingHome)?Number(observed.openingHome):cached?.openHome??null,openAway:validNumber(observed?.openingAway)?Number(observed.openingAway):cached?.openAway??null};
    });
    const forecastTimes=state.current.map(r=>r.forecastObservedAt).filter(Boolean).sort(),forecastNote=forecastTimes.length?` · forecast lists ${new Date(forecastTimes.at(-1)).toLocaleString("en-AU")}`:"";
    $("#current-updated").textContent=`Live data checked ${new Date().toLocaleString("en-AU")}${forecastNote}`;
  }catch(error){
    state.current=base;
    $("#current-updated").textContent="Showing frozen cache";
    showNotice(`The live API could not be reached. The ${state.cache.meta.cutoff} cache is displayed.`,"warning");
  }finally{button.disabled=false;button.textContent="Refresh"}
  state.replayDetails=null;
  const fallbackDetails=getReplayDetails();
  state.current=state.current.map(r=>{if(r.candidateP!=null||r.hs==null||r.as==null)return r;const p=fallbackDetails.get(Number(r.id))?.coreP;if(p==null)return r;const dr=-400*Math.log10(1/p-1);return {...r,bstarP:p,candidateP:p,candidateDr:dr,generalMargin:Math.abs(dr)<85?4:Math.abs(dr)<185?8:10,coreFallback:true}});
  if(state.current.some(r=>r.hs==null&&r.as==null&&r.candidateP==null))showNotice(`A current ${ACTIVE_MODEL.id} forecast is not available for every upcoming match. No older model has been substituted.`);
  state.projectionContext=null;
  renderCurrent();
  state.historySignature=null;
  if($("#tab-history")?.classList.contains("active"))renderHistory();
  prepareCurrentRoundEntry();
}

function showNotice(message){const el=$("#global-message");el.textContent=message;el.classList.remove("hidden")}
function metric(rows,selector){const values=rows.map(selector).filter(v=>v!==null);return {correct:values.filter(Boolean).length,games:values.length}}

function getReplayDetails(){
  if(state.replayDetails)return state.replayDetails;
  const currentIds=new Set(state.current.map(r=>Number(r.id)));
  const source=[...state.cache.matches.filter(r=>!currentIds.has(Number(r.id))),...state.current].sort((a,b)=>a.year-b.year||a.matchIndex-b.matchIndex);
  const matches=source.map(r=>({id:r.id,year:r.year,round:r.round,match_index:r.matchIndex,home_team:r.home,away_team:r.away,home_score:r.hs,away_score:r.as}));
  const teams=[...new Set(matches.flatMap(r=>[r.home_team,r.away_team]).filter(Boolean))].map(name=>({name}));
  const replay=createReplayEngine(MODELS.production2026.parameters,teams).replayMatches(matches,{applyByes:true});
  state.replayDetails=new Map(replay.rows.map(r=>[Number(r.match.id),{homeElo:r.out.homeEloBefore,awayElo:r.out.awayEloBefore,homeRank:r.homeRankBeforeRound,awayRank:r.awayRankBeforeRound,coreP:r.out.expected}]));
  return state.replayDetails;
}

function getProjectionContext(){
  if(state.projectionContext)return state.projectionContext;
  const source=allDisplayMatches().filter(r=>r.hs!=null&&r.as!=null),matches=source.map(r=>({id:r.id,year:r.year,round:r.round,match_index:r.matchIndex,home_team:r.home,away_team:r.away,home_score:r.hs,away_score:r.as}));
  const teams=[...new Set(matches.flatMap(r=>[r.home_team,r.away_team]).filter(Boolean))].map(name=>({name}));
  state.projectionContext=createReplayEngine(MODELS.production2026.parameters,teams).replayMatches(matches,{applyByes:true});
  return state.projectionContext;
}

function projectionFor(match){
  const existing=state.current.find(r=>r.year===Number(match.year)&&roundKey(r.round)===roundKey(match.round)&&Number(r.game)===Number(match.game_num));
  if(existing?.candidateP!=null)return {p:existing.candidateP,dr:existing.candidateDr,margin:existing.stableMargin??existing.generalMargin};
  const context=getProjectionContext(),preview=context.eloCalc.previewMatch(context.state,match),dr=preview.dr;
  return {p:preview.expected,dr,margin:Math.abs(dr)<85?4:Math.abs(dr)<185?8:10,homeElo:preview.homeEloBefore,awayElo:preview.awayEloBefore};
}

function projectedFinalsRows(){
  if(!state.current.length)return [];
  const seeds=computeLadder(CURRENT_SEASON,"Rd 27").slice(0,8).map(r=>r.team),regularMax=Math.max(0,...state.current.filter(r=>isRegular(r.round)).map(r=>Number(r.matchIndex)||0));
  const confirmed=state.current.filter(r=>FINALS_ROUNDS.some(round=>roundKey(round.label)===roundKey(r.round))).map(r=>({...r,home_team:r.home,away_team:r.away,home_score:r.hs,away_score:r.as,game_num:r.game}));
  const bracket=buildFinalsBracket({year:CURRENT_SEASON,seeds,confirmedMatches:confirmed,pickWinner:match=>{const forecast=projectionFor(match);return forecast.p>=.5?match.home_team:match.away_team}});
  return bracket.map((match,index)=>{
    const saved=state.current.find(r=>roundKey(r.round)===roundKey(match.round)&&Number(r.game)===Number(match.game_num));
    if(saved)return {...saved,finalsLabel:match.finals_label};
    const forecast=projectionFor(match);
    return {id:`projected-${match.finals_key}`,year:CURRENT_SEASON,round:match.round,finalsLabel:match.finals_label,matchIndex:regularMax+index+1,game:match.game_num,home:match.home_team,away:match.away_team,hs:null,as:null,venue:null,candidateP:forecast.p,candidateDr:forecast.dr,generalMargin:forecast.margin,stableMargin:null,rookieGate:false,projectedHomeElo:forecast.homeElo,projectedAwayElo:forecast.awayElo,projectedHomeRank:seeds.indexOf(match.home_team)+1||null,projectedAwayRank:seeds.indexOf(match.away_team)+1||null,projected:true};
  });
}

function allDisplayMatches(){
  if(state.competition==="NRLW")return state.nrlwCache.matches;
  const liveIds=new Set(state.current.map(r=>Number(r.id)));
  return [...state.cache.matches.filter(r=>!liveIds.has(Number(r.id))),...state.current].sort((a,b)=>a.year-b.year||a.matchIndex-b.matchIndex);
}

function currentRoundName(){
  const rows=[...(state.competition==="NRLW"?seasonMatches(CURRENT_SEASON):state.current)].sort((a,b)=>a.matchIndex-b.matchIndex);
  return (rows.find(r=>r.hs==null||r.as==null)||rows.at(-1))?.round||"Rd 1";
}

function prepareCurrentRoundEntry(){
  $("#round-year").value=String(CURRENT_SEASON);
  $("#round-name").value=currentRoundName();
  loadRoundForEntry();
}

function scrollToCurrentRound(tableSelector,rows){
  const current=currentRoundName(),target=rows.find(r=>r.year===CURRENT_SEASON&&roundKey(r.round)===roundKey(current));
  if(!target)return;
  requestAnimationFrame(()=>{
    const table=$(tableSelector),scroller=table?.closest(".games-scroll"),row=table?.querySelector(`tr[data-match-id="${target.id}"]`);
    if(scroller&&row)scroller.scrollTop=Math.max(0,row.offsetTop-scroller.clientHeight*.35);
  });
}

function pip(pick,eloPick,winner,completed,title){let cls="pip neutral";if(!completed)cls=pick===eloPick?"pip success":"pip warning";else if(winner==="Draw"||pick===winner)cls="pip success";else if(eloPick===winner)cls="pip error";else cls="pip warning";return `<span class="${cls}" title="${esc(title)}"></span>`}
function rankPip(pick,eloPick,winner,completed){if(!pick)return '<span class="pip neutral" title="Ladder pick unavailable"></span>';let cls="pip neutral";if(!completed)cls=pick===eloPick?"pip success":"pip error";else if(winner==="Draw"||pick===winner)cls="pip success";else if(eloPick!==winner)cls="pip warning";else cls="pip error";return `<span class="${cls}" title="Ladder pick: ${esc(pick)}"></span>`}
function listTick(r){if(r.teamList){const timing=r.forecastStale?"; forecast refresh pending for this newer list":r.forecastStatus==="reconstructed_from_archived_pregame_inputs"?"; displayed forecast was reconstructed from this archived pregame snapshot after the match":"; displayed forecast uses this list";return `<span class="list-tick prematch" title="Official announced list captured: ${r.teamList.home.players.length}/${r.teamList.away.players.length} named${timing}">✓</span>`}if(r.hs!=null&&r.as!=null)return '<span class="list-tick postmatch" title="Post-match run-out list archived separately; announced tipping list unavailable">✓</span>';return "—"}
function marketSignals(r,modelProbability=r.candidateP){
  const home=r.liveOdds?r.liveHome:r.closeHome,away=r.liveOdds?r.liveAway:r.closeAway,current=noVig(Number(home),Number(away)),opening=noVig(Number(r.openHome),Number(r.openAway)),model=validNumber(modelProbability)?Number(modelProbability):null;
  if(current==null||model==null)return {home,away,current,opening,flip:false,adverseMove:false};
  const modelHome=model>=.5,marketHome=current>.5,modelConfidence=Math.abs(model-.5),marketConfidence=Math.abs(current-.5),confidenceGap=marketConfidence-modelConfidence;
  const flip=modelHome!==marketHome&&confidenceGap>=.10-1e-9;
  const comparableMove=r.liveOdds||r.explicitClose||r.closeSource==="explicit_single_book_close",movement=opening==null?null:current-opening,adverse=modelHome?-(movement??0):(movement??0),adverseMove=Boolean(comparableMove&&movement!=null&&adverse>=.10-1e-9);
  return {home,away,current,opening,model,modelHome,marketHome,modelConfidence,marketConfidence,confidenceGap,flip,movement,adverseMove};
}
function swapIndicator(signal){if(!signal.flip)return "";const model=Math.round(100*signal.model),market=Math.round(100*signal.current),modelEdge=Math.round(100*signal.modelConfidence),marketEdge=Math.round(100*signal.marketConfidence),gap=Math.round(100*signal.confidenceGap);return `<span class="market-swap" title="Model ${model}% v market ${market}%; confidence gap ${marketEdge} − ${modelEdge} = ${gap}pp ≥ 10pp: flip">⇄</span>`}
function moveIndicator(signal){if(!signal.adverseMove)return "";const opening=(100*signal.opening).toFixed(1),current=(100*signal.current).toFixed(1),move=Math.abs(100*signal.movement).toFixed(1);return `<span class="market-move" title="Home market: opening ${opening}% → current ${current}%; ${move}pp move away from the Elo tip">📉</span>`}
function rookieComparison(r){if(!r.rookieGate||!validNumber(r.bstarP))return "";const base=pct(Number(r.bstarP)),shadow=pct(Number(r.gate6P)),value=validNumber(r.rookieMargin)?r.rookieMargin:r.lineupMargin,adjustment=validNumber(value)?`${Number(value)>=0?"+":""}${Number(value).toFixed(1)} points`:"applied";return `<span class="rookie-compare" title="Core home ${base}; rookie shadow ${shadow}; adjustment ${adjustment}; displayed tip unchanged">Shadow ${shadow}</span>`}
function policyMarketSignals(r,modelProbability=r.candidateP){const base=marketSignals(r,modelProbability),rawFlip=base.flip,protectedBy=[],flagOnly=state.competition==="NRLW"&&rawFlip;if(r.lineupGate)protectedBy.push("Lineup Adjustment");if(r.playerAlert)protectedBy.push(r.playerConsensus?"Player Consensus":"Player Alert");return {...base,rawFlip,flagOnly,flip:rawFlip&&!protectedBy.length&&!flagOnly,greyFlip:rawFlip&&Boolean(protectedBy.length),protectedBy,adverseMove:Boolean(base.adverseMove&&base.modelHome!==base.marketHome)}}
function policySwapIndicator(signal){if(!signal.rawFlip)return "";const model=Math.round(100*signal.model),market=Math.round(100*signal.current),modelEdge=Math.round(100*signal.modelConfidence),marketEdge=Math.round(100*signal.marketConfidence),gap=Math.round(100*signal.confidenceGap),outcome=signal.flagOnly?"review flag only - displayed NRLW tip unchanged":signal.greyFlip?`do not follow - superseded by ${signal.protectedBy.join(" + ")}`:"follow market";return `<span class="market-swap${signal.greyFlip||signal.flagOnly?" suppressed":""}" title="${esc(`ELO ${model}% v market ${market}%; ${marketEdge} - ${modelEdge} = ${gap}pp (10pp gate passed); ${outcome}`)}">&#8644;</span>`}
function pointText(value){return validNumber(value)?`${Number(value)>=0?"+":""}${Number(value).toFixed(1)} margin points`:"not applied"}
function teamListPlayerText(side){if(!side)return "details unavailable";const incoming=side.current.filter(player=>player.incoming).map(player=>`${player.name} (${player.role}, ${player.games}gp, ${pointText(player.homeMarginPoints)})`),outgoing=side.outgoing.map(player=>`${player.name} (${player.role}, ${player.games}gp, ${player.minutes}m)`);return `incoming ranked by impact: ${incoming.join("; ")||"none"}; outgoing regulars: ${outgoing.join("; ")||"none"}`}
function teamListComparison(r){if(!r.rookieGate&&! r.lineupGate)return "";if(state.competition==="NRLW")return `<span class="team-list-compare" title="${esc(`Displayed core: ${pct(r.candidateP)} | Rookie shadow: ${pct(r.gate6P)} (${pointText(r.rookieMargin)}) | displayed tip unchanged`)}">Core ${pct(r.candidateP)}</span>`;const lines=[`Base 2027 ELO: ${pct(r.bstarP)}`];if(r.rookieGate)lines.push(`Rookie Adjustment: ${pct(r.gate6P)} (${pointText(r.rookieMargin)})`);if(r.lineupGate)lines.push(`Lineup Adjustment selected: ${pct(r.stage4P)} (${pointText(r.lineupMargin)})`);lines.push(`Displayed 2027 ELO: ${pct(r.candidateP)}`);if(r.teamListDrivers){lines.push(`${r.home} - ${teamListPlayerText(r.teamListDrivers.home)}`);lines.push(`${r.away} - ${teamListPlayerText(r.teamListDrivers.away)}`)}return `<span class="team-list-compare" title="${esc(lines.join(" | "))}">Base ${pct(r.bstarP)}</span>`}
function playerImpact(r){if(!r.playerAlert)return "";const detail=r.playerDrivers,kind=r.playerConsensus?"Player Consensus: Full, Core and Creation profiles agree":"Player Alert: Full Player Profile only",changes=detail?` | Drivers: ${detail.top||"not archived"} | Home in: ${detail.homeIncoming||"none"} | Home out: ${detail.homeOutgoing||"none"} | Away in: ${detail.awayIncoming||"none"} | Away out: ${detail.awayOutgoing||"none"}`:"";return `<span class="player-impact ${r.playerConsensus?"consensus":"alert"}" title="${esc(`${kind} | Displayed ${pct(r.candidateP)} | Full ${pct(r.o10P)} | Core ${pct(r.o9P)} | Creation ${pct(r.creationP)}${changes}`)}">${r.playerConsensus?"C":"!"}</span>`}
function marketPerformance(rows){return metric(rows,r=>{const signal=policyMarketSignals(r);if(signal.current==null)return null;return correct(r,signal.current>=.5?r.home:r.away)})}
function swapGain(rows,probabilityFor){let base=0,overlaid=0;for(const r of rows){const probability=probabilityFor(r);if(!validNumber(probability)||actualWinner(r)==null)continue;const signal=policyMarketSignals(r,Number(probability)),baseTip=Number(probability)>=.5?r.home:r.away,overlayTip=signal.flip?(signal.current>=.5?r.home:r.away):baseTip;base+=correct(r,baseTip)?1:0;overlaid+=correct(r,overlayTip)?1:0}return overlaid-base}
function signed(value){return `${value>=0?"+":""}${value}`}

function renderGamesTable(rows){
  const details=getReplayDetails();let lastRound="",stripe=false;
  const body=rows.map(source=>{
    const r=source.finalsLabel?{...source,round:source.finalsLabel}:source;
    const d=details.get(Number(r.id))||{homeElo:r.projectedHomeElo,awayElo:r.projectedAwayElo,homeRank:r.projectedHomeRank,awayRank:r.projectedAwayRank},eloPick=modelTip(r),winner=actualWinner(r),completed=winner!==null,ladderPick=r.ladderTip||(d.homeRank<d.awayRank?r.home:r.away);
    const signal=policyMarketSignals(r),marketHome=signal.home,marketAway=signal.away,oddsPick=validNumber(marketHome)&&validNumber(marketAway)?(Number(marketHome)<=Number(marketAway)?r.home:r.away):eloPick,userPick=r.userTip||eloPick;
    const key=`${r.year}|${source.round}`,roundStart=key!==lastRound;if(roundStart){stripe=!stripe;lastRound=key}const rowClass=`${stripe?"round-a":"round-b"}${roundStart?" round-start":""}${r.projected?" projected-final":""}`;
    const underlying=r.candidateDr==null?null:Math.abs(marginCoefficient()*r.candidateDr),tipMargin=r.stableMargin??r.generalMargin,tipPoints=tipMargin==null?null:Math.abs(tipMargin),homeClass=eloPick===r.home?(completed?(winner===r.home?"team-pick-green":"team-pick-red"):"team-pick-green"):"",awayClass=eloPick===r.away?(completed?(winner===r.away?"team-pick-green":"team-pick-red"):"team-pick-green"):"";
    const oddsProbability=signal.current==null?"":` <span class="odds-prob">(${pct(signal.current)}${moveIndicator(signal)})</span>`;
    return `<tr class="${rowClass}"><td class="col-narrow">${r.year}</td><td class="col-narrow" title="${esc(r.round)}">${esc(r.round)}</td><td class="col-team ${homeClass}">${esc(r.home)}</td><td class="col-team ${awayClass}">${esc(r.away)}</td><td class="col-narrow">${pct(r.candidateP)}</td><td class="col-narrow">${r.hs??""}</td><td class="col-narrow">${r.as??""}</td><td class="col-narrow">${underlying==null?"—":`${underlying.toFixed(1)} (${tipPoints??"—"})`}</td><td class="col-narrow">${validNumber(d.homeElo)?Math.round(d.homeElo):"—"}</td><td class="col-narrow">${validNumber(d.awayElo)?Math.round(d.awayElo):"—"}</td><td class="col-narrow">${d.homeRank??"—"}</td><td class="col-narrow">${d.awayRank??"—"}</td><td class="col-pick">${esc(eloPick||"—")}${tipPoints!=null?` (${tipPoints})`:""}</td><td class="col-pip tip-cell">${rankPip(ladderPick,eloPick,winner,completed)}</td><td class="col-pip tip-cell">${pip(oddsPick,eloPick,winner,completed,`Odds pick: ${oddsPick||"unknown"}`)}</td><td class="col-pip tip-cell">${pip(userPick,eloPick,winner,completed,`Tip: ${userPick||"unknown"}`)}</td><td class="col-pick">${esc(winner||"")}</td><td class="col-status">${listTick(r)}</td><td class="col-price">${money(marketHome)} / ${money(marketAway)}${oddsProbability}</td><td class="col-rule">${swapIndicator(signal)}</td><td class="col-rookie">${rookieComparison(r)}</td></tr>`
  }).join("");
  return `<thead><tr><th class="col-narrow">Year</th><th class="col-narrow">Round</th><th class="col-team">Home</th><th class="col-team">Away</th><th class="col-narrow">Home<br>Win %</th><th class="col-narrow">Home<br>Score</th><th class="col-narrow">Away<br>Score</th><th class="col-narrow">Pred<br>Margin</th><th class="col-narrow">ELO (H)</th><th class="col-narrow">ELO (A)</th><th class="col-narrow">Rank (H)</th><th class="col-narrow">Rank (A)</th><th class="col-pick">ELO</th><th class="col-pip">Rank</th><th class="col-pip">Odds</th><th class="col-pip">Tip</th><th class="col-pick">Actual</th><th class="col-status">Teams</th><th class="col-price">Odds H / A (Home %)</th><th class="col-rule">Swap</th><th class="col-rookie">Rookie</th></tr></thead><tbody>${body}</tbody>`;
}

function renderGamesTableV110(rows){
  const details=getReplayDetails(),marketHeader=state.competition==="NRLW"?"Flag":"Swap";let lastRound="",stripe=false;
  const body=rows.map(source=>{
    const r=source.finalsLabel?{...source,round:source.finalsLabel}:source,d=(validNumber(r.homeElo)&&validNumber(r.awayElo)?{homeElo:r.homeElo,awayElo:r.awayElo,homeRank:r.homeRank,awayRank:r.awayRank}:details.get(Number(r.id)))||{homeElo:r.projectedHomeElo,awayElo:r.projectedAwayElo,homeRank:r.projectedHomeRank,awayRank:r.projectedAwayRank},eloPick=modelTip(r),winner=actualWinner(r),completed=winner!==null,ladderPick=r.ladderTip||(validNumber(d.homeRank)&&validNumber(d.awayRank)?(d.homeRank<d.awayRank?r.home:r.away):null),signal=policyMarketSignals(r),marketHome=signal.home,marketAway=signal.away,oddsPick=validNumber(marketHome)&&validNumber(marketAway)?(Number(marketHome)<=Number(marketAway)?r.home:r.away):null,userPick=r.userTip||eloPick;
    const key=`${r.year}|${source.round}`,roundStart=key!==lastRound;if(roundStart){stripe=!stripe;lastRound=key}const rowClass=`${stripe?"round-a":"round-b"}${roundStart?" round-start":""}${r.projected?" projected-final":""}`;
    const underlying=r.candidateDr==null?null:Math.abs(marginCoefficient()*r.candidateDr),tipMargin=r.stableMargin??r.generalMargin,tipPoints=tipMargin==null?null:Math.abs(tipMargin),homeClass=eloPick===r.home?(completed?(winner===r.home?"team-pick-green":"team-pick-red"):"team-pick-green"):"",awayClass=eloPick===r.away?(completed?(winner===r.away?"team-pick-green":"team-pick-red"):"team-pick-green"):"",oddsProbability=signal.current==null?"":` <span class="odds-prob">(${pct(signal.current)}${moveIndicator(signal)})</span>`;
    return `<tr class="${rowClass}"><td class="col-narrow">${r.year}</td><td class="col-narrow" title="${esc(r.round)}">${esc(r.round)}</td><td class="col-team ${homeClass}">${esc(r.home)}</td><td class="col-team ${awayClass}">${esc(r.away)}</td><td class="col-narrow">${pct(r.candidateP)}</td><td class="col-narrow">${r.hs??""}</td><td class="col-narrow">${r.as??""}</td><td class="col-narrow">${underlying==null?"&mdash;":`${underlying.toFixed(1)} (${tipPoints??"&mdash;"})`}</td><td class="col-narrow">${validNumber(d.homeElo)?Math.round(d.homeElo):"&mdash;"}</td><td class="col-narrow">${validNumber(d.awayElo)?Math.round(d.awayElo):"&mdash;"}</td><td class="col-narrow">${d.homeRank??"&mdash;"}</td><td class="col-narrow">${d.awayRank??"&mdash;"}</td><td class="col-pick">${esc(eloPick||"-")}${tipPoints!=null?` (${tipPoints})`:""}</td><td class="col-pip tip-cell">${rankPip(ladderPick,eloPick,winner,completed)}</td><td class="col-pip tip-cell">${pip(oddsPick,eloPick,winner,completed,`Odds pick: ${oddsPick||"unknown"}`)}</td><td class="col-pip tip-cell">${pip(userPick,eloPick,winner,completed,`Tip: ${userPick||"unknown"}`)}</td><td class="col-pick">${esc(winner||"")}</td><td class="col-status">${listTick(r)}</td><td class="col-price">${money(marketHome)} / ${money(marketAway)}${oddsProbability}</td><td class="col-rule">${policySwapIndicator(signal)}</td><td class="col-team-list">${teamListComparison(r)}</td><td class="col-player-impact">${playerImpact(r)}</td></tr>`;
  }).join("");
  return `<thead><tr><th class="col-narrow">Year</th><th class="col-narrow">Round</th><th class="col-team">Home</th><th class="col-team">Away</th><th class="col-narrow">Home<br>Win %</th><th class="col-narrow">Home<br>Score</th><th class="col-narrow">Away<br>Score</th><th class="col-narrow">Pred<br>Margin</th><th class="col-narrow">ELO (H)</th><th class="col-narrow">ELO (A)</th><th class="col-narrow">Rank (H)</th><th class="col-narrow">Rank (A)</th><th class="col-pick">ELO</th><th class="col-pip">Rank</th><th class="col-pip">Odds</th><th class="col-pip">Tip</th><th class="col-pick">Actual</th><th class="col-status">Teams</th><th class="col-price">Odds H / A (Home %)</th><th class="col-rule">${marketHeader}</th><th class="col-team-list">Team List</th><th class="col-player-impact">Player Impact</th></tr></thead><tbody>${body}</tbody>`;
}

function renderCurrent(){
  const competitionRows=state.competition==="NRLW"?seasonMatches(CURRENT_SEASON):state.current,completed=competitionRows.filter(r=>r.hs!=null&&r.as!=null), candidate=metric(completed,r=>correct(r,modelTip(r)));
  const odds=marketPerformance(completed),market=competitionRows.filter(r=>{const signal=policyMarketSignals(r);return signal.rawFlip||signal.adverseMove}).length,marketGain=swapGain(completed,r=>r.candidateP),publishedLists=state.competition==="NRLW"?competitionRows.filter(r=>r.lineupAvailable).length:competitionRows.filter(r=>r.teamList).length;
  const marginRows=completed.filter(r=>r.game===1&&isRegular(r.round)&&r.stableMargin!=null);
  const exact=marginRows.filter(r=>{const signed=(r.candidateP>=.5?1:-1)*Math.abs(r.stableMargin);return signed===r.hs-r.as}).length;
  if(state.competition==="NRLW"){
    const base=metric(completed,r=>correct(r,r.bstarP>=.5?r.home:r.away));
    const shadow=metric(completed,r=>correct(r,r.gate6P>=.5?r.home:r.away));
    $("#season-scorecards").innerHTML=`<span><b>NRLW core:</b> ${base.correct}/${base.games} (${pct(base.correct/base.games)})</span><span><b>Rookie shadow:</b> ${shadow.correct}/${shadow.games} (${pct(shadow.correct/shadow.games)})</span><span><b>Odds:</b> ${odds.games?`${odds.correct}/${odds.games} (${pct(odds.correct/odds.games)})`:"—"}</span><span><b>Market flags:</b> ${market} (review only)</span><span><b>Run-out lists:</b> ${publishedLists}/${competitionRows.length}</span>`;
    $("#current-updated").textContent=`Data cache through ${activeCache().meta.lastMatchDate.slice(0,10)}`;
  }else $("#season-scorecards").innerHTML=`<span><b>Candidate:</b> ${candidate.games?`${candidate.correct}/${candidate.games} (${pct(candidate.correct/candidate.games)})`:"—"}</span><span><b>Odds:</b> ${odds.games?`${odds.correct}/${odds.games} (${pct(odds.correct/odds.games)})`:"—"}</span><span><b>Pre-match lists:</b> ${publishedLists}</span><span title="Net correct-tip change from applying the confidence-swap rule on top of the candidate"><b>Market flags:</b> ${market} (${signed(marketGain)})</span><span><b>Margin exact:</b> ${exact}/${marginRows.length}</span>`;
  const regularAndOther=competitionRows.filter(r=>state.competition==="NRLW"||!FINALS_ROUNDS.some(round=>roundKey(round.label)===roundKey(r.round))),rows=(state.competition==="NRLW"?regularAndOther:[...regularAndOther,...projectedFinalsRows()]).sort((a,b)=>a.matchIndex-b.matchIndex);
  $("#current-table").innerHTML=renderGamesTableV110(rows);
  $$("#current-table tbody tr").forEach((tr,i)=>tr.dataset.matchId=rows[i].id);
  scrollToCurrentRound("#current-table",rows);
}

function populateSelectors(){
  const years=[...new Set(competitionMatches().map(r=>r.year))].sort((a,b)=>b-a);
  $("#ladder-year").innerHTML=years.map(y=>`<option>${y}</option>`).join("");$("#ladder-year").value=String(CURRENT_SEASON);
  $("#season-year").innerHTML=years.map(y=>`<option>${y}</option>`).join("");$("#season-year").value=String(CURRENT_SEASON);
  $("#history-year").innerHTML='<option value="all">All seasons</option>'+years.map(y=>`<option>${y}</option>`).join("");$("#history-year").value="all";
  $("#joker-year").innerHTML=(state.competition==="NRLW"?years:Object.keys(state.cache.joker).sort((a,b)=>b-a)).map(y=>`<option>${y}</option>`).join("");
  const teams=[...new Set(competitionMatches().flatMap(r=>[r.home,r.away]))].sort();
  $("#history-team").innerHTML='<option value="">All teams</option>'+teams.map(t=>`<option>${esc(t)}</option>`).join("");
  populateRatingControls(teams,years);
  updateLadderRounds(); renderMatrix(); renderJoker();
}

function seasonMatches(year){return state.competition==="NRL"&&Number(year)===CURRENT_SEASON&&state.current.length?state.current:competitionMatches().filter(r=>r.year===Number(year))}
function updateLadderRounds(){const year=Number($("#ladder-year").value),rounds=[...new Set(seasonMatches(year).filter(r=>isRegular(r.round)).map(r=>r.round))].sort((a,b)=>roundNumber(a)-roundNumber(b));$("#ladder-round").innerHTML=rounds.map(r=>`<option>${esc(r)}</option>`).join("");$("#ladder-round").value=rounds.at(-1)||"";renderLadder()}
function computeLadder(year,through){
  const rows=seasonMatches(year).filter(r=>isRegular(r.round)&&roundNumber(r.round)<=roundNumber(through));
  const active=[...new Set(seasonMatches(year).filter(r=>isRegular(r.round)).flatMap(r=>[r.home,r.away]))], table=Object.fromEntries(active.map(t=>[t,{team:t,points:0,for:0,against:0}]));
  for(const round of [...new Set(rows.map(r=>r.round))].sort((a,b)=>roundNumber(a)-roundNumber(b))){const games=rows.filter(r=>r.round===round),played=new Set(games.flatMap(r=>[r.home,r.away]));for(const r of games){if(r.hs==null||r.as==null)continue;const h=table[r.home],a=table[r.away];h.for+=r.hs;h.against+=r.as;a.for+=r.as;a.against+=r.hs;if(r.hs>r.as)h.points+=2;else if(r.as>r.hs)a.points+=2;else{h.points++;a.points++}}for(const t of active)if(!played.has(t))table[t].points+=2}
  return Object.values(table).map(r=>({...r,diff:r.for-r.against})).sort((a,b)=>b.points-a.points||b.diff-a.diff||b.for-a.for);
}
function ratingsAt(year,round){
  if(state.competition==="NRLW"){
    const season=seasonMatches(year),through=roundNumber(round),ratings={};
    for(const team of new Set(season.flatMap(r=>[r.home,r.away]))){const first=season.find(r=>r.home===team||r.away===team);ratings[team]=first?(first.home===team?first.homeElo:first.awayElo):1500}
    for(const row of season.filter(r=>roundNumber(r.round)<=through)){ratings[row.home]=row.homePostElo;ratings[row.away]=row.awayPostElo}
    return ratings;
  }
  const matches=state.cache.matches.map(r=>({year:r.year,round:r.round,match_index:r.matchIndex,home_team:r.home,away_team:r.away,home_score:r.hs,away_score:r.as}));
  const teams=[...new Set(matches.flatMap(r=>[r.home_team,r.away_team]))].map(name=>({name}));
  const p=MODELS.production2026.parameters,engine=createReplayEngine(p,teams),replay=engine.replayMatches(matches,{applyByes:false,stopAt:{year,round}});return replay.state.ratings;
}
function renderLadder(){const year=Number($("#ladder-year").value),round=$("#ladder-round").value,rows=computeLadder(year,round),ratings=ratingsAt(year,round);$("#ladder-table").innerHTML=`<thead><tr><th>#</th><th>Team</th><th>Pts</th><th>For</th><th>Against</th><th>Diff</th><th>Elo</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${i+1}</td><td class="team"><img src="${logo(r.team)}" width="18" height="18" alt="" onerror="this.style.display='none'"> ${esc(r.team)}</td><td><b>${r.points}</b></td><td>${r.for}</td><td>${r.against}</td><td>${r.diff>0?"+":""}${r.diff}</td><td>${Math.round(ratings[r.team]??1500)}</td></tr>`).join("")}</tbody>`}

function seasonEndRatings(year){
  if(state.competition==="NRLW")return state.nrlwCache.ratingsByYear?.[String(year)]||{};
  const source=allDisplayMatches().filter(r=>r.year<=year),matches=source.map(r=>({year:r.year,round:r.round,match_index:r.matchIndex,home_team:r.home,away_team:r.away,home_score:r.hs,away_score:r.as}));
  const teams=[...new Set(matches.flatMap(r=>[r.home_team,r.away_team]))].map(name=>({name}));
  return createReplayEngine(MODELS.production2026.parameters,teams).replayMatches(matches,{applyByes:true}).state.ratings;
}

function renderMatrix(){
  const year=Number($("#season-year").value),matches=[...seasonMatches(year)].sort((a,b)=>a.matchIndex-b.matchIndex),teams=[...new Set(matches.flatMap(r=>[r.home,r.away]))],rounds=[...new Set(matches.map(r=>r.round))];
  const cumulative=Object.fromEntries(teams.map(t=>[t,0])),roundPoints=Object.fromEntries(rounds.map(r=>[r,{}]));
  for(const round of rounds){
    const games=matches.filter(m=>m.round===round),played=new Set();
    for(const m of games){
      played.add(m.home);played.add(m.away);const complete=m.hs!=null&&m.as!=null,p=m.candidateP??getReplayDetails().get(Number(m.id))?.coreP??.5;
      let hp,ap,ht,at;
      if(complete){if(m.hs>m.as){hp=2;ap=0;ht="win";at="loss"}else if(m.as>m.hs){hp=0;ap=2;ht="loss";at="win"}else{hp=1;ap=1;ht=at="draw"}}
      else{hp=2*p;ap=2*(1-p);ht=p>=.5?"pred-win":"pred-loss";at=p<.5?"pred-win":"pred-loss"}
      cumulative[m.home]+=hp;cumulative[m.away]+=ap;
      roundPoints[round][m.home]={pts:cumulative[m.home],type:ht,opponent:m.away};roundPoints[round][m.away]={pts:cumulative[m.away],type:at,opponent:m.home};
    }
    if(isRegular(round))for(const team of teams)if(!played.has(team)){cumulative[team]+=2;roundPoints[round][team]={pts:cumulative[team],type:"bye",opponent:null}}
  }
  const ratings=seasonEndRatings(year),ladder=teams.map(team=>({team,points:cumulative[team],rating:Math.round(ratings[team]??1500)})).sort((a,b)=>b.points-a.points||b.rating-a.rating||a.team.localeCompare(b.team));
  $("#season-matrix-table").innerHTML=`<thead><tr><th class="matrix-team">Team</th><th class="matrix-rank">Rank</th><th class="matrix-elo">ELO</th>${rounds.map(r=>`<th class="round-col">${esc(r)}</th>`).join("")}</tr></thead><tbody>${ladder.map((row,index)=>`<tr><td class="matrix-team"><img class="team-logo" src="${logo(row.team)}" alt="" onerror="this.style.display='none'">${esc(row.team)}</td><td>${index+1}</td><td>${row.rating}</td>${rounds.map(round=>{const cell=roundPoints[round][row.team];if(!cell)return "<td></td>";const points=Math.abs(cell.pts-Math.round(cell.pts))<.001?cell.pts.toFixed(0):cell.pts.toFixed(2),opponent=cell.opponent?`<img class="matrix-opponent-logo" src="${logo(cell.opponent)}" title="${esc(cell.opponent)}" alt="" onerror="this.style.display='none'">`:"";return `<td class="${cell.type}">${points}${opponent}</td>`}).join("")}</tr>`).join("")}</tbody>`;
}

function renderHistory(){
  const selectedYear=$("#history-year").value,team=$("#history-team").value,q=$("#history-search").value.toLowerCase();
  const signature=`${state.competition}|${selectedYear}|${team}|${q}|${state.current.length}|${state.current.at(-1)?.hs}|${state.current.at(-1)?.as}`;
  if(state.historySignature===signature){const rows=selectedYear==="all"?allDisplayMatches():seasonMatches(Number(selectedYear));scrollToCurrentRound("#history-table",rows);return}
  const rows=(selectedYear==="all"?allDisplayMatches():seasonMatches(Number(selectedYear))).filter(r=>(!team||r.home===team||r.away===team)&&(!q||`${r.round} ${r.venue}`.toLowerCase().includes(q))).sort((a,b)=>a.year-b.year||a.matchIndex-b.matchIndex);
  const meta=activeCache().meta;
  $("#history-cache-note").innerHTML=`${rows.length} matching games · all results shown in chronological order${state.competition==="NRLW"?` · live RLDB through ${esc(meta.lastMatchDate?.slice(0,10)||meta.lastSeason)} · historical odds ${meta.oddsCoverage}/${meta.completedMatches}`:""}`;
  const summary=$("#nrlw-model-summary");
  if(state.competition==="NRLW"){const comparison=state.nrlwCache.comparison.overall,a=comparison.withoutRookie,b=comparison.withRookie;summary.classList.remove("hidden");summary.innerHTML=`<b>${esc(meta.model)}:</b> NRLW core ${a.correct}/${a.games} (${pct(a.accuracy)}) · Rookie Gate 6 shadow ${b.correct}/${b.games} (${pct(b.accuracy)}) · ${b.correct-a.correct>=0?"+":""}${b.correct-a.correct} tips. Rookie and market signals are flags only; neither changes the displayed tip.`}else summary.classList.add("hidden");
  $("#history-table").innerHTML=renderGamesTableV110(rows);
  $$("#history-table tbody tr").forEach((tr,i)=>tr.dataset.matchId=rows[i].id);
  state.historySignature=signature;
  scrollToCurrentRound("#history-table",rows);
}

function renderAccuracy(){
  if(state.competition==="NRLW"){
    const rows=state.nrlwCache.comparison.yearly,fmt=m=>`${m.correct}/${m.games} (${pct(m.accuracy)})`;
    $("#accuracy-table").innerHTML=`<thead><tr><th>Season</th><th>Games</th><th>NRLW core</th><th>Rookie shadow</th><th>Shadow tip change</th><th>Rookie gates</th><th>Core Brier</th><th>Shadow Brier</th><th>Core margin MAE</th><th>Shadow margin MAE</th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${r.year}</b></td><td>${r.withoutRookie.games}</td><td>${fmt(r.withoutRookie)}</td><td>${fmt(r.withRookie)}</td><td>${signed(r.withRookie.correct-r.withoutRookie.correct)}</td><td>${r.rookieApplied}</td><td>${r.withoutRookie.brier.toFixed(4)}</td><td>${r.withRookie.brier.toFixed(4)}</td><td>${r.withoutRookie.marginMae.toFixed(2)}</td><td>${r.withRookie.marginMae.toFixed(2)}</td></tr>`).join("")}</tbody>`;
    $("#performance-note").textContent=`${state.nrlwCache.meta.model} is the displayed full-history NRLW fit. Rookie Gate 6 is shadow-only: it starts with ${state.nrlwCache.meta.rookieTrainingGamesMin} training games, reaches ${state.nrlwCache.meta.rookieTrainingGamesMax}, and fires in ${state.nrlwCache.meta.rookieApplied}/${state.nrlwCache.meta.completedMatches} completed matches without changing the published tip. Market disagreement is also flag-only.`;
    $("#historical-comparison-details").hidden=true;
    renderCharts($("#performance-model").value==="bstar"?"bstar":"candidate");
    return;
  }
  $("#performance-note").textContent="* Historical forecasts reconstructed from recovered parameters with a 2009 start; not saved predictions. 2026 is the observed result. Parenthesised +/- values are retrospective market-swap overlays. Selected replay retains the website's 1998 history.";
  $("#historical-comparison-details").hidden=false;
  const which=$("#performance-model").value,fmt=m=>m?.games?`${m.correct}/${m.games} (${pct(m.correct/m.games)})`:"—",probabilityFor=r=>which==="production"?(r.productionP??r.bstarP):which==="bstar"?r.bstarP:r.candidateP;
  $("#accuracy-table").innerHTML=`<thead><tr><th>Season</th><th>Model used</th><th>Expected</th><th>Actual forecast</th><th>Selected replay</th><th>Ladder</th><th>Opening</th><th>Effective close</th><th>Margin exact</th><th>Margin error</th></tr></thead><tbody>${state.cache.performance.map(r=>{
    const selected=r[which],games=state.cache.matches.filter(m=>m.year===r.year&&m.hs!=null&&m.as!=null),actualGain=r.actualForecast?swapGain(games,m=>r.actualForecast.status==="reconstructed"?m.actualForecastP:m.productionP??m.bstarP):null,selectedGain=swapGain(games,probabilityFor),adjustedSelected=(selected?.correct??0)+selectedGain,withGain=(metricValue,gain)=>metricValue?.games?`${fmt(metricValue)} <span class="overlay-gain ${gain>0?"positive":gain<0?"negative":"neutral"}">(${signed(gain)})</span>`:"—",versusReplay=marketMetric=>{if(!marketMetric?.games)return "—";const difference=marketMetric.correct-adjustedSelected;return `${fmt(marketMetric)} <span class="overlay-gain ${difference>0?"positive":difference<0?"negative":"neutral"}" title="Correct-tip difference versus selected replay after its recommended swaps; odds coverage may differ">(${signed(difference)})</span>`};
    const reconstructed=r.actualForecast?.status==="reconstructed",forecastNote=reconstructed?`Reconstructed from recovered ${r.year} parameters, 1500 start in 2009; not an archived forecast. ${r.actualForecast.marginGames?`First-of-round margin: ${r.actualForecast.marginExact}/${r.actualForecast.marginGames} exact, cumulative error ${r.actualForecast.marginError}.`:"Historical margin rule not supplied."}`:r.actualForecast?"Observed 2026 regular-season result; 130/204. Swap overlay is retrospective.":"Historical parameters and forecasts have not been recovered.";
    return `<tr><td><b>${r.year}</b></td><td title="${esc(forecastNote)}">${esc(r.modelUsed||"Not archived")}${reconstructed?" *":""}</td><td>${r.expected?pct(r.expected):"—"}</td><td title="${esc(forecastNote)}">${withGain(r.actualForecast,actualGain)}</td><td>${withGain(selected,selectedGain)}</td><td>${fmt(r.ladder)}</td><td>${versusReplay(r.open)}</td><td>${versusReplay(r.close)}</td><td>${r.margin.games?`${r.margin.exact}/${r.margin.games}`:"—"}</td><td>${r.margin.games?r.margin.error:"—"}</td></tr>`
  }).join("")}</tbody>`;
  renderCharts(which)
  renderHistoricalComparison()
}
function renderHistoricalComparison(){
  const comparison=state.historicalComparison;if(!comparison)return;
  const models=comparison.models,years=[...new Set(comparison.yearly.map(r=>r.year))],lookup=new Map(comparison.yearly.map(r=>[`${r.model}|${r.year}`,r]));
  const renderRow=(label,rows)=>{
    const scores=rows.filter(Boolean).map(r=>r.correct),low=Math.min(...scores),high=Math.max(...scores);
    const cells=rows.map(row=>{
      if(!row)return "<td>—</td>";
      const strength=high===low?.5:(row.correct-low)/(high-low),weak=[245,229,226],neutral=[250,248,241],strong=[216,235,220],from=strength<=.5?weak:neutral,to=strength<=.5?neutral:strong,blend=strength<=.5?strength*2:(strength-.5)*2,color=from.map((channel,index)=>Math.round(channel+(to[index]-channel)*blend)),best=high>low&&row.correct===high;
      const description=high===low?"All models tied":`${best?"Strongest (including ties)":row.correct===low?"Weakest (including ties)":`${high-row.correct} tips behind strongest`} in this row`;
      return `<td class="comparison-heat${best?" comparison-best":""}" style="background-color:rgb(${color.join(",")})" title="${description} · Brier ${row.brier.toFixed(4)} · log loss ${row.logLoss.toFixed(4)}">${row.correct} (${pct(row.accuracy)})</td>`
    }).join("");
    return `<tr><td><b>${esc(label)}</b></td><td>${rows.find(Boolean)?.games??"—"}</td>${cells}</tr>`
  };
  $("#historical-comparison-table").innerHTML=`<caption>Within each row: pale red = weakest, pale green = strongest; tied scores share a colour.</caption><thead><tr><th>Season</th><th>Games</th>${models.map(m=>`<th>${esc(m.label)}</th>`).join("")}</tr></thead><tbody>${years.map(year=>renderRow(year,models.map(m=>lookup.get(`${m.id}|${year}`)))).join("")}${["2009–2026","2022–2026"].map(period=>renderRow(period,models.map(m=>comparison.periods.find(r=>r.period===period&&r.model===m.id)))).join("")}</tbody>`
}
function destroyChart(name){state.charts[name]?.destroy();state.charts[name]=null}
function quantile(values,q){if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b),position=(sorted.length-1)*q,lower=Math.floor(position),fraction=position-lower;return sorted[lower]+(sorted[Math.min(lower+1,sorted.length-1)]-sorted[lower])*fraction}
function chartProbability(r,which){if(state.competition==="NRLW")return which==="bstar"?r.gate6P:r.candidateP;return which==="production"?(r.productionP??r.bstarP):which==="bstar"?r.bstarP:r.candidateP}
function calibrationBins(rows,which){const bins=Array.from({length:10},()=>({n:0,w:0,p:0}));for(const r of rows){const probability=chartProbability(r,which);if(!validNumber(probability))continue;const p=Number(probability),bin=Math.min(9,Math.floor(p*10));bins[bin].n++;bins[bin].p+=p;bins[bin].w+=r.hs===r.as?.5:r.hs>r.as?1:0}return bins.map((bin,index)=>({x:index*10+5,y:bin.n?100*bin.w/bin.n:null,n:bin.n,w:bin.w,meanP:bin.n?100*bin.p/bin.n:null,binLow:index*10,binHigh:(index+1)*10}))}
function linearFit(points){if(points.length<2)return null;const meanX=points.reduce((sum,p)=>sum+p.x,0)/points.length,meanY=points.reduce((sum,p)=>sum+p.y,0)/points.length,denominator=points.reduce((sum,p)=>sum+(p.x-meanX)**2,0);if(!denominator)return null;const slope=points.reduce((sum,p)=>sum+(p.x-meanX)*(p.y-meanY),0)/denominator,intercept=meanY-slope*meanX;return {slope,intercept}}
function renderCharts(which){
  const allYears=state.competition==="NRLW"?state.nrlwCache.comparison.yearly.map(r=>r.year):state.cache.performance.map(r=>r.year),years=allYears.slice(-5),rows=activeCache().matches.filter(r=>allYears.includes(r.year)&&r.hs!=null&&r.as!=null);destroyChart("calibration");destroyChart("margin");
  const seasonBins=new Map(allYears.map(year=>[year,calibrationBins(rows.filter(r=>r.year===year),which)])),overall=calibrationBins(rows,which),rangeLow=[],rangeHigh=[];
  for(let index=0;index<10;index++){const observed=allYears.map(year=>seasonBins.get(year)[index]).filter(bin=>bin.n>0).map(bin=>bin.y),base={x:index*10+5,binLow:index*10,binHigh:(index+1)*10};rangeLow.push({...base,y:quantile(observed,.10)});rangeHigh.push({...base,y:quantile(observed,.90)})}
  const colors=[.18,.28,.4,.58,1],recentDatasets=years.map((year,index)=>({label:String(year),data:seasonBins.get(year),borderColor:`rgba(35,106,75,${colors[index]})`,backgroundColor:`rgba(35,106,75,${colors[index]})`,borderWidth:index===years.length-1?3:2,tension:.25,spanGaps:true}));
  const rangeDatasets=[{label:"80% season range lower",data:rangeLow,borderColor:"transparent",backgroundColor:"transparent",pointRadius:0,spanGaps:true,showTooltip:false},{label:"Middle 80% of seasons",data:rangeHigh,borderColor:"rgba(100,110,105,.28)",backgroundColor:"rgba(100,110,105,.14)",pointRadius:0,fill:"-1",spanGaps:true,showTooltip:false}];
  const overallDataset={label:`Overall ${allYears[0]}–${allYears.at(-1)}`,data:overall,borderColor:"#111",backgroundColor:"#111",borderWidth:3,pointRadius:3,tension:.2,spanGaps:true};
  state.charts.calibration=new Chart($("#calibration-chart"),{type:"line",data:{datasets:[{label:"Perfect calibration",data:[{x:0,y:0},{x:100,y:100}],borderColor:"#aeb5af",borderDash:[5,5],pointRadius:0,showTooltip:false},...rangeDatasets,overallDataset,...recentDatasets]},options:{responsive:true,interaction:{mode:"nearest",intersect:false},plugins:{legend:{labels:{filter:item=>item.text!=="80% season range lower"}},tooltip:{filter:item=>item.dataset.showTooltip!==false,callbacks:{title:items=>items.length?`Predicted ${items[0].raw.binLow}–${items[0].raw.binHigh}%`:"",label:context=>{const point=context.raw,wins=Number.isInteger(point.w)?point.w:point.w?.toFixed(1);return point.n?`${context.dataset.label}: ${point.y.toFixed(1)}% (${wins}/${point.n}); mean forecast ${point.meanP.toFixed(1)}%`:context.dataset.label}}}},scales:{x:{type:"linear",min:0,max:100,title:{display:true,text:"Predicted home win %"}},y:{min:0,max:100,title:{display:true,text:"Observed home win %"}}}}});

  const chartSeason=state.competition==="NRLW"?state.nrlwCache.meta.lastSeason:CURRENT_SEASON,current=rows.filter(r=>r.year===chartSeason&&r.candidateDr!=null),coefficient=marginCoefficient(),scatter=current.map(r=>({x:coefficient*r.candidateDr,y:r.hs-r.as,match:`${r.home} v ${r.away}`})),fit=linearFit(scatter),extent=Math.max(50,...scatter.flatMap(point=>[Math.abs(point.x),Math.abs(point.y)])),limit=Math.ceil(extent/10)*10,xMin=-limit,xMax=limit;
  const regression=fit?[{x:xMin,y:fit.intercept+fit.slope*xMin},{x:xMax,y:fit.intercept+fit.slope*xMax}]:[],bucketLine=current.filter(r=>validNumber(r.stableMargin)).map(r=>{const x=coefficient*r.candidateDr;return {x,y:(x>=0?1:-1)*Math.abs(Number(r.stableMargin))}}).sort((a,b)=>a.x-b.x);
  state.charts.margin=new Chart($("#margin-chart"),{type:"scatter",data:{datasets:[{label:String(chartSeason),data:scatter,backgroundColor:"rgba(35,106,75,.48)",pointRadius:3},{label:fit?`Best fit: y = ${fit.slope.toFixed(2)}x ${fit.intercept>=0?"+":"−"} ${Math.abs(fit.intercept).toFixed(2)}`:"Best fit",type:"line",data:regression,borderColor:"#111",borderWidth:2,pointRadius:0},{label:"Submitted margin buckets",type:"line",data:bucketLine,borderColor:"#68447d",borderWidth:2,pointRadius:0,stepped:"middle"},{label:"Perfect",type:"line",data:[{x:xMin,y:xMin},{x:xMax,y:xMax}],borderColor:"#bd852d",borderDash:[5,5],pointRadius:0}]},options:{responsive:true,interaction:{mode:"nearest",intersect:false},plugins:{tooltip:{callbacks:{label:context=>{const point=context.raw;if(point.match)return `${point.match}: predicted ${point.x.toFixed(1)}, actual ${point.y}`;if(context.dataset.label==="Submitted margin buckets")return `Submitted home margin: ${point.y>0?"+":""}${point.y}`;return `${context.dataset.label}: ${point.y.toFixed(1)}`}}}},scales:{x:{min:xMin,max:xMax,title:{display:true,text:"Underlying predicted home margin"}},y:{min:-limit,max:limit,title:{display:true,text:"Actual home margin"}}}}})
}

function heatCount(v){return v<=0?"heat-red":v<=1?"heat-yellow":"heat-green"}
function heatEv(ev,games){const ratio=games?ev/games:0;return ratio<.56?"heat-red":ratio<.62?"heat-yellow":"heat-green"}
function renderJoker(){
  const year=Number($("#joker-year").value);
  if(state.competition==="NRLW"){
    const matches=seasonMatches(year).filter(r=>isRegular(r.round)),rounds=[...new Set(matches.map(r=>r.round))].map(round=>{
      const games=matches.filter(r=>r.round===round),row={round,c10:0,c15:0,c20:0,c25:0,c30:0,baseEv:0,rookieEv:0,baseActual:0,rookieActual:0,games:games.length};
      for(const game of games){const confidence=Math.max(game.candidateP,1-game.candidateP),shadowConfidence=Math.max(game.gate6P,1-game.gate6P);if(confidence>=.6)row.c10++;if(confidence>=.65)row.c15++;if(confidence>=.7)row.c20++;if(confidence>=.75)row.c25++;if(confidence>=.8)row.c30++;row.baseEv+=confidence;row.rookieEv+=shadowConfidence;row.baseActual+=correct(game,game.candidateP>=.5?game.home:game.away)?1:0;row.rookieActual+=correct(game,game.gate6P>=.5?game.home:game.away)?1:0}
      return row;
    }).sort((a,b)=>roundNumber(a.round)-roundNumber(b.round));
    const selected=[...rounds].sort((a,b)=>b.rookieEv-a.rookieEv).slice(0,2).map(r=>r.round);
    $("#joker-summary").innerHTML=`NRLW round selection uses the displayed core probability. Rookie EV is a shadow comparison only. Highest two shadow rounds: <b>${selected.map(esc).join(", ")||"—"}</b>.`;
    $("#joker-table").innerHTML=`<thead><tr><th>Round</th><th>10%</th><th>15%</th><th>20%</th><th>25%</th><th>30%</th><th>Core EV</th><th>Rookie shadow EV</th><th>Core actual</th><th>Shadow actual</th><th>Games</th></tr></thead><tbody>${rounds.map(r=>`<tr><td>${esc(r.round)}</td><td class="${heatCount(r.c10)}">${r.c10}</td><td class="${heatCount(r.c15)}">${r.c15}</td><td class="${heatCount(r.c20)}">${r.c20}</td><td class="${heatCount(r.c25)}">${r.c25}</td><td class="${heatCount(r.c30)}">${r.c30}</td><td class="${heatEv(r.baseEv,r.games)}">${r.baseEv.toFixed(2)}</td><td class="${heatEv(r.rookieEv,r.games)} ${selected.includes(r.round)?"top-broncos":""}">${r.rookieEv.toFixed(2)}</td><td>${r.baseActual}</td><td>${r.rookieActual}</td><td>${r.games}</td></tr>`).join("")}</tbody>`;
    return;
  }
  const data=state.cache.joker[String(year)];if(!data)return;$("#joker-summary").innerHTML=`Frozen with <b>${esc(data.model)}</b>. Key rounds: <b>${data.selected.map(esc).join(", ")}</b>.`;$("#joker-table").innerHTML=`<thead><tr><th>Round</th><th>10%</th><th>15%</th><th>20%</th><th>25%</th><th>30%</th><th>Elo Pick</th><th>Broncos Pick</th><th>Actual</th><th>Games</th></tr></thead><tbody>${data.rows.map(r=>`<tr><td>${esc(r.round)}</td><td class="${heatCount(r.c10)}">${r.c10}</td><td class="${heatCount(r.c15)}">${r.c15}</td><td class="${heatCount(r.c20)}">${r.c20}</td><td class="${heatCount(r.c25)}">${r.c25}</td><td class="${heatCount(r.c30)}">${r.c30}</td><td class="${heatEv(r.eloEv,r.games)}">${r.eloEv.toFixed(2)}</td><td class="${heatEv(r.broncosEv,r.games)} ${r.selected?"top-broncos":""}">${r.broncosEv.toFixed(2)}</td><td>${r.actual}</td><td>${r.games}</td></tr>`).join("")}</tbody>`
}

function renderModel(){const p=ACTIVE_MODEL.parameters;$("#model-content").innerHTML=`
  <article class="model-card"><h2>B* core Elo</h2><div class="parameter-grid">${Object.entries(p).slice(0,10).map(([k,v])=>`<span>${esc(k)}</span><span>${esc(v)}</span>`).join("")}</div><h3>Pre-match strength</h3><div class="formula">actualRestAdj = 5 × (homeRestDays − awayRestDays) / 7\n\nDR_B* = (Rhome − Raway) + 40\n      + 15 × awayTravelKm / 1000\n      + actualRestAdj\n      + 2.15 × (homeStreak − awayStreak)\n\nP(home) = 1 / (1 + 10^(−DR_B* / 400))</div></article>
  <article class="model-card"><h2>Rookie Gate 6</h2><p>A prediction-only lineup adjustment. It does not flow into the zero-sum Elo ledger.</p><div class="formula">raw = β₀ × Δdebutants\n    + β₅ × Δunder5\n    + β₂₀ × Δunder20\n\nlineupMargin = clamp(raw, −18, +18)\napply only when |lineupMargin| ≥ 6\n\nDR_candidate = DR_B* + lineupMargin / 0.048406</div><p class="muted">Eight-year prior-only fit · ridge 300 · nested player counts. Non-NRL senior experience remains a deployment prerequisite.</p></article>
  <article class="model-card"><h2>Stable discrete margin</h2><p>The submitted margin is selected separately from winner probability.</p><div class="formula">x = |0.048406 × Gate6_DR|\nwⱼ = exp(−0.5 × ((xⱼ − x) / 1.5)²)\n   × 2^(−gamesAgo / 1000)\n\nchoose even a ∈ {2,4,…,32}\nminimising weighted mean |actual aligned margin − a|</div></article>
  <article class="model-card"><h2>Market review rules</h2><p><b>Odds never enter Elo.</b> Paired prices are converted to a no-vig probability and used only as a review layer.</p><div class="formula">pH = (1 / home $) / ((1 / home $) + (1 / away $))\n\nmodelConfidence  = |modelP − 0.50|\nmarketConfidence = |marketP − 0.50|\n\n⇄ when tips disagree and\nmarketConfidence − modelConfidence ≥ 0.10\n\n📉 when marketP moves ≥0.10 away from the Elo tip</div><p class="muted">The swap is a proposed tipping rule, not an Elo input. The movement marker is review-only and uses comparable opening/current paired prices.</p></article>
  <article class="model-card wide"><h2>Version boundary</h2><p><b>${esc(ACTIVE_MODEL.id)}</b> is a preview candidate. The production 2026 formula remains available as a control and has not been altered. Historical ratings are reconstructed under a named core method; historical forecast claims require an archived prediction.</p></article>`}

function renderNrlwModel(){const meta=state.nrlwCache.meta,parameters=meta.parameters,a=state.nrlwCache.comparison.overall.withoutRookie,b=state.nrlwCache.comparison.overall.withRookie;$("#model-content").innerHTML=`
  <article class="model-card wide policy-card"><h2>${esc(meta.model)} tipping policy</h2><p>The displayed tip is the full-history NRLW core. Rookie Gate 6 and the 10-point market disagreement rule are <b>review flags only</b>; neither automatically changes the tip. NRL Stage 4C and Player Impact are not applied.</p></article>
  <article class="model-card"><h2>NRLW core</h2><div class="parameter-grid">${Object.entries(parameters).map(([k,v])=>`<span>${esc(k)}</span><span>${esc(v)}</span>`).join("")}</div><div class="formula">DR = rating difference
   + 5 x rest-week difference
   + 2 x streak difference

P(home) = 1 / (1 + 10^(-DR / 150))

update = 28 x 0.75 x (|margin| / 6)^0.75
       x (actual - expected)</div><p class="muted">Zero home and travel adjustments. New teams enter at 1400. Between seasons, ratings regress toward 1500 with weight 0.75.</p></article>
  <article class="model-card"><h2>Rookie Gate 6 shadow</h2><p>Prior-season nested NRLW appearance counts for debutants, under-five and under-20 players; ridge 300, capped at 18 margin points and applied from six.</p><div class="formula">Core: ${a.correct}/${a.games} (${pct(a.accuracy)})
Rookie shadow: ${b.correct}/${b.games} (${pct(b.accuracy)})
Difference: ${signed(b.correct-a.correct)} tips
Gate applications: ${meta.rookieApplied}/${meta.completedMatches}</div><p class="muted">This is monitored but never substituted for the core probability.</p></article>
  <article class="model-card"><h2>Market review flag</h2><p>Odds never enter Elo. A marker appears when model and market tips disagree and the market is at least 10 percentage points more confident.</p><div class="formula">model confidence = |modelP - 0.50|
market confidence = |marketP - 0.50|

flag when tips disagree and
market confidence - model confidence &gt;= 0.10</div><p class="muted">Flag only: the displayed model tip remains unchanged.</p></article>
  <article class="model-card"><h2>Data boundary</h2><p>${meta.completedMatches} completed matches from ${meta.firstSeason}–${meta.lastSeason}; run-out list coverage ${meta.lineupCoverage}/${meta.completedMatches}; historical odds ${meta.oddsCoverage}/${meta.completedMatches}.</p><p class="muted">Match and team-list data come exclusively from the installed live RLDB. Odds are an external comparison layer.</p></article>
  <article class="model-card wide"><h2>Version boundary</h2><p><b>${esc(meta.model)}</b> is the named NRLW deployment. Core parameters were selected on the complete NRLW history; the shadow diagnostics remain explicitly outside the published-tip policy.</p></article>`}

function renderModelV110(){if(state.competition==="NRLW"){renderNrlwModel();return}const p=ACTIVE_MODEL.parameters,systems=Object.values(SYSTEMS);$("#model-content").innerHTML=`
  <article class="model-card wide policy-card"><h2>Tipping policy - ${esc(ACTIVE_MODEL.id)}</h2><ol>${TIPPING_POLICY.map(rule=>`<li>${esc(rule)}</li>`).join("")}</ol><p class="policy-example"><b>Yellow flag against an 80% market:</b> the registered policy still follows the Player Alert, after checking that the team list and market timestamp are current. Record any manual override.</p><p class="muted">Precedence: Player Consensus &gt; Player Alert &gt; protected Lineup Adjustment &gt; active Market Swap &gt; displayed 2027 ELO.</p></article>
  <article class="model-card"><h2>Base 2027 ELO <small>${SYSTEMS.elo.id}</small></h2><div class="parameter-grid">${Object.entries(p).slice(0,10).map(([k,v])=>`<span>${esc(k)}</span><span>${esc(v)}</span>`).join("")}</div><h3>Pre-match strength</h3><div class="formula">actualRestAdj = 5 x (homeRestDays - awayRestDays) / 7\n\nDR_base = (Rhome - Raway) + 40\n        + 15 x awayTravelKm / 1000\n        + actualRestAdj\n        + 2.15 x (homeStreak - awayStreak)\n\nP(home) = 1 / (1 + 10^(-DR_base / 400))</div></article>
  <article class="model-card"><h2>Team-list selection</h2><p><b>Rookie Adjustment (${SYSTEMS.rookie.id})</b> is Gate 6: prior-only nested debutant, under-5 and under-20 counts, capped at 18 margin points and applied from 6.</p><p><b>Lineup Adjustment (${SYSTEMS.lineup.id})</b> is Stage 4C: role-weighted expected minutes. It replaces, rather than adds to, Rookie Adjustment only when it reverses a Base ELO tip that began at least 60/40.</p><div class="formula">P_rookie = Gate6(Base ELO)\nP_lineup = Stage4 role/minutes model\n\nP_display = P_lineup  if strong Stage4C overturn\n            P_rookie  otherwise</div><p class="muted">Neither prediction-only adjustment flows into the zero-sum ELO ledger.</p></article>
  <article class="model-card"><h2>Player Impact</h2><p><b>Player Alert</b> (yellow) means ${SYSTEMS.playerFull.label} reverses the displayed tip. <b>Player Consensus</b> (green) means Full, Core and Creation profiles all support that same reversal.</p><div class="version-list">${[SYSTEMS.playerFull,SYSTEMS.playerCore,SYSTEMS.creation].map(system=>`<div><b>${esc(system.id)}</b><span>${esc(system.development)}</span></div>`).join("")}</div><p class="muted">These signals are decision overlays, not displayed probabilities. Player Alert is cautious; Player Consensus is stronger.</p></article>
  <article class="model-card"><h2>Market Swap <small>${SYSTEMS.market.id}</small></h2><p>Odds never enter ELO. Convert paired prices to no-vig probability, then activate a swap only when the tips oppose and the market is at least 10 percentage points more confident.</p><div class="formula">modelConfidence  = |modelP - 0.50|\nmarketConfidence = |marketP - 0.50|\n\nactivate when tips disagree and\nmarketConfidence - modelConfidence &gt;= 0.10</div><p class="muted">Grey means the numerical market rule fired but Lineup Adjustment or Player Impact superseded it.</p></article>
  <article class="model-card"><h2>Stable discrete margin</h2><p>Winner probability and submitted margin remain separate. The stable even-number bucket model remains the deployed margin rule.</p><div class="formula">x = |0.048406 x selected DR|\nweight = Gaussian distance bandwidth 1.5\n       x recency half-life 1000 games\nchoose even margin 2..32 minimizing weighted absolute error</div></article>
  <article class="model-card wide"><h2>Version registry</h2><p><b>${esc(ACTIVE_MODEL.id)}</b> supersedes <b>${esc(MODELS.website2027v100.id)}</b> on the 2027 preview. Every subsystem change must bump the overall version. Major = model shape; minor = deployed composition or policy; patch = subsystem revision without a new composition.</p><div class="version-list">${systems.map(system=>`<div><b>${esc(system.id)}</b><span>${esc(system.label)} - ${esc(system.development)}</span></div>`).join("")}</div><p class="muted">Permanent record: ELO/offline/model-registry/CURRENT.md and 2027_v1.1.0/. Historical forecast claims still require an archived prediction.</p></article>`}

function updateTerminologyV110(){const legend=$(".flag-legend");if(legend)legend.innerHTML=`<b>Decision layers:</b><span><i class="market-swap">&#8644;</i> active Market Swap</span><span><i class="market-swap suppressed">&#8644;</i> superseded swap</span><span><i class="player-impact alert">!</i> Player Alert</span><span><i class="player-impact consensus">C</i> Player Consensus</span><span><b>Base</b> unadjusted Base 2027 ELO</span><span>Teams: <i class="list-tick prematch">&#10003;</i> pre-match / <i class="list-tick postmatch">&#10003;</i> post-match</span><em>Hover over a marker for its calculation and precedence.</em>`;const performance=$("#performance-model option[value='candidate']"),diagnostic=$("#diagnostic-model option[value='candidate']");if(performance)performance.textContent=ACTIVE_MODEL.label;if(diagnostic)diagnostic.textContent=ACTIVE_MODEL.label}

function csvEscape(v){return `"${String(v??"").replace(/"/g,'""')}"`}

function downloadDiagnosticV110(){if(state.competition==="NRLW"){const headers=["rldb_id","year","round","home","away","home_score","away_score","core_probability","rookie_shadow_probability","core_dr","underlying_margin","rookie_margin","rookie_applied","rookie_training_games","home_odds","away_odds","odds_source","market_review_flag"],body=state.nrlwCache.matches.map(r=>[r.rldbId,r.year,r.round,r.home,r.away,r.hs,r.as,r.candidateP,r.gate6P,r.candidateDr,marginCoefficient()*r.candidateDr,r.rookieMargin,r.rookieGate,r.rookieTrainingGames,r.closeHome,r.closeAway,r.closeSource,policyMarketSignals(r).rawFlip]),blob=new Blob([[headers,...body].map(row=>row.map(csvEscape).join(",")).join("\r\n")],{type:"text/csv"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`nrlw-elo-${state.nrlwCache.meta.model}-diagnostic.csv`;a.click();URL.revokeObjectURL(a.href);return}const candidate=$("#diagnostic-model").value==="candidate";if(!candidate){window.open(`${API_URL}/api/diagnostic`,"_blank","noopener");return}const rows=state.cache.matches,headers=["id","year","round","home","away","home_score","away_score","model_version","base_probability","rookie_probability","lineup_probability","displayed_probability","candidate_dr","rookie_margin","rookie_applied","lineup_margin","lineup_applied","full_profile_probability","core_profile_probability","creation_profile_probability","player_alert","player_consensus","open_home_$","open_away_$","close_home_$","close_away_$","close_source","market_swap_raw","market_swap_active","market_swap_suppressed","stable_margin","refined_shadow_margin"];
  const body=rows.map(r=>{const signal=policyMarketSignals(r);return [r.id,r.year,r.round,r.home,r.away,r.hs,r.as,ACTIVE_MODEL.id,r.bstarP,r.gate6P,r.stage4P,r.candidateP,r.candidateDr,r.rookieMargin,r.rookieGate,r.lineupMargin,r.lineupGate,r.o10P,r.o9P,r.creationP,r.playerAlert,r.playerConsensus,r.openHome,r.openAway,r.closeHome,r.closeAway,r.closeSource,signal.rawFlip,signal.flip,signal.greyFlip,r.stableMargin,r.refinedMargin]});
  const blob=new Blob([[headers,...body].map(row=>row.map(csvEscape).join(",")).join("\r\n")],{type:"text/csv"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`nrl-elo-${ACTIVE_MODEL.id}-diagnostic.csv`;a.click();URL.revokeObjectURL(a.href)}
function downloadDiagnostic(){const candidate=$("#diagnostic-model").value==="candidate";if(!candidate){window.open(`${API_URL}/api/diagnostic`,"_blank","noopener");return}const rows=state.cache.matches,headers=["id","year","round","home","away","home_score","away_score","bstar_probability","candidate_probability","candidate_dr","underlying_margin","lineup_margin","rookie_gate","open_home_$","open_away_$","close_home_$","close_away_$","close_source","confidence_swap","adverse_move_10pp","stable_margin","refined_shadow_margin"];
  const body=rows.map(r=>{const signal=marketSignals(r);return [r.id,r.year,r.round,r.home,r.away,r.hs,r.as,r.bstarP,r.candidateP,r.candidateDr,r.candidateDr==null?null:.048406*r.candidateDr,r.lineupMargin,r.rookieGate,r.openHome,r.openAway,r.closeHome,r.closeAway,r.closeSource,signal.flip,signal.adverseMove,r.stableMargin,r.refinedMargin]});
  const blob=new Blob([[headers,...body].map(row=>row.map(csvEscape).join(",")).join("\r\n")],{type:"text/csv"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`nrl-elo-${candidate?'2027-candidate':'2026-production'}-diagnostic.csv`;a.click();URL.revokeObjectURL(a.href)}

function changeRound(delta){const input=$("#round-name"),value=input.value.trim();if(state.competition==="NRLW"){const rounds=[...new Set(seasonMatches(Number($("#round-year").value)).map(r=>r.round))],index=Math.max(0,rounds.findIndex(r=>roundKey(r)===roundKey(value)));input.value=rounds[Math.max(0,Math.min(rounds.length-1,index+delta))]||value;return}const index=FINALS_ROUNDS.findIndex(r=>roundKey(r.label)===roundKey(value));if(index>=0){if(index===0&&delta<0){input.value="Rd 27";return}input.value=FINALS_ROUNDS[Math.max(0,Math.min(FINALS_ROUNDS.length-1,index+delta))].label;return}const number=Number(value.match(/\d+/)?.[0]||1);input.value=delta>0&&number>=27?FINALS_ROUNDS[0].label:`Rd ${Math.max(1,number+delta)}`}
function loadRoundForEntry(){const year=Number($("#round-year").value),round=$("#round-name").value,source=state.competition==="NRLW"?state.nrlwCache.matches:(year===CURRENT_SEASON&&state.current.length?state.current:state.cache.matches),games=source.filter(r=>r.year===year&&roundKey(r.round)===roundKey(round)).sort((a,b)=>a.matchIndex-b.matchIndex),readOnly=state.competition==="NRLW";if(!games.length){$("#round-entry-table").innerHTML=`<p>No games found for ${esc(round)} (${year}).</p>`;$("#save-round-btn").disabled=true;return}const details=getReplayDetails();$("#add-message").innerHTML=readOnly?'<div class="finals-note">NRLW results are read-only here and are refreshed from RLDB; this form cannot write into the NRL-only score API.</div>':"";$("#round-entry-table").innerHTML=`<table class="round-entry"><thead><tr><th>Game #</th><th>Home</th><th>Away</th><th>Pred Win %</th><th>Pred Margin</th><th>Home Score</th><th>Away Score</th></tr></thead><tbody>${games.map(r=>{const d=details.get(Number(r.id))||{},p=r.candidateP??d.coreP,margin=r.candidateDr==null?null:Math.abs(marginCoefficient()*r.candidateDr);return `<tr data-game-id="${r.id}"><td>${r.game??""}</td><td>${esc(r.home)}</td><td>${esc(r.away)}</td><td>${pct(p)}</td><td>${margin==null?"—":margin.toFixed(1)}</td><td><input type="number" class="home-score-input" value="${r.hs??""}" min="0" ${readOnly?"disabled":""}></td><td><input type="number" class="away-score-input" value="${r.as??""}" min="0" ${readOnly?"disabled":""}></td></tr>`}).join("")}</tbody></table>`;$("#save-round-btn").disabled=readOnly}
async function saveRoundResults(){if(state.competition==="NRLW"){$("#add-message").innerHTML='<div class="message warning">NRLW scores are synced from RLDB and cannot be edited through the NRL API.</div>';return}const rows=[...$$("#round-entry-table tbody tr")];if(!rows.length)return;const updates=rows.map(row=>({game_id:Number(row.dataset.gameId),home_score:row.querySelector(".home-score-input").value||null,away_score:row.querySelector(".away-score-input").value||null}));try{const response=await fetch(`${API_URL}/api/matches/bulk-update`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({updates})});if(!response.ok)throw new Error(`API ${response.status}`);$("#add-message").innerHTML='<div class="message success">Scores saved successfully.</div>';await refreshCurrent();loadRoundForEntry()}catch(error){console.error(error);$("#add-message").innerHTML='<div class="message error">Failed to save scores.</div>'}}

function populateRatingControls(teams,years){
  const oldest=Math.min(...years),latest=Math.max(...years),current=new Set(seasonMatches(CURRENT_SEASON).flatMap(r=>[r.home,r.away]));
  state.selectedRatingTeams=new Set([...current]);
  $("#elo-start-year").min=oldest;$("#elo-start-year").max=latest;$("#elo-start-year").value=Math.max(oldest,latest-4);
  $("#elo-end-year").min=oldest;$("#elo-end-year").max=latest;$("#elo-end-year").value=latest;
  $("#elo-highlight").innerHTML='<option value="">None</option>'+teams.map(t=>`<option value="${esc(t)}">${esc(t)}</option>`).join("");
  const checks=list=>list.map(t=>`<label class="team-check"><input type="checkbox" data-rating-team="${esc(t)}" ${state.selectedRatingTeams.has(t)?"checked":""}><span>${esc(t)}</span></label>`).join("");
  $("#current-team-checks").innerHTML=checks(teams.filter(t=>current.has(t)));$("#historical-team-checks").innerHTML=checks(teams.filter(t=>!current.has(t)));
  updateTeamPickerLabel();
}

function updateTeamPickerLabel(){const n=state.selectedRatingTeams.size;$("#team-picker-toggle").textContent=`Teams (${n}) ▾`}

function setRatingTeams(mode){
  const boxes=$$("[data-rating-team]"),current=new Set(seasonMatches(CURRENT_SEASON).flatMap(r=>[r.home,r.away]));state.selectedRatingTeams.clear();
  for(const box of boxes){box.checked=mode==="all"||(mode==="current"&&current.has(box.dataset.ratingTeam));if(box.checked)state.selectedRatingTeams.add(box.dataset.ratingTeam)}
  updateTeamPickerLabel();renderRatings();
}

function buildRatingSeries(){
  if(state.ratings)return state.ratings;
  const source=allDisplayMatches();
  if(state.competition==="NRLW"){
    const teamNames=[...new Set(source.flatMap(r=>[r.home,r.away]).filter(Boolean))],ratings=Object.fromEntries(teamNames.map(team=>[team,1500])),rows=[];let previousYear=null;
    for(const match of source){if(previousYear!==null&&match.year!==previousYear)for(const team of Object.keys(ratings))ratings[team]=(1500+3*ratings[team])/4;ratings[match.home]=match.homePostElo;ratings[match.away]=match.awayPostElo;rows.push({match:{year:match.year,round:match.round},stateAfter:{ratings:{...ratings}}});previousYear=match.year}
    state.ratings={teams:teamNames,rows};return state.ratings;
  }
  const matches=source.map(r=>({id:r.id,year:r.year,round:r.round,match_index:r.matchIndex,home_team:r.home,away_team:r.away,home_score:r.hs,away_score:r.as})),teamNames=[...new Set(matches.flatMap(r=>[r.home_team,r.away_team]).filter(Boolean))],teams=teamNames.map(name=>({name}));
  const replay=createReplayEngine(MODELS.production2026.parameters,teams).replayMatches(matches,{applyByes:true});
  state.ratings={teams:teamNames,rows:replay.rows.filter(r=>r.out.updated)};return state.ratings;
}

const ratingColors={"Melbourne Storm":"#4B0082","Penrith Panthers":"#000000","Sydney Roosters":"#E4002B","Brisbane Broncos":"#6F263D","Cronulla-Sutherland Sharks":"#0085CA","Cronulla Sharks":"#0085CA","Canberra Raiders":"#00A651","Manly-Warringah Sea Eagles":"#800000","Dolphins":"#FF69B4","Canterbury-Bankstown Bulldogs":"#0057B8","New Zealand Warriors":"#0066CC","North Queensland Cowboys":"#003366","South Sydney Rabbitohs":"#006400","Parramatta Eels":"#003DA5","Newcastle Knights":"#002B5C","St George Illawarra Dragons":"#CC0000","Wests Tigers":"#F15A22","Gold Coast Titans":"#00B2A9"};

function renderRatings(){
  const start=Number($("#elo-start-year").value),end=Number($("#elo-end-year").value),from=Math.min(start,end),to=Math.max(start,end),highlight=$("#elo-highlight").value,{rows}=buildRatingSeries(),view=rows.filter(r=>r.match.year>=from&&r.match.year<=to),selected=[...state.selectedRatingTeams].sort();
  const labels=view.map(r=>[String(r.match.year),String(r.match.round)]),datasets=selected.map(team=>({label:team,data:view.map(r=>r.stateAfter.ratings[team]??1500),borderColor:highlight&&highlight!==team?"rgba(150,150,150,.22)":ratingColors[team]||"#777",backgroundColor:ratingColors[team]||"#777",borderWidth:highlight===team?3:1.5,pointRadius:0,tension:0,spanGaps:true}));
  destroyChart("ratings");state.charts.ratings=new Chart($("#ratings-chart"),{type:"line",data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:"nearest",intersect:false},scales:{x:{type:"category",title:{display:true,text:"Season / round"},ticks:{autoSkip:true,maxTicksLimit:30,maxRotation:0}},y:{title:{display:true,text:"Elo rating"}}},plugins:{legend:{display:true,position:"top",labels:{boxWidth:12,font:{size:11}}},tooltip:{callbacks:{title:items=>items[0]?.label?.replace(","," · ")||""}}}}});
}

async function refreshSelectedCompetition(){
  if(state.competition==="NRL")return refreshCurrent();
  const button=$("#refresh-current");button.disabled=true;button.textContent="Refreshing…";
  try{const response=await fetch(`data/nrlw-cache.json?v=${Date.now()}`,{cache:"no-store"});if(!response.ok)throw new Error(`NRLW cache ${response.status}`);state.nrlwCache=await response.json();state.historySignature=null;state.ratings=null;populateSelectors();renderCurrent();activate($$('.tab.active')[0]?.dataset.tab||"season")}
  catch(error){console.error(error);showNotice(`The NRLW cache could not be refreshed: ${error.message}`,"warning")}
  finally{button.disabled=false;button.textContent="Refresh cache"}
}

function setCompetition(competition){
  state.competition=competition==="NRLW"?"NRLW":"NRL";state.historySignature=null;state.ratings=null;
  try{localStorage.setItem("eloCompetition",state.competition)}catch{}
  $$('[data-competition]').forEach(button=>{const active=button.dataset.competition===state.competition;button.classList.toggle("active",active);button.setAttribute("aria-pressed",String(active))});
  $("#competition-heading").textContent=state.competition;document.title=`${state.competition} ELO Ratings — 2027 preview`;
  const nrlw=state.competition==="NRLW";
  $("#model-chip-label").textContent=nrlw?state.nrlwCache.meta.model:ACTIVE_MODEL.label;
  $("#current-season-label").textContent=nrlw?state.nrlwCache.meta.lastSeason:CURRENT_SEASON;
  $("#refresh-current").textContent=nrlw?"Refresh cache":"Refresh";
  const performanceProduction=$("#performance-model option[value='production']"),diagnosticProduction=$("#diagnostic-model option[value='production']");
  performanceProduction.hidden=performanceProduction.disabled=nrlw;diagnosticProduction.hidden=diagnosticProduction.disabled=nrlw;
  $("#performance-model option[value='candidate']").textContent=nrlw?"NRLW core":ACTIVE_MODEL.label;
  $("#performance-model option[value='bstar']").textContent=nrlw?"Rookie shadow":"B* core";
  $("#diagnostic-model option[value='candidate']").textContent=nrlw?state.nrlwCache.meta.model:ACTIVE_MODEL.label;
  if(nrlw&&$("#performance-model").value==="production")$("#performance-model").value="candidate";
  if(nrlw&&$("#diagnostic-model").value==="production")$("#diagnostic-model").value="candidate";
  if(nrlw)$(".flag-legend").innerHTML='<b>NRLW layers:</b><span><b>Core</b> displayed NRLW model</span><span><b>Rookie</b> Gate 6 shadow only</span><span><i class="market-swap suppressed">&#8644;</i> market review flag only</span><span>Teams: <i class="list-tick postmatch">&#10003;</i> RLDB run-out list</span><em>Rookie and market flags never change the displayed tip.</em>';else updateTerminologyV110();
  populateSelectors();
  const active=$$('.tab.active')[0]?.dataset.tab;
  prepareCurrentRoundEntry();renderCurrent();activate(active||"season");
}

function activate(tab){const target=$("#tab-"+tab)?tab:"season";$$('[data-tab]').forEach(b=>b.classList.toggle("active",b.dataset.tab===target));$$('.tab-content').forEach(p=>p.classList.toggle("active",p.id===`tab-${target}`));history.replaceState(null,"",`#${target}`);if(target==="season")renderCurrent();if(target==="performance")renderAccuracy();if(target==="ratings")renderRatings();if(target==="ladder")renderLadder();if(target==="matrix")renderMatrix();if(target==="history")requestAnimationFrame(renderHistory);if(target==="add")prepareCurrentRoundEntry();if(target==="joker")renderJoker();if(target==="model")renderModelV110()}
function wire(){
  $$('[data-tab]').forEach(b=>b.addEventListener("click",()=>activate(b.dataset.tab)));$$('[data-competition]').forEach(b=>b.addEventListener("click",()=>setCompetition(b.dataset.competition)));$("#refresh-current").addEventListener("click",refreshSelectedCompetition);$("#ladder-year").addEventListener("change",updateLadderRounds);$("#ladder-round").addEventListener("change",renderLadder);$("#season-year").addEventListener("change",renderMatrix);
  for(const id of ["#history-year","#history-team","#history-search"])$(id).addEventListener("input",renderHistory);
  $("#performance-model").addEventListener("change",renderAccuracy);$("#joker-year").addEventListener("change",renderJoker);$("#download-diagnostic").addEventListener("click",downloadDiagnosticV110);$("#round-prev").addEventListener("click",()=>changeRound(-1));$("#round-next").addEventListener("click",()=>changeRound(1));$("#load-round-btn").addEventListener("click",loadRoundForEntry);$("#save-round-btn").addEventListener("click",saveRoundResults);
  $("#elo-update").addEventListener("click",renderRatings);$("#elo-highlight").addEventListener("change",renderRatings);$("#team-picker-toggle").addEventListener("click",event=>{event.stopPropagation();$("#team-picker-menu").classList.toggle("hidden")});$("#team-picker-menu").addEventListener("click",event=>event.stopPropagation());document.addEventListener("click",()=>$("#team-picker-menu").classList.add("hidden"));
  $("#team-picker-menu").addEventListener("change",event=>{const box=event.target.closest("[data-rating-team]");if(!box)return;if(box.checked)state.selectedRatingTeams.add(box.dataset.ratingTeam);else state.selectedRatingTeams.delete(box.dataset.ratingTeam);updateTeamPickerLabel();renderRatings()});
  $("#teams-current").addEventListener("click",()=>setRatingTeams("current"));$("#teams-all").addEventListener("click",()=>setRatingTeams("all"));$("#teams-none").addEventListener("click",()=>setRatingTeams("none"));
  $$(".quick-range").forEach(button=>button.addEventListener("click",()=>{const years=competitionMatches().map(r=>r.year),oldest=Math.min(...years),latest=Math.max(...years),range=button.dataset.eloRange;$("#elo-end-year").value=latest;$("#elo-start-year").value=range==="all"?oldest:Math.max(oldest,latest-Number(range)+1);renderRatings()}));
  $("#elo-reset").addEventListener("click",()=>{const years=competitionMatches().map(r=>r.year),latest=Math.max(...years),oldest=Math.min(...years);$("#elo-start-year").value=Math.max(oldest,latest-4);$("#elo-end-year").value=latest;$("#elo-highlight").value="";setRatingTeams("current")});
}

async function init(){try{await loadCache();let saved="NRL";try{saved=localStorage.getItem("eloCompetition")==="NRLW"?"NRLW":"NRL"}catch{}const requestedTab=location.hash.slice(1)||"season";state.competition=saved;$("#model-chip-label").textContent=ACTIVE_MODEL.label;$("#current-season-label").textContent=CURRENT_SEASON;populateSelectors();updateTerminologyV110();renderModelV110();wire();setCompetition(saved);activate(requestedTab);await refreshCurrent()}catch(error){console.error(error);showNotice(`Preview failed to initialise: ${error.message}`)}}
init();
