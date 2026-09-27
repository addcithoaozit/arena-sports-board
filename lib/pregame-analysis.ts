import {multifactorWin} from './multifactor-win';
import {winnerAnalysis} from './winner-analysis';
import {isFullGamePk,settleBoard} from './board-markets';
import {matchCoversOdds} from './covers-odds';
import {baseProbability,fresh,isPregame,type Match} from './baseball';
import {matchLineup} from './rotowire';
import {resolveOfficialLineup} from './lineup-authority';
import {expectedRuns,scoreGrid,type MarketPick} from './markets';
import {matchOdds} from './pinnacle';
import {superOdds} from './super007';
import {teamZh} from '../app/zh';
export const ANALYSIS_VERSION='pregame-super007-v5-pk-consistent';
export type AnalysisReport={trialWin?:ReturnType<typeof multifactorWin>;version:string;game:Match;capturedAt:string;issues:string[];notes:string[];features:Record<string,number|null>;context:any;baseline:any;candidate:{status:'waiting_data'|'untrained';probabilities:null;modelApplied:false};sources:Record<string,{fetchedAt:string|null;source:string|null;usable:boolean}>;storage?:{saved:boolean;reason?:string}};
const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+(?:jr\.?|sr\.?|ii|iii|iv)$/, '').replace(/[^a-z0-9]/g,'');
const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:null;
export function inningsOuts(v:unknown):number|null{const m=String(v??'').match(/^(\d+)\.([012])$/);return m?+m[1]*3+(+m[2]):/^\d+$/.test(String(v))?+String(v)*3:null;}
export function assembleAnalysis(g:Match,input:Record<string,any>,now=Date.now()):AnalysisReport{
 const gameDay=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(g.date));
 const issues:string[]=[],notes:string[]=[],sources:AnalysisReport['sources']={};
 const get=(key:string,ttl:number)=>{const s=input[key];const usable=!!s&&!s.error&&fresh(s.fetchedAt,now,ttl)&&(s.year===undefined||s.year===g.season)&&(s.season===undefined||s.season===g.season);sources[key]={fetchedAt:s?.fetchedAt??null,source:s?.source??null,usable};return usable?s:null;};
 const lineupSnapshot=get('lineups',180000),resolution=resolveOfficialLineup(g,matchLineup(g,lineupSnapshot)),lineup=resolution.lineup;
 if(resolution.conflicts.length){
  notes.push(...resolution.conflicts,'已排除先發不同的打線來源；基本試算仍使用官方賽程與球隊本季資料');
  issues.push('打線來源先發與 MLB 官方不同，該打線尚未採用');
  sources.lineups.usable=false;
 }else if(!lineup)issues.push('打線／天氣尚未對應本場日期與開賽時間');
 const bullpen=get('bullpen',15*60000),injuries=get('fg-injuries',75*60000);
 if(!bullpen)issues.push('牛棚用量未取得或過期');if(!injuries)issues.push('傷兵資料未取得或過期');
 const features:Record<string,number|null>={},context:any={sides:{},weather:null,lineupResolution:{authority:'MLB',conflicts:resolution.conflicts,secondaryLineupExcluded:resolution.conflicts.length>0}};
 context.statcastHistory={away:input['statcast-away']??null,home:input['statcast-home']??null,modelApplied:false};
 context.retrosheet=input.retrosheet&&!input.retrosheet.error?input.retrosheet:null;
 const parks=get('fg-park',25*3600000);
 context.parkFactors=parks?.factorSeason===g.season-1?{factorSeason:parks.factorSeason,homeTeamReference:parks.rows.find((r:any)=>r.teamId===g.home.id)??null,scale:parks.scale,venueVerified:false,modelApplied:false}:null;
 const covers=get('covers-odds',600000);
 const coversGame=matchCoversOdds(g,covers,now);
 context.coversOdds={status:coversGame?'comparison_only':'unavailable',sourceUpdatedAt:covers?.sourceUpdatedAt??null,game:coversGame,modelApplied:false};
 if(sources['covers-odds'])sources['covers-odds'].usable=!!coversGame;
 for(const side of ['away','home'] as const){
  const own=g[side],other=side==='away'?'home':'away',label=side==='away'?'客隊':'主隊',ls=lineup?.[side];
  const roster=get('roster-'+own.id,75*60000);
  const people:any[]=roster?.players??[];
  const resolve=(name:string)=>{const hits=people.filter(p=>norm(p.name)===norm(name));return hits.length===1?hits[0]:null;};
  if(!roster)issues.push(label+'球員編號名單未取得');
  if(ls?.status!=='confirmed')issues.push(label+'打線未確認');
  const opposingRoster=get('roster-'+g[other].id,75*60000);
  const sp=opposingRoster?.players.find((p:any)=>p.id===g[other].pitcherId);
  const hand=sp?.throws;if(!['L','R'].includes(hand))issues.push(label+'對方先發投手或投球慣用手未確認');
  // No fuzzy name or initial matching: unresolved players stay missing.
  const bats=get(hand==='L'?'fg-bat-left':'fg-bat-right',75*60000);
  const lineupPlayers=(ls?.players??[]).map((p:any,order:number)=>{const person=resolve(p.name),rows=bats?.rows.filter((r:any)=>r.playerId===person?.id)??[];const split=rows.length===1?rows[0]:null;return {order:order+1,name:p.name,playerId:person?.id??null,bats:p.bats,opponentHand:hand??null,pa:split?.sampleSize??null,wrcPlus:split?.metrics['wRC+']??null,woba:split?.metrics.wOBA??null};});
  if(lineupPlayers.length!==9||lineupPlayers.some((p:any)=>!p.playerId))issues.push(label+'九棒球員編號尚未完整對應');
  const sufficient=lineupPlayers.length===9&&lineupPlayers.every((p:any)=>p.pa>=30&&num(p.wrcPlus)!==null&&num(p.woba)!==null);
  if(!sufficient)issues.push(label+'對應左右投的打者分項不足（每人至少 30 打席）');
  features[side+'_lineup_wrc_plus']=sufficient?lineupPlayers.reduce((s:number,p:any)=>s+p.wrcPlus,0)/9:null;
  features[side+'_lineup_woba']=sufficient?lineupPlayers.reduce((s:number,p:any)=>s+p.woba,0)/9:null;
  const ownSP=people.find(p=>p.id===own.pitcherId);
  const left=get('fg-pit-left',75*60000),right=get('fg-pit-right',75*60000);
  const split=(s:any)=>{const rows=s?.rows.filter((r:any)=>r.playerId===own.pitcherId)??[];return rows.length===1?rows[0]:null;};
  const pl=split(left),pr=split(right);
  for(const [key,row] of [['left',pl],['right',pr]] as const){features[side+'_starter_fip_vs_'+key]=row?.sampleSize>=50?num(row.metrics.FIP):null;features[side+'_starter_kbb_vs_'+key]=row?.sampleSize>=50?num(row.metrics['K-BB%']):null;}
  if(!pl||!pr||pl.sampleSize<50||pr.sampleSize<50)issues.push(label+'先發投手左右打分項缺漏');
  const history=get('pitcher-'+own.pitcherId,75*60000);
  const prior=(history?.pitcherId===own.pitcherId?history.games:[])?.filter((x:any)=>x.date<gameDay)??[];
  const outs=prior.map((x:any)=>inningsOuts(x.innings));
  const complete=prior.length>=3&&outs.every((x:any)=>x!==null)&&prior.every((x:any)=>num(x.earnedRuns)!==null&&num(x.officialPitchCount)!==null);
  const sumOuts=outs.reduce((a:number,b:number|null)=>a+(b??0),0);
  features[side+'_starter_recent_era']=complete&&sumOuts>0?prior.reduce((a:number,b:any)=>a+b.earnedRuns,0)*27/sumOuts:null;
  features[side+'_starter_recent_pitches']=complete?prior.reduce((a:number,b:any)=>a+b.officialPitchCount,0)/prior.length:null;
  features[side+'_starter_rest_days']=prior.length?Math.floor((Date.parse(gameDay+'T12:00:00Z')-Date.parse(prior[0].date+'T12:00:00Z'))/86400000)-1:null;
  if(!complete)issues.push(label+'先發近況不足 3 場完整紀錄');
  const relievers=(bullpen?.rows??[]).filter((r:any)=>r.teamId===own.id).map((r:any)=>({...r,playerId:resolve(r.name)?.id??null}));
  features[side+'_bullpen_last3_pitches']=relievers.length&&relievers.every((p:any)=>num(p.last3)!==null)?relievers.reduce((n:number,p:any)=>n+p.last3,0):null;
  features[side+'_bullpen_back_to_back']=relievers.length&&relievers.every((p:any)=>p.days[0]!==null&&p.days[1]!==null)?relievers.filter((p:any)=>p.days[0]>0&&p.days[1]>0).length:null;
  if(!relievers.length)issues.push(label+'牛棚用量缺漏');
  const injured=(injuries?.rows??[]).filter((r:any)=>r.teamId===own.id&&r.activeInjury&&!r.returnDate);
  const conflicts=injured.filter((r:any)=>r.playerId===own.pitcherId||lineupPlayers.some((p:any)=>p.playerId===r.playerId));
  if(conflicts.length)issues.push(label+'出賽名單與傷兵記錄衝突，需確認');
  context.sides[side]={lineupStatus:ls?.status??'unknown',lineup:lineupPlayers,starterId:own.pitcherId,starterName:own.pitcherName,starterHand:ownSP?.throws??null,recentGames:prior.map(({sample,...r}:any)=>r),speedChanges:history?.speedChanges??[],bullpen:relievers,injuries:injured};
 }
 if(lineup){context.weather={temperatureF:lineup.temperatureF,windMph:lineup.windMph,windDirection:lineup.windDirection,precipitation:lineup.precipitation,dome:lineup.dome,umpire:lineup.umpire};if(!lineup.dome&&(lineup.temperatureF===null||lineup.windMph===null))issues.push('室外球場天氣資料缺漏');}
 features.temperature_f=lineup?.dome?null:lineup?.temperatureF??null;features.wind_mph=lineup?.dome?null:lineup?.windMph??null;features.dome=lineup?Number(lineup.dome):null;
 notes.push('球場因子需核對本場實際場地，屋頂實際開關狀態與歷史賽前快照仍需補齊','已取得分項供多因素試算使用；初始權重未經回測校準','抓取時間不等於來源數據更新時間；無來源時間的資料需持續核對');
 const runs=get('runs',25*60000),source=get('super007',150000),odds=source?superOdds(source,[g],teamZh):null,expected=runs?expectedRuns(g,runs):null,quote=matchOdds(g,odds);
 const probabilities:any[]=[];
 if(!quote)notes.push('本場即時資料未對應或過期，無法保存資料比較');
 if(!isPregame(g,now))issues.push('已開賽或非可分析的例行賽');
 const report:AnalysisReport={version:ANALYSIS_VERSION,game:g,capturedAt:new Date(now).toISOString(),issues:[...new Set(issues)],notes,features,context,baseline:{version:'season-runs-v2-pk-winner',expectedRuns:expected,homeWin:baseProbability(g),markets:probabilities},candidate:{status:issues.length?'waiting_data':'untrained',probabilities:null,modelApplied:false},sources};
 report.trialWin=multifactorWin(g,report,now);
 const win=winnerAnalysis(g,report,now,true);
 if(expected){const grid=scoreGrid(expected.away,expected.home);for(const market of ['spread','total'] as const){const q=quote?.[market];if(!q)continue;for(const side of (market==='spread'?['home','away']:['over','under']) as MarketPick['side'][]){const pick:MarketPick={gameId:g.id,market,side,line:q.line,quote:q.signature,boundary:q.boundary,parts:q.parts,display:q.display};probabilities.push({pick,source:'Super007',quoteFetchedAt:source.fetchedAt,netOdds:side==='home'||side==='over'?q.first:q.second,modelVersion:isFullGamePk(pick)?win.version:'season-runs-v1',probability:settleBoard(grid,{...pick,key:market},win.canEstimate?win.homeWin:null)});}}}
 return report;
}
