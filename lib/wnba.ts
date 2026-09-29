export type WnbaTeam={id:string;name:string;code:string;logo:string;league:'WNBA'};
// ESPN WNBA IDs; keep identity separate from translated presentation names.
const identities:[string,string,string][]=[["20","ATL","亞特蘭大夢想"],["19","CHI","芝加哥天空"],["18","CON","康乃狄克太陽"],["3","DAL","達拉斯飛翼"],["129689","GS","金州女武神"],["5","IND","印第安納狂熱"],["17","LV","拉斯維加斯王牌"],["6","LA","洛杉磯火花"],["8","MIN","明尼蘇達山貓"],["9","NY","紐約自由人"],["11","PHX","鳳凰城水星"],["132052","POR","波特蘭火焰"],["14","SEA","西雅圖風暴"],["131935","TOR","多倫多節奏"],["16","WSH","華盛頓神秘人"]];
export const WNBA_TEAMS:WnbaTeam[]=identities.map(([id,code,name])=>({id,code,name,league:'WNBA',logo:`https://a.espncdn.com/i/teamlogos/wnba/500/${code.toLowerCase()}.png`}));
export const wnbaTeam=(id:string)=>WNBA_TEAMS.find(t=>t.id===id);
export const wnbaTeamHref=(id:string,day?:string)=>`/teams/wnba/${encodeURIComponent(id)}${day&&validWnbaDay(day)?`?date=${day}`:''}`;
export const wnbaDay=(value:string|number=Date.now())=>new Date(new Date(value).getTime()+8*3600000).toISOString().slice(0,10);
export const shiftWnbaDay=(day:string,n:number)=>new Date(Date.parse(day)+n*86400000).toISOString().slice(0,10);
export const validWnbaDay=(day:string)=>/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day))&&new Date(day).toISOString().slice(0,10)===day;
export const wnbaSeason=(day:string)=>Number(day.slice(0,4));
export const wnbaPhase=(phase:number)=>phase===1?'熱身賽':phase===3?'季後賽':'例行賽';
export const wnbaPeriod=(period:number)=>period>4?`延長${period-4}`:`第${period}節`;
export type WnbaGame={id:string;start:string;season:number;phase:1|2|3;state:'scheduled'|'live'|'final'|'other';statusLabel:string;timeConfirmed:boolean;neutral:boolean;home:WnbaTeam;away:WnbaTeam;homeScore:number|null;awayScore:number|null;period:number;clock:string;quarters:{period:number;home:number|null;away:number|null}[]};
export type WnbaBoard={games:WnbaGame[];day:string;fetchedAt:string;source:'ESPN'};
const points=(v:any):number|null=>{const x=typeof v==='object'&&v!==null?v.value:v;if(x===null||x===undefined||x==='')return null;const n=Number(x);return Number.isInteger(n)&&n>=0&&n<=250?n:null;};
export function parseWnbaEvents(raw:any,teamId?:string):WnbaGame[]{
 if(!Array.isArray(raw?.events))throw Error('WNBA 賽程格式錯誤');
 if(teamId){if(String(raw.team?.id)!==teamId||!wnbaTeam(teamId)||raw.team?.abbreviation!==wnbaTeam(teamId)?.code)throw Error('WNBA 球隊來源不符');}
 else if(!raw.leagues?.some((l:any)=>l.slug==='wnba'&&String(l.id)==='59'))throw Error('WNBA 聯盟來源不符');
 const games:WnbaGame[]=[];
 for(const e of raw.events){
  const c=e.competitions?.[0],status=c?.status||e.status,type=status?.type;
  const home=c?.competitors?.find((t:any)=>t.homeAway==='home'),away=c?.competitors?.find((t:any)=>t.homeAway==='away');
  const h=wnbaTeam(String(home?.team?.id)),a=wnbaTeam(String(away?.team?.id));
  const phase=Number(e.season?.type??e.seasonType?.type??e.seasonType?.id),season=Number(e.season?.year),start=c?.date||e.date;
  if(!h||!a||home.team.abbreviation!==h.code||away.team.abbreviation!==a.code||h.id===a.id||c.competitors.length!==2||!/^\d{1,12}$/.test(String(e.id))||!Number.isFinite(Date.parse(start))||![1,2,3].includes(phase)||!Number.isInteger(season))continue;
  if(e.uid&&!/^s:40~l:59~e:\d+$/.test(e.uid))continue;
  if(teamId&&h.id!==teamId&&a.id!==teamId)throw Error('WNBA 歷史賽程球隊不符');
  const name=String(type?.name||''),statusConflict=!!(e.status?.type?.name&&c.status?.type?.name&&e.status.type.name!==c.status.type.name),blocked=statusConflict||/POSTPONED|CANCELED|CANCELLED|SUSPENDED|DELAYED/.test(name);
  const state:WnbaGame['state']=blocked?'other':type?.completed===true&&name.startsWith('STATUS_FINAL')?'final':type?.state==='in'?'live':name==='STATUS_SCHEDULED'?'scheduled':'other';
  const scores=state==='final'||state==='live',homeScore=scores?points(home.score):null,awayScore=scores?points(away.score):null;
  const timeConfirmed=e.timeValid!==false&&c.timeValid!==false&&name!=='STATUS_TIME_TBD'&&!/TBD|TBA/i.test(`${type?.detail||''} ${type?.shortDetail||''}`);
  const period=Number.isInteger(status?.period)?status.period:0,clock=/^\d{1,2}(?::\d{2})?(?:\.\d)?$/.test(status?.displayClock||'')?status.displayClock:'';
  const statusLabel=state==='final'?(period>4?`已完賽・${wnbaPeriod(period)}`:'已完賽'):state==='live'?(name==='STATUS_HALFTIME'?'中場休息':`${period?wnbaPeriod(period):'進行中'}${clock?' '+clock:''}`):state==='scheduled'?'未開賽':/POSTPONED/.test(name)?'延賽':/CANCEL/.test(name)?'取消':/SUSPENDED|DELAYED/.test(name)?'暫停':'時間待定';
  const periods=[...new Set<number>([...(home.linescores||[]),...(away.linescores||[])].map((q:any)=>Number(q.period)))].filter(p=>Number.isInteger(p)&&p>=1&&p<=20).sort((a,b)=>a-b);
  games.push({id:String(e.id),start,season,phase:phase as 1|2|3,state,statusLabel,timeConfirmed,neutral:c.neutralSite===true,home:h,away:a,homeScore,awayScore,period,clock,quarters:scores?periods.map(p=>({period:p,home:points(home.linescores?.find((q:any)=>q.period===p)),away:points(away.linescores?.find((q:any)=>q.period===p))})):[]});
 }
 return games;
}
export const wnbaFixtureKey=(g:WnbaGame)=>[g.id,g.start,g.season,g.phase,g.home.id,g.away.id,g.neutral].join(':');
// Conflicting completed scores/identities are quarantined, not resolved by array order.
export function reconcileWnbaGames(games:WnbaGame[]):WnbaGame[]{
 const rows=new Map<string,WnbaGame>(),conflicts=new Set<string>();
 for(const g of games){const old=rows.get(g.id);if(old&&(wnbaFixtureKey(old)!==wnbaFixtureKey(g)||old.state==='final'&&g.state==='final'&&(old.homeScore!==g.homeScore||old.awayScore!==g.awayScore))){conflicts.add(g.id);continue;}if(!old||g.state==='final')rows.set(g.id,g);}
 return [...rows.values()].filter(g=>!conflicts.has(g.id));
}
export function wnbaHistory(games:WnbaGame[],teamId:string,cutoff=Date.now()):WnbaGame[]{
 return reconcileWnbaGames(games).filter(g=>g.phase!==1&&g.state==='final'&&(g.home.id===teamId||g.away.id===teamId)&&g.homeScore!==null&&g.awayScore!==null&&g.homeScore!==g.awayScore&&g.homeScore>0&&g.awayScore>0&&Date.parse(g.start)<cutoff&&Date.parse(g.start)>=cutoff-400*86400000).sort((a,b)=>Date.parse(b.start)-Date.parse(a.start));
}
export type WnbaForm={games:number;wins:number;losses:number;pointsFor:number|null;pointsAgainst:number|null;net:number|null;lastPlayed:string|null;results:('W'|'L')[]};
export function wnbaForm(history:WnbaGame[],teamId:string,limit=20):WnbaForm{
 const rows=history.slice(0,limit),own=rows.map(g=>(g.home.id===teamId?g.homeScore:g.awayScore)!),opp=rows.map(g=>(g.home.id===teamId?g.awayScore:g.homeScore)!),avg=(v:number[])=>v.reduce((a,b)=>a+b,0)/v.length;
 const wins=rows.filter((_,i)=>own[i]>opp[i]).length;
 return {games:rows.length,wins,losses:rows.length-wins,pointsFor:rows.length?avg(own):null,pointsAgainst:rows.length?avg(opp):null,net:rows.length?avg(own.map((n,i)=>n-opp[i])):null,lastPlayed:rows[0]?.start||null,results:rows.slice(0,5).map((_,i)=>own[i]>opp[i]?'W':'L')};
}

export const wnbaFirstSeason=(id:string)=>id==='129689'?2025:['132052','131935'].includes(id)?2026:1997;
