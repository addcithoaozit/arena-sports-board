// Server-only expanded score history for the accepted DE/IT market model.
import archive from '../data/football/market-history-20260928.json';
import {type FootballAnalysis,type FootballGame,type FootballLeague} from './football';
import {FootballElo,externalDayCutoff} from './football-xg-features';
import {marketFootballDistribution,marketFootballFeatures,marketFootballRates,parseMarketFootballEvents,reconcileMarketHistory,marketFixtureKey} from './football-market-core';
import {footballMarketAudit,footballMarketRuntime,selectFootballMarketModel} from './football-market-model';
const names=archive.teams as Record<string,string>;
const archived:FootballGame[]=archive.games.map(r=>({id:String(r[0]),league:String(r[1]) as FootballLeague,start:String(r[2]),home:{id:String(r[3]),name:names[String(r[3])]||String(r[3]),englishName:names[String(r[3])]||String(r[3])},away:{id:String(r[4]),name:names[String(r[4])]||String(r[4]),englishName:names[String(r[4])]||String(r[4])},homeScore:Number(r[5]),awayScore:Number(r[6]),neutral:!!r[7],season:Number(r[8]),state:'final',statusName:'STATUS_FULL_TIME',statusLabel:'完場',timeConfirmed:true,venue:'',sourceUrl:''}));
export type FootballMarketContext={history:FootballGame[];fetchedAt:string;fixtures:Map<string,FootballGame>;conflicts:number};
const cache=new Map<string,{expires:number;value?:FootballMarketContext;error?:Error}>(),pending=new Map<string,Promise<FootballMarketContext>>();
let active=0;const queue:(()=>void)[]=[];
async function fetchYear(league:FootballLeague,year:number){
 if(active>=2)await new Promise<void>(r=>queue.push(r));else active++;
 try{const r=await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${year}&limit=1000`,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('聯賽年度來源暫時無法更新');const text=await r.text();if(text.length>12000000)throw Error('聯賽資料過大');return parseMarketFootballEvents(JSON.parse(text),league);}
 finally{const next=queue.shift();if(next)next();else active--;}
}
export async function loadFootballMarketContext(league:FootballLeague):Promise<FootballMarketContext>{
 if(league!=='ger.1'&&league!=='ita.1')throw Error('不支援此聯賽');const now=Date.now(),year=new Date(now).getUTCFullYear(),key=league+':'+year,hit=cache.get(key);
 if(hit&&hit.expires>now){if(hit.error)throw hit.error;return hit.value!;}if(pending.has(key))return pending.get(key)!;
 const task=(async()=>{
  const live=(await Promise.all([year-1,year].map(y=>fetchYear(league,y)))).flat(),base=archived.filter(g=>g.league===league),baseIds=new Set(base.map(g=>g.id));
  const excluded=[...archive.excludedKeys,...live.filter(g=>(g.state!=='final'||g.statusName!=='STATUS_FULL_TIME'||g.homeScore===null||g.awayScore===null)&&baseIds.has(g.id)).map(marketFixtureKey)];
  const merged=reconcileMarketHistory([...base,...live.filter(g=>Date.parse(g.start)<Date.now())],excluded);
  const value={history:merged.games as FootballGame[],fetchedAt:new Date().toISOString(),fixtures:new Map(live.map(g=>[g.id,g])),conflicts:merged.excluded.filter(k=>k.startsWith(league+'|')).length};
  cache.set(key,{expires:Date.now()+30*60000,value});return value;
 })().catch(e=>{const error=e instanceof Error?e:new Error('聯賽來源失敗');cache.set(key,{expires:Date.now()+30000,error});throw error;}).finally(()=>pending.delete(key));pending.set(key,task);return task;
}
export function applyFootballMarketAnalysis(game:FootballGame,base:FootballAnalysis,context:FootballMarketContext,now=Date.now()):FootballAnalysis{
 const p=selectFootballMarketModel(game.league,now),entry=footballMarketAudit(game.league),age=now-Date.parse(context.fetchedAt),kickoff=Date.parse(game.start),fixture=context.fixtures.get(game.id);
 if(!p||!entry||!fixture||fixture.state!=='scheduled'||fixture.home.id!==game.home.id||fixture.away.id!==game.away.id||Date.parse(fixture.start)!==kickoff||game.state!=='scheduled'||!game.timeConfirmed||!Number.isFinite(kickoff)||kickoff<=now||!Number.isFinite(age)||age<0||age>35*60000)return base;
 const before=Math.min(externalDayCutoff(new Date(now).toISOString()),externalDayCutoff(game.start));
 const history=context.history.filter(g=>g.league===game.league&&g.state==='final'&&g.statusName==='STATUS_FULL_TIME'&&g.homeScore!==null&&g.awayScore!==null&&Date.parse(g.start)<before);
 const elo=new FootballElo();for(const g of history)elo.update({...g,homeId:g.home.id,awayId:g.away.id,homeGoals:g.homeScore!,awayGoals:g.awayScore!,homeXg:null,awayXg:null});
 const target={...game,start:new Date(now).toISOString()},diff=elo.difference({...target,homeId:game.home.id,awayId:game.away.id});
 const f=marketFootballFeatures(target,history,diff,p,before),baseline=marketFootballFeatures(target,history,diff,{decayDays:90,venueWeight:.6},before);
 const evidence={sources:['ESPN'],fetchedAt:context.fetchedAt,historyGames:history.length,conflicts:context.conflicts,homeXgGames:0,awayXgGames:0,modelApplied:false,modelFamily:'score-market' as const,leagueGames:f.leagueGames,reasons:f.enough?[]:[`同賽事近期資料不足：主隊${f.home.games}場、客隊${f.away.games}場，聯賽近一年${f.leagueGames}場；各隊需5場且最近賽果120天內，聯賽至少180場。`]};
 if(!f.enough)return {...base,external:evidence};
 const distribution=marketFootballDistribution(marketFootballRates(f.values,baseline.baseline,p)),probs=distribution.probabilities;
 const best=[{name:'主勝',p:probs.home},{name:'和局',p:probs.draw},{name:'客勝',p:probs.away}].sort((a,b)=>b.p-a.p);
 return {...base,status:'ready',reason:'',version:footballMarketRuntime.version,capturedAt:new Date(now).toISOString(),historyMode:'competition',homeForm:f.home,awayForm:f.away,...distribution,lean:best[0].p-best[1].p>=.08?`模型傾向${best[0].name}`:'勝負接近，保留觀望',external:{...evidence,modelApplied:true},calibration:{status:'applied',label:'比分分布校準・觀察中',version:footballMarketRuntime.version,reasons:[],holdoutGames:entry.sampleSizes.holdout,recentGames:entry.sampleSizes.audit2026,uncertainty:'固定門檻與獨立歷史測試通過；改善幅度與未來表現仍需持續觀察。'},notes:['使用同聯賽近期比分、球隊相對Elo與聯賽近一年主客平均進球；此版本不依賴xG。','勝和負、大小2.5球、雙方進球與預期比分都由同一個校準後比分分布計算。','2005–2009訓練，2010–2011選參數，2012–2013獨立測試；2019–2020、2025與2026另行驗收，所有門檻均通過。','全部特徵只用預測當日前的正式90分鐘賽果；不含升降級附加賽、加時或十二碼。','先發、傷停與實際賠率尚未納入；歷史驗收不保證未來命中率或獲利。']};
}

