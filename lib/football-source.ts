import {attachCupXgEvidence} from './football-cup-xg-source';
import {loadNationalFootballPool} from './football-national-source';
import {attachCupXgEvidence} from './football-cup-xg-source';
import {applyNationalFootballModel,NATIONAL_MODEL_VERSION} from './football-national-model';
import {bbcFootballAnalysis} from './football-bbc-analysis';
import {alternateFootballSchedule,alternateNextFootball} from './alternate-schedules';
import {SportsSourceDenied} from './sports-source-access';
import {sportsSourceFetch} from './sports-source-access';
import {sourceWork} from './source-request';
import {analyzeFootball,footballDay,isFootballNationalCompetition,needsFootballRecentForm,parseFootballEvents,parseFootballTeamHistory,shiftFootballDay,type FootballGame,type FootballLeague} from './football';
import {archivedFootballHistory,footballArchiveCutoff} from './football-archive';
import {reconcileFootballHistory} from './football-history';
import {applyExternalFootballAnalysis,loadExternalFootballContext} from './football-external-source';
import {loadFootballMarketContext,applyFootballMarketAnalysis} from './football-market-source';
import {selectFootballMarketModel} from './football-market-model';
import {footballProfileTeam,footballProfileResults,footballProfileUpcoming,type FootballTeamProfileData} from './football-team-profile';
const ROOT='https://site.api.espn.com/apis/site/v2/sports/soccer';
const cache=new Map<string,{expires:number;value:any;fetchedAt:string}>();
// Share bounded source work across members; only public football data is cached.

