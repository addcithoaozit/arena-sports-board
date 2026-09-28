// Server-only external history and source adapters. Never import from client UI.
import archive from '../data/football/external-history-20260927.json';
import identities from '../data/football/external-team-map.json';
import quarantine from '../data/football/external-quarantine.json';
import {analyzeFootball,footballDistribution,parseFootballEvents,type FootballAnalysis,type FootballGame,type FootballLeague} from './football';
import {externalAsGame,externalDayCutoff,externalFootballFeatures,FootballElo,type ExternalFootballGame} from './football-xg-features';
import {externalFootballRates,footballExternalRuntime,footballExternalAudit,selectExternalFootballModel} from './football-external-model';
const SLUGS:Partial<Record<FootballLeague,string>>={'eng.1':'EPL','esp.1':'La_liga','ita.1':'Serie_A','ger.1':'Bundesliga','fra.1':'Ligue_1'};
const map=identities.teams as Record<string,{name:string;understat:string|null;openfootball:string|null}>;
const reverse=new Map<string,string>();for(const [id,v] of Object.entries(map))for(const key of [v.understat,v.openfootball])if(key)reverse.set(key,id);
const externalId=(id:string,league:FootballLeague)=>league==='uefa.champions'?(map[id]?.openfootball||'espn:'+id):map[id]?.understat||null;
const archived:ExternalFootballGame[]=archive.games.map(r=>({id:String(r[0]),league:String(r[1]) as FootballLeague,start:String(r[2]),homeId:String(r[3]),awayId:String(r[4]),homeGoals:Number(r[5]),awayGoals:Number(r[6]),homeXg:r[7]===null?null:Number(r[7]),awayXg:r[8]===null?null:Number(r[8]),neutral:!!r[9]}));
type ExcludedFixture={pair:string;day:number};
type Context={history:ExternalFootballGame[];fetchedAt:string;teams:Set<string>;conflicts:number;sources:string[];excluded?:ExcludedFixture[]};
const cache=new Map<string,{expires:number;value?:Context;error?:Error}>(),pending=new Map<string,Promise<Context>>();
let active=0;const queue:(()=>void)[]=[];
async function fetchJson(url:string,headers?:Record<string,string>){
 if(active>=2)await new Promise<void>(r=>queue.push(r));else active++;
 try{const r=await fetch(url,{headers,cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('外部足球來源無法更新');const text=await r.text();if(text.length>12000000)throw Error('外部資料過大');return JSON.parse(text);}
 finally{const next=queue.shift();if(next)next();else active--;}
}
export function parseUnderstatGames(data:any,league:FootballLeague,now=Date.now()):ExternalFootballGame[]{
 if(!Array.isArray(data?.dates)||data.dates.length>3000||!data?.teams||typeof data.teams!=='object')throw Error('xG來源格式異常');
 const out:ExternalFootballGame[]=[];
 for(const r of data.dates){
  if(r.isResult!==true||!/^\d+$/.test(String(r.id))||!/^\d+$/.test(String(r.h?.id))||!/^\d+$/.test(String(r.a?.id))||String(r.h.id)===String(r.a.id))continue;
  if(!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(r.datetime||''))continue;
  const start=r.datetime.replace(' ','T')+'Z',ts=Date.parse(start);
  if(!Number.isFinite(ts)||ts>=now||!/^\d+$/.test(String(r.goals?.h))||!/^\d+$/.test(String(r.goals?.a)))continue;
  if(r.xG?.h===null||r.xG?.a===null||r.xG?.h===''||r.xG?.a==='')continue;
  const hg=Number(r.goals.h),ag=Number(r.goals.a),hx=Number(r.xG?.h),ax=Number(r.xG?.a);
  if(![hg,ag].every(n=>n>=0&&n<=30)||![hx,ax].every(n=>Number.isFinite(n)&&n>=0&&n<=20))continue;
  out.push({id:'us:'+r.id,league,start,homeId:'us:'+r.h.id,awayId:'us:'+r.a.id,homeGoals:hg,awayGoals:ag,homeXg:hx,awayXg:ax,neutral:false});
 }
 return out;
}
function isQuarantined(g:ExternalFootballGame){return quarantine.matches.some(q=>q.league===g.league&&q.homeId===g.homeId&&q.awayId===g.awayId&&Math.abs(Date.parse(q.day)-externalDayCutoff(g.start))<=86400000);}
// Match by both identities and calendar proximity. An unresolved disagreement
// excludes both records; different provider IDs cannot double the sample count.
export function mergeExternalFootballHistory(base:ExternalFootballGame[],live:ExternalFootballGame[],excluded:ExcludedFixture[]=[]){
 const rows=new Map<string,ExternalFootballGame>(),pairs=new Map<string,Set<string>>(),blocked=[...excluded];let conflicts=0;
 const pair=(g:ExternalFootballGame)=>[g.league,g.homeId,g.awayId].join('|');
 const add=(g:ExternalFootballGame)=>{rows.set(g.id,g);const key=pair(g);if(!pairs.has(key))pairs.set(key,new Set());pairs.get(key)!.add(g.id);};
 const isBlocked=(g:ExternalFootballGame)=>blocked.some(b=>b.pair===pair(g)&&Math.abs(b.day-externalDayCutoff(g.start))<=86400000);
 for(const g of base)if(!isQuarantined(g)&&!isBlocked(g))add(g);
 for(const g of live){
  if(isQuarantined(g))continue;
  const key=pair(g),day=externalDayCutoff(g.start),candidates=[...(pairs.get(key)||[])].map(id=>rows.get(id)).filter((r):r is ExternalFootballGame=>!!r&&Math.abs(externalDayCutoff(r.start)-day)<=86400000);
  if(isBlocked(g))continue;
  if(candidates.length>1||candidates.some(r=>r.homeGoals!==g.homeGoals||r.awayGoals!==g.awayGoals)||rows.has(g.id)&&pair(rows.get(g.id)!)!==key){
   const reused=rows.get(g.id);if(reused)blocked.push({pair:pair(reused),day:externalDayCutoff(reused.start)});
   for(const r of candidates)rows.delete(r.id);rows.delete(g.id);blocked.push({pair:key,day});conflicts++;continue;
  }
  const old=candidates[0];if(old)rows.delete(old.id);
  // ESPN updates a CC0 date-only result, but cannot erase its xG if present.
  add({...g,id:old?.id||g.id,homeXg:g.homeXg??old?.homeXg??null,awayXg:g.awayXg??old?.awayXg??null});
 }
 return {games:[...rows.values()].sort((a,b)=>Date.parse(a.start)-Date.parse(b.start)||a.id.localeCompare(b.id)),conflicts,excluded:blocked};
}
function fromEspn(g:FootballGame<string>):ExternalFootballGame|null{
 const league=g.league as FootballLeague,h=externalId(g.home.id,league),a=externalId(g.away.id,league);
 if(!h||!a||g.state!=='final'||g.statusName!=='STATUS_FULL_TIME'||g.homeScore===null||g.awayScore===null)return null;
 return {id:'espn:'+g.id,league,start:g.start,homeId:h,awayId:a,homeGoals:g.homeScore,awayGoals:g.awayScore,homeXg:null,awayXg:null,neutral:g.neutral};
}
export async function loadExternalFootballContext(league:FootballLeague,now=Date.now()):Promise<Context>{
 const year=new Date(now).getUTCFullYear(),season=new Date(now).getUTCMonth()>=6?year:year-1,key=league+':'+season,hit=cache.get(key);
 if(hit&&hit.expires>now){if(hit.error)throw hit.error;return hit.value!;}if(pending.has(key))return pending.get(key)!;
 const task=(async()=>{
  let live:ExternalFootballGame[]=[],teams=new Set<string>(),sources:string[];
  if(league==='uefa.champions'){
   const responses=await Promise.all([year-1,year].map(y=>fetchJson(`https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/scoreboard?dates=${y}&limit=1000`)));
   for(const d of responses){if(!Array.isArray(d.events)||d.events.length>=1000)throw Error('歐冠年度資料不完整');for(const g of parseFootballEvents(d,league)){teams.add(externalId(g.home.id,league)!);teams.add(externalId(g.away.id,league)!);const r=fromEspn(g);if(r&&Date.parse(r.start)<now)live.push(r);}}
   sources=['OpenFootball','ESPN'];
  }else{
   const slug=SLUGS[league];if(!slug)throw Error('沒有對應xG來源');
   const d=await fetchJson(`https://understat.com/getLeagueData/${slug}/${season}`,{'X-Requested-With':'XMLHttpRequest','Referer':`https://understat.com/league/${slug}/${season}`});
   live=parseUnderstatGames(d,league,now);teams=new Set(Object.keys(d.teams).map(id=>'us:'+id));sources=['Understat','ESPN'];
  }
  const merged=mergeExternalFootballHistory(archived.filter(g=>g.league===league),live);
  const value={history:merged.games,fetchedAt:new Date().toISOString(),teams,conflicts:merged.conflicts,sources,excluded:merged.excluded};cache.set(key,{expires:Date.now()+30*60000,value});return value;
 })().catch(e=>{cache.set(key,{expires:Date.now()+30000,error:e instanceof Error?e:new Error('外部來源失敗')});throw e;}).finally(()=>pending.delete(key));
 pending.set(key,task);return task;
}
export function applyExternalFootballAnalysis(game:FootballGame,base:FootballAnalysis,primary:FootballGame<string>[],context:Context,now=Date.now()):FootballAnalysis{
 const h=externalId(game.home.id,game.league),a=externalId(game.away.id,game.league);
 const age=now-Date.parse(context.fetchedAt),kickoff=Date.parse(game.start);
 if(!h||!a||!context.teams.has(h)||!context.teams.has(a)||game.state!=='scheduled'||!game.timeConfirmed||!Number.isFinite(kickoff)||kickoff<=now||!Number.isFinite(age)||age<0||age>35*60000)return base;
 const merged=mergeExternalFootballHistory(context.history,primary.filter(g=>g.league===game.league).map(fromEspn).filter((g):g is ExternalFootballGame=>!!g),context.excluded);
 const before=Math.min(externalDayCutoff(new Date(now).toISOString()),externalDayCutoff(game.start)),history=merged.games.filter(g=>Date.parse(g.start)<before);
 const target={homeId:h,awayId:a,start:new Date(now).toISOString(),league:game.league,neutral:game.neutral},elo=new FootballElo();for(const g of history)elo.update(g);
 const p=selectExternalFootballModel(game.league,now),baseline=externalFootballFeatures(target,history,elo.difference(target),{decayDays:90,venueWeight:.6},before);
 const features=externalFootballFeatures(target,history,elo.difference(target),p||{decayDays:90,venueWeight:.6},before);
 const reasons:string[]=[];
 if(!p)reasons.push('本聯賽新候選未啟用或已過期，保留原模型。');
 if(!features.enough)reasons.push(`同賽事近期資料不足：主隊${features.home.games}場、客隊${features.away.games}場；每隊需至少5場且最近賽果在120天內。`);
 if(p?.usesXg&&!features.xgEnough)reasons.push(`xG覆蓋不足：主隊${features.home.xgGames}場、客隊${features.away.xgGames}場；需至少5場且覆蓋80%。`);
 const evidence={reasons,sources:context.sources,fetchedAt:context.fetchedAt,historyGames:history.length,conflicts:context.conflicts+merged.conflicts,homeXgGames:features.home.xgGames,awayXgGames:features.away.xgGames,modelApplied:false};
 let result={...base,external:evidence};
 if(base.status!=='ready'&&baseline.enough){
  const asEspn=history.map(g=>{const r=externalAsGame(g),convert=(id:string)=>reverse.get(id)||(id.startsWith('espn:')?id.slice(5):id);r.home.id=convert(g.homeId);r.away.id=convert(g.awayId);return r;});
  result={...analyzeFootball(game,asEspn,now),quality:base.quality,external:evidence};
 }
 const entry=footballExternalAudit(game.league);
 if(!p||!entry||!features.enough||(p.usesXg&&!features.xgEnough))return result;
 const rates=externalFootballRates(features.values,baseline.values,p),distribution=footballDistribution(rates.home,rates.away,rates.rho),probs=distribution.probabilities;
 const best=[{name:'主勝',p:probs.home},{name:'和局',p:probs.draw},{name:'客勝',p:probs.away}].sort((x,y)=>y.p-x.p);
 return {...result,status:'ready',reason:'',capturedAt:new Date(now).toISOString(),version:footballExternalRuntime.version,historyMode:'competition',homeForm:features.home,awayForm:features.away,expected:{home:rates.home,away:rates.away},...distribution,lean:best[0].p-best[1].p>=.08?`模型傾向${best[0].name}`:'勝負接近，保留觀望',external:{...evidence,modelApplied:true},calibration:{status:'applied',label:'外部資料校準・觀察中',version:footballExternalRuntime.version,reasons:[],holdoutGames:entry.sampleSizes.holdout,recentGames:entry.sampleSizes.audit2026,uncertainty:'獨立歷史測試與近期驗收通過，仍需持續觀察上線後表現。'},notes:[`${context.sources.join('＋')}逐場資料；${p.usesXg?'加入歷史xG、':'使用歷史進球、'}對手Elo、時間衰減及場地差異。`,'所有特徵只用預測當日之前的有效賽果；不使用本場賽後xG或收盤賠率。','2019–2020獨立測試；2025、2026另行驗收。候選未通過的聯賽保留原模型。','尚未納入確認先發與傷停；歷史改善不保證未來命中率或獲利。']};
}
