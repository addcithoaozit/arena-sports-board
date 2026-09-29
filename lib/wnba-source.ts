import {wnbaFirstSeason,wnbaDay,wnbaHistory,wnbaSeason,wnbaTeam,parseWnbaEvents,reconcileWnbaGames,shiftWnbaDay,validWnbaDay,type WnbaBoard} from './wnba';
import {analyzeWnba,wnbaEligible} from './wnba-analysis';
const ROOT='https://site.api.espn.com/apis/site/v2/sports/basketball/wnba';
const cache=new Map<string,{value:any;fetchedAt:string;expires:number}>(),pending=new Map<string,Promise<{value:any;fetchedAt:string;expires:number}>>();
let active=0;const queue:(()=>void)[]=[];
async function source(path:string,ttl=30000){
 const hit=cache.get(path);if(hit&&hit.expires>Date.now())return hit;
 if(pending.has(path))return pending.get(path)!;
 const task=(async()=>{
  if(active>=4)await new Promise<void>(resolve=>queue.push(resolve));else active++;
  try{
   const response=await fetch(`${ROOT}/${path}`,{cache:'no-store',signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw Error('WNBA 來源無法連線');
   const text=await response.text();if(text.length>6000000)throw Error('WNBA 來源過大');
   const value=JSON.parse(text);if(!Array.isArray(value?.events))throw Error('WNBA 來源格式錯誤');
   const entry={value,fetchedAt:new Date().toISOString(),expires:Date.now()+ttl};
   if(cache.size>=240)cache.delete(cache.keys().next().value!);cache.set(path,entry);return entry;
  }finally{const next=queue.shift();if(next)next();else active--;}
 })().finally(()=>pending.delete(path));pending.set(path,task);return task;
}
const scoreboard=(day:string)=>source(`scoreboard?dates=${day.replaceAll('-','')}&limit=100`);
export async function wnbaSchedule(day:string):Promise<WnbaBoard>{
 const rows=await Promise.all([scoreboard(shiftWnbaDay(day,-1)),scoreboard(day)]);
 const games=reconcileWnbaGames(rows.flatMap(r=>parseWnbaEvents(r.value))).filter(g=>wnbaDay(g.start)===day).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start));
 return {day,games,source:'ESPN',fetchedAt:rows.map(r=>r.fetchedAt).sort()[0]};
}
export async function nextWnbaDay(day:string){
 // During the offseason the current-day calendar can still belong to the old
 // season. Probe next month too, then look up real event timestamps (Taiwan day).
 const rows=await Promise.all([scoreboard(day),scoreboard(shiftWnbaDay(day,30))]);
 rows.forEach(r=>parseWnbaEvents(r.value));
 const dates=[...new Set<string>(rows.flatMap(r=>(r.value.leagues.find((l:any)=>l.slug==='wnba')?.calendar||[]).filter((d:any)=>typeof d==='string').map((d:string)=>d.slice(0,10))))].filter(d=>validWnbaDay(d)&&d>=day&&d<=shiftWnbaDay(day,60)).sort();
 const scan=dates.length?dates:Array.from({length:31},(_,i)=>shiftWnbaDay(day,i));
 for(let i=0;i<scan.length;i+=4){
  const batch=await Promise.all(scan.slice(i,i+4).map(scoreboard));
  const next=batch.flatMap(r=>parseWnbaEvents(r.value)).filter(g=>wnbaDay(g.start)>day&&['scheduled','live','final'].includes(g.state)).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start))[0];
  if(next)return {day:wnbaDay(next.start)};
 }
 return {day:null};
}
async function teamSeason(team:string,season:number,phase:number){
 if(season<wnbaFirstSeason(team))return {games:[],fetchedAt:new Date().toISOString()};
 const row=await source(`teams/${team}/schedule?season=${season}&seasontype=${phase}&limit=200`,5*60000);
 const games=parseWnbaEvents(row.value,team),requested=row.value.requestedSeason;
 if(requested&&(Number(requested.year)!==season||Number(requested.type)!==phase)||games.some(g=>g.season!==season||g.phase!==phase)||row.value.events.length>=200)throw Error('WNBA 球季來源不符');
 if(games.some(g=>g.state==='final'&&(g.homeScore===null||g.awayScore===null||g.homeScore<=0||g.awayScore<=0||g.homeScore===g.awayScore)))throw Error('WNBA 完賽比分不完整');
 return {...row,games};
}
async function history(teamIds:string[],season:number){
 // Fail closed when any required current/history feed fails. An older success
 // must not silently omit a team's most recent results and produce a new pick.
 const rows=await Promise.all(teamIds.flatMap(team=>[season,season-1].flatMap(year=>[2,3].map(phase=>teamSeason(team,year,phase)))));
 return {games:reconcileWnbaGames(rows.flatMap(r=>r.games)),fetchedAt:rows.map(r=>r.fetchedAt).sort()[0]};
}
export async function wnbaGameAnalysis(day:string,id:string){
 const schedule=await wnbaSchedule(day),game=schedule.games.find(g=>g.id===id);if(!game)return null;
 if(!wnbaEligible(game))return {game,analysis:analyzeWnba(game,[]),sourceFetchedAt:schedule.fetchedAt};
 const data=await history([game.home.id,game.away.id],wnbaSeason(wnbaDay()));
 return {game,analysis:analyzeWnba(game,data.games),sourceFetchedAt:data.fetchedAt};
}
export async function wnbaTeamProfile(teamId:string){
 const team=wnbaTeam(teamId);if(!team)throw Error('球隊不存在');
 const season=wnbaSeason(wnbaDay());
 const [data,preseason]=await Promise.all([history([teamId],season),teamSeason(teamId,season,1)]);
 const games=reconcileWnbaGames([...data.games,...preseason.games]);
 return {team,results:wnbaHistory(games,teamId),upcoming:games.filter(g=>g.state==='scheduled'&&Date.parse(g.start)>Date.now()).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start)).slice(0,5),fetchedAt:[data.fetchedAt,preseason.fetchedAt].sort()[0]};
}
export type WnbaTeamProfileData=Awaited<ReturnType<typeof wnbaTeamProfile>>;

export async function wnbaTeamSeasonProfile(teamId:string,season:number,phase:number){
 if(!wnbaTeam(teamId))throw Error('球隊不存在');
 const row=await teamSeason(teamId,season,phase);
 return {team:wnbaTeam(teamId)!,season,phase,games:reconcileWnbaGames(row.games),fetchedAt:row.fetchedAt};
}