async function source(path:string,ttl:number,timeout=12000):Promise<{value:any;fetchedAt:string}>{
 const work=sourceWork('football-source'),{pending,queue}=work;
  const hit=cache.get(path);if(hit&&hit.expires>Date.now())return hit;
  if(pending.has(path))return pending.get(path)!;
  const task=(async()=>{
    if(work.active>=4)await new Promise<void>(resolve=>queue.push(resolve));else work.active++;
    try{
      const r=await sportsSourceFetch(`${ROOT}/${path}`,{cache:'no-store',signal:AbortSignal.timeout(timeout)});
      if(!r.ok){console.error('sports-source-http',JSON.stringify({sport:'football',status:r.status,contentType:r.headers.get('content-type'),server:r.headers.get('server')}));throw Error('足球 來源 HTTP '+r.status);}
      const text=await r.text();if(text.length>6000000)throw Error('足球來源資料過大');
      const value=JSON.parse(text);if(!Array.isArray(value?.events))throw Error('足球來源格式改變');
      const entry={value,fetchedAt:new Date().toISOString(),expires:Date.now()+ttl};
      if(cache.size>=180)cache.delete(cache.keys().next().value!);cache.set(path,entry);return entry;
    }finally{const next=queue.shift();if(next)next();else work.active--;}
  })().finally(()=>pending.delete(path));pending.set(path,task);return task;
}
async function scoreboard(league:FootballLeague,day:string){return source(`${league}/scoreboard?dates=${day.replaceAll('-','')}&limit=100`,30000,isFootballNationalCompetition(league)?20000:12000);}
export async function footballSchedule(league:FootballLeague,day:string){
 try{
  // ESPN soccer accepts a single source day, not a dates range. Fetch both days
  // overlapping the Taiwan date, then filter by the actual kickoff timestamp.
  const results=await Promise.all([scoreboard(league,shiftFootballDay(day,-1)),scoreboard(league,day)]);
  const games=[...new Map(results.flatMap(r=>parseFootballEvents(r.value,league)).filter(g=>footballDay(g.start)===day).map(g=>[g.id,g])).values()];
  const rank=(g:FootballGame)=>g.state==='live'?0:g.state==='scheduled'?1:g.state==='final'?2:3;
  games.sort((a,b)=>rank(a)-rank(b)||Date.parse(a.start)-Date.parse(b.start));
  return {league,day,games,fetchedAt:results.map(r=>r.fetchedAt).sort()[0],source:'ESPN',calendar:results[1].value.leagues?.[0]?.calendar||[]};
 }catch(error){if(error instanceof SportsSourceDenied)return alternateFootballSchedule(league,day);throw error;}
}
export async function nextFootballDay(league:FootballLeague,day:string){
 try{
  const first=await scoreboard(league,day),calendar=first.value.leagues?.[0]?.calendar;
  const dates=Array.isArray(calendar)&&calendar.every((d:any)=>typeof d==='string')
    ? [...new Set<string>(calendar.map((d:string)=>d.slice(0,10)))].filter(d=>d>=day&&d<=shiftFootballDay(day,60)).sort()
    : Array.from({length:31},(_,i)=>shiftFootballDay(day,i));
  // Source dates may map to the next Taiwan day; always use the event timestamp.
  for(let i=0;i<dates.length;i+=4){
    const rows=await Promise.all(dates.slice(i,i+4).map(d=>scoreboard(league,d)));
    const found=rows.flatMap(r=>parseFootballEvents(r.value,league)).filter(g=>footballDay(g.start)>day).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start))[0];
    if(found)return {day:footballDay(found.start)};
  }
  return {day:null};
 }catch(error){if(error instanceof SportsSourceDenied)return alternateNextFootball(league,day);throw error;}
}
export async function footballGameAnalysis(league:FootballLeague,day:string,id:string){
  const schedule=await footballSchedule(league,day),game=schedule.games.find(g=>g.id===id);
  if(!game)return null;
  if(game.id.startsWith('bbc:'))return bbcFootballAnalysis(game);
  if(game.state!=='scheduled'||!game.timeConfirmed||Date.parse(game.start)<=Date.now())return {game,analysis:analyzeFootball(game,[]),sourceFetchedAt:schedule.fetchedAt};
  if(isFootballNationalCompetition(league))return nationalGameAnalysis(game);
  const marketActive=!!selectFootballMarketModel(league);
  const marketRequest=marketActive?loadFootballMarketContext(league).catch(()=>null):Promise.resolve(null);
  const externalRequest=marketActive?Promise.resolve(null):loadExternalFootballContext(league).catch(()=>null);
  const years=[game.season,game.season-1];
  const requests=[game.home.id,game.away.id].flatMap(team=>years.map(year=>({team,year})));
  const results=await Promise.allSettled(requests.map(async({team,year})=>{
    const r=await source(`${league}/teams/${team}/schedule?season=${year}`,60*60000);
    if(String(r.value?.team?.id)!==team)throw Error('球隊歷史來源身分不符');
    return r;
  }));
  const success=results.flatMap(r=>r.status==='fulfilled'?[r.value]:[]);
  const missing=results.flatMap((r,i)=>r.status==='rejected'?[requests[i]]:[]);
  const live=success.flatMap(r=>parseFootballEvents(r.value,league)),archive=archivedFootballHistory(league,game.home.id,game.away.id);
  const initial=reconcileFootballHistory(live,archive,league),initialAnalysis=analyzeFootball(game,initial.games);
  const sparse=[{team:game.home.id,form:initialAnalysis.homeForm},{team:game.away.id,form:initialAnalysis.awayForm}].filter(r=>needsFootballRecentForm(r.form,Date.now())||missing.some(m=>m.team===r.team));
  const extraRequests=sparse.flatMap(({team})=>years.map(year=>({team,year})));
  const extraResults=await Promise.allSettled(extraRequests.map(async({team,year})=>{
    const r=await source(`all/teams/${team}/schedule?season=${year}`,60*60000);
    return {...r,games:parseFootballTeamHistory(r.value,team)};
  }));
  const extraSuccess=extraResults.flatMap((r,i)=>r.status==='fulfilled'?[{...r.value,...extraRequests[i]}]:[]);
  // Reconcile all feeds together so a quarantined ID cannot return via fallback.
  // Preserve each competition identity; lower-division scores are never relabeled.
  const merged=reconcileFootballHistory([...live,...extraSuccess.flatMap(r=>r.games)],archive);
  let analysis=analyzeFootball(game,merged.games,Date.now(),merged.games);const warnings:string[]=[];
  if(missing.length)warnings.push(`${missing.length}份歷史來源未完成；歷史快照日期 ${footballArchiveCutoff.slice(0,10)}。`);
  if(merged.conflicts)warnings.push(`${merged.conflicts}場歷史賽果衝突，已排除。`);
  if(extraResults.some(r=>r.status==='rejected'))warnings.push('部分跨賽事近況未完成，僅採用已核對的賽果。');
  if(analysis.historyMode==='recent-form')warnings.push(`已補充跨賽事近況：主隊${analysis.homeForm?.supplementGames||0}場、客隊${analysis.awayForm?.supplementGames||0}場；另行驗證此版本。`);
  if([analysis.homeForm,analysis.awayForm].some(f=>f&&f.games<10))warnings.push('至少一隊少於10場樣本，估計較不穩定。');
  // The archive can fill a previous season only after that season ended.
  // These European seasons start in the named year and finish by June next year.
  if(missing.some(r=>(r.year===game.season||Date.UTC(r.year+1,6,1)>Date.parse(footballArchiveCutoff))&&!extraSuccess.some(e=>e.team===r.team&&e.year===r.year))){
    analysis.status='waiting';analysis.reason='本季賽果來源未完整更新，暫停分析以免遺漏最新比賽。';
    delete analysis.probabilities;delete analysis.expected;delete analysis.scores;delete analysis.lean;
  }
  analysis.quality={label:warnings.length?'資料有限':'基本賽果完整',warnings,historyConflicts:merged.conflicts,archiveSupplementGames:merged.supplemented};
  const external=await externalRequest;
  if(external)analysis=applyExternalFootballAnalysis(game,analysis,merged.games,external);
  const market=await marketRequest;
  if(market)analysis=applyFootballMarketAnalysis(game,analysis,market);
  else if(marketActive&&analysis.quality){analysis.quality.label='資料有限';analysis.quality.warnings.push('第二輪模型已通過，但聯賽年度來源暫時未更新，沿用既有分析。');}
  return {game,analysis:attachCupXgEvidence(game,analysis),sourceFetchedAt:[...success,...extraSuccess].map(r=>r.fetchedAt).sort()[0]||null,archiveAsOf:merged.supplemented?footballArchiveCutoff:null};
}

