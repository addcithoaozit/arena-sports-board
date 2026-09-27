import {analyzeFootball,footballDay,parseFootballEvents,shiftFootballDay,type FootballGame,type FootballLeague} from './football';
import {archivedFootballHistory,footballArchiveCutoff} from './football-archive';
import {reconcileFootballHistory} from './football-history';
const ROOT='https://site.api.espn.com/apis/site/v2/sports/soccer';
const cache=new Map<string,{expires:number;value:any;fetchedAt:string}>(),pending=new Map<string,Promise<any>>();
// Share bounded source work across members; only public football data is cached.
let active=0;const queue:(()=>void)[]=[];
async function source(path:string,ttl:number):Promise<{value:any;fetchedAt:string}>{
  const hit=cache.get(path);if(hit&&hit.expires>Date.now())return hit;
  if(pending.has(path))return pending.get(path)!;
  const task=(async()=>{
    if(active>=4)await new Promise<void>(resolve=>queue.push(resolve));else active++;
    try{
      const r=await fetch(`${ROOT}/${path}`,{cache:'no-store',signal:AbortSignal.timeout(12000)});
      if(!r.ok)throw Error('足球資料來源暫時無法連線');
      const text=await r.text();if(text.length>6000000)throw Error('足球來源資料過大');
      const value=JSON.parse(text);if(!Array.isArray(value?.events))throw Error('足球來源格式改變');
      const entry={value,fetchedAt:new Date().toISOString(),expires:Date.now()+ttl};
      if(cache.size>=180)cache.delete(cache.keys().next().value!);cache.set(path,entry);return entry;
    }finally{const next=queue.shift();if(next)next();else active--;}
  })().finally(()=>pending.delete(path));pending.set(path,task);return task;
}
async function scoreboard(league:FootballLeague,day:string){return source(`${league}/scoreboard?dates=${day.replaceAll('-','')}&limit=100`,30000);}
export async function footballSchedule(league:FootballLeague,day:string){
  // ESPN soccer accepts a single source day, not a dates range. Fetch both days
  // overlapping the Taiwan date, then filter by the actual kickoff timestamp.
  const results=await Promise.all([scoreboard(league,shiftFootballDay(day,-1)),scoreboard(league,day)]);
  const games=[...new Map(results.flatMap(r=>parseFootballEvents(r.value,league)).filter(g=>footballDay(g.start)===day).map(g=>[g.id,g])).values()];
  const rank=(g:FootballGame)=>g.state==='live'?0:g.state==='scheduled'?1:g.state==='final'?2:3;
  games.sort((a,b)=>rank(a)-rank(b)||Date.parse(a.start)-Date.parse(b.start));
  return {league,day,games,fetchedAt:results.map(r=>r.fetchedAt).sort()[0],source:'ESPN',calendar:results[1].value.leagues?.[0]?.calendar||[]};
}
export async function nextFootballDay(league:FootballLeague,day:string){
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
}
export async function footballGameAnalysis(league:FootballLeague,day:string,id:string){
  const schedule=await footballSchedule(league,day),game=schedule.games.find(g=>g.id===id);
  if(!game)return null;
  if(game.state!=='scheduled'||!game.timeConfirmed||Date.parse(game.start)<=Date.now())return {game,analysis:analyzeFootball(game,[]),sourceFetchedAt:schedule.fetchedAt};
  const years=[game.season,game.season-1];
  const requests=[game.home.id,game.away.id].flatMap(team=>years.map(year=>({team,year})));
  const results=await Promise.allSettled(requests.map(({team,year})=>source(`${league}/teams/${team}/schedule?season=${year}`,60*60000)));
  const success=results.flatMap(r=>r.status==='fulfilled'?[r.value]:[]);
  const missing=results.flatMap((r,i)=>r.status==='rejected'?[requests[i]]:[]);
  const merged=reconcileFootballHistory(success.flatMap(r=>parseFootballEvents(r.value,league)),archivedFootballHistory(league,game.home.id,game.away.id),league);
  const analysis=analyzeFootball(game,merged.games),warnings:string[]=[];
  if(missing.length)warnings.push(`${missing.length}份歷史來源未完成；歷史快照日期 ${footballArchiveCutoff.slice(0,10)}。`);
  if(merged.conflicts)warnings.push(`${merged.conflicts}場歷史賽果衝突，已排除。`);
  if([analysis.homeForm,analysis.awayForm].some(f=>f&&f.games<10))warnings.push('至少一隊少於10場樣本，估計較不穩定。');
  // The archive can fill a previous season only after that season ended.
  // These European seasons start in the named year and finish by June next year.
  if(missing.some(r=>r.year===game.season||Date.UTC(r.year+1,6,1)>Date.parse(footballArchiveCutoff))){
    analysis.status='waiting';analysis.reason='本季賽果來源未完整更新，暫停分析以免遺漏最新比賽。';
    delete analysis.probabilities;delete analysis.expected;delete analysis.scores;delete analysis.lean;
  }
  analysis.quality={label:warnings.length?'資料有限':'基本賽果完整',warnings,historyConflicts:merged.conflicts,archiveSupplementGames:merged.supplemented};
  return {game,analysis,sourceFetchedAt:success.map(r=>r.fetchedAt).sort()[0]||null,archiveAsOf:merged.supplemented?footballArchiveCutoff:null};
}