async function nationalGameAnalysis(game:FootballGame){
  const poolRequest=loadNationalFootballPool(Date.now(),sportsSourceFetch);
  // National competitions span multi-year cycles. Request both calendar years
  // together and preserve each event's competition; do not load club xG models.
  const year=new Date(Date.now()).getUTCFullYear();
  const requests=[game.home.id,game.away.id].flatMap(team=>[year,year-1].map(season=>({team,season})));
  const results=await Promise.allSettled(requests.map(async({team,season})=>{
    const r=await source(`all/teams/${team}/schedule?season=${season}&limit=100`,60*60000,20000);
    if(r.value.events.length>=100)throw Error('國家隊歷史來源超出分頁上限');
    return {...r,games:parseFootballTeamHistory(r.value,team,game.league,true)};
  }));
  const success=results.flatMap(r=>r.status==='fulfilled'?[r.value]:[]),missing=results.flatMap((r,i)=>r.status==='rejected'?[requests[i]]:[]);
  const merged=reconcileFootballHistory(success.flatMap(r=>r.games),[]);
  let analysis=analyzeFootball(game,merged.games,Date.now(),merged.games);const warnings:string[]=[];
  const pool=await poolRequest;
  if(pool){
    const context=reconcileFootballHistory(success.flatMap(r=>r.games),pool.games);
    analysis=applyNationalFootballModel(game,analysis,context.games);
    if(Date.now()-Date.parse(pool.fetchedAt)>6*3600000)warnings.push('對手強度資料使用最近48小時內快照，來源更新稍後重試。');
  }else if(analysis.status==='ready'){
    analysis={...analysis,status:'waiting',version:NATIONAL_MODEL_VERSION,reason:'國家隊對手強度資料尚未更新。'};
    delete analysis.probabilities;delete analysis.expected;delete analysis.scores;delete analysis.lean;
  }
  if(missing.length)warnings.push(`${missing.length}份國家隊歷史來源未完成，僅採用已核對的賽果。`);
  if(merged.conflicts)warnings.push(`${merged.conflicts}場歷史賽果衝突，已排除。`);
  if([analysis.homeForm,analysis.awayForm].some(f=>f&&f.games<10))warnings.push('至少一隊少於10場近期賽果，估計較不穩定。');
  const friendlyGames=(analysis.homeForm?.friendlyGames||0)+(analysis.awayForm?.friendlyGames||0);
  if(friendlyGames)warnings.push(`近期表現補入國際友誼賽：主隊${analysis.homeForm?.friendlyGames||0}場、客隊${analysis.awayForm?.friendlyGames||0}場；權重0.2。`);
  if(missing.some(r=>r.season===year)){
    analysis.status='waiting';analysis.reason='本年國家隊賽果來源尚未完整更新，等待最新資料。';
    delete analysis.probabilities;delete analysis.expected;delete analysis.scores;delete analysis.lean;
  }
  analysis.quality={label:warnings.length?'資料有限':'國家隊正式賽果完整',warnings,historyConflicts:merged.conflicts,archiveSupplementGames:0};
  return {game,analysis:attachCupXgEvidence(game,analysis),sourceFetchedAt:success.map(r=>r.fetchedAt).sort()[0]||null,archiveAsOf:null};
}

export async function footballTeamProfile(league:FootballLeague,teamId:string):Promise<FootballTeamProfileData>{
 const year=new Date(Date.now()).getUTCFullYear();
 const paths=[`all/teams/${teamId}/schedule?season=${year}&limit=100`,`all/teams/${teamId}/schedule?season=${year-1}&limit=100`,...[year,year-1].map(season=>`${league}/teams/${teamId}/schedule?season=${season}&fixture=true&limit=100`)];
 const rows=await Promise.allSettled(paths.map(async path=>{
  const r=await source(path,path.includes('fixture=true')?5*60000:60*60000,20000);
  const team=footballProfileTeam(r.value.team,teamId);if(r.value.events.length>=100)throw Error('球隊資料超出分頁上限');
  return {...r,team,games:parseFootballTeamHistory(r.value,teamId,league,true)};
 }));
 // Never present an older feed as current after the latest team source fails.
 if(rows[0].status==='rejected')throw Error('球隊近期資料暫時無法讀取');
 const current=rows[0].value,history=rows.slice(0,2).flatMap(r=>r.status==='fulfilled'?r.value.games:[]),fixtures=rows.slice(2).flatMap(r=>r.status==='fulfilled'?[r.value]:[]);
 return {league,team:current.team,results:footballProfileResults(history,league,teamId),upcoming:fixtures.length?footballProfileUpcoming(fixtures.flatMap(r=>r.games),league,teamId):null,fetchedAt:rows.flatMap(r=>r.status==='fulfilled'?[r.value.fetchedAt]:[]).sort()[0]};
}

