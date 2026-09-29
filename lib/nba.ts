export type NbaTeam={id:string;name:string;code:string;logo:string;league?:'NBA'|'WNBA'};
// ESPN NBA IDs; keep identity separate from translated presentation names.
const identities:[string,string,string][]=[['1','ATL','亞特蘭大老鷹'],['2','BOS','波士頓塞爾提克'],['17','BKN','布魯克林籃網'],['30','CHA','夏洛特黃蜂'],['4','CHI','芝加哥公牛'],['5','CLE','克里夫蘭騎士'],['6','DAL','達拉斯獨行俠'],['7','DEN','丹佛金塊'],['8','DET','底特律活塞'],['9','GS','金州勇士'],['10','HOU','休士頓火箭'],['11','IND','印第安納溜馬'],['12','LAC','洛杉磯快艇'],['13','LAL','洛杉磯湖人'],['29','MEM','曼菲斯灰熊'],['14','MIA','邁阿密熱火'],['15','MIL','密爾瓦基公鹿'],['16','MIN','明尼蘇達灰狼'],['3','NO','紐奧良鵜鶘'],['18','NY','紐約尼克'],['25','OKC','奧克拉荷馬雷霆'],['19','ORL','奧蘭多魔術'],['20','PHI','費城七六人'],['21','PHX','鳳凰城太陽'],['22','POR','波特蘭拓荒者'],['23','SAC','沙加緬度國王'],['24','SA','聖安東尼奧馬刺'],['28','TOR','多倫多暴龍'],['26','UTAH','猶他爵士'],['27','WSH','華盛頓巫師']];
export const NBA_TEAMS:NbaTeam[]=identities.map(([id,code,name])=>({id,code,name,logo:`https://a.espncdn.com/i/teamlogos/nba/500/${code.toLowerCase()}.png`}));
export const nbaTeam=(id:string)=>NBA_TEAMS.find(t=>t.id===id);
export const nbaTeamHref=(id:string,day?:string)=>`/teams/nba/${encodeURIComponent(id)}${day&&validNbaDay(day)?`?date=${day}`:''}`;
export const nbaDay=(value:string|number=Date.now())=>new Date(new Date(value).getTime()+8*3600000).toISOString().slice(0,10);
export const shiftNbaDay=(day:string,n:number)=>new Date(Date.parse(day)+n*86400000).toISOString().slice(0,10);
export const validNbaDay=(day:string)=>/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day))&&new Date(day).toISOString().slice(0,10)===day;
export const nbaSeason=(day:string)=>Number(day.slice(0,4))+(Number(day.slice(5,7))>=9?1:0);
export const nbaPhase=(phase:number)=>phase===1?'熱身賽':phase===3?'季後賽':'例行賽';
export const nbaPeriod=(period:number)=>period>4?`延長${period-4}`:`第${period}節`;
export type NbaGame={id:string;start:string;season:number;phase:1|2|3;state:'scheduled'|'live'|'final'|'other';statusLabel:string;timeConfirmed:boolean;neutral:boolean;home:NbaTeam;away:NbaTeam;homeScore:number|null;awayScore:number|null;period:number;clock:string;quarters:{period:number;home:number|null;away:number|null}[]};
export type NbaBoard={games:NbaGame[];day:string;fetchedAt:string;source:'ESPN'};
const points=(v:any):number|null=>{const x=typeof v==='object'&&v!==null?v.value:v;if(x===null||x===undefined||x==='')return null;const n=Number(x);return Number.isInteger(n)&&n>=0&&n<=250?n:null;};
export function parseNbaEvents(raw:any,teamId?:string):NbaGame[]{
 if(!Array.isArray(raw?.events))throw Error('NBA 賽程格式錯誤');
 if(teamId){if(String(raw.team?.id)!==teamId||!nbaTeam(teamId))throw Error('NBA 球隊來源不符');}
 else if(!raw.leagues?.some((l:any)=>l.slug==='nba'&&String(l.id)==='46'))throw Error('NBA 聯盟來源不符');
 const games:NbaGame[]=[];
 for(const e of raw.events){
  const c=e.competitions?.[0],status=c?.status||e.status,type=status?.type;
  const home=c?.competitors?.find((t:any)=>t.homeAway==='home'),away=c?.competitors?.find((t:any)=>t.homeAway==='away');
  const h=nbaTeam(String(home?.team?.id)),a=nbaTeam(String(away?.team?.id));
  const phase=Number(e.season?.type??e.seasonType?.type??e.seasonType?.id),season=Number(e.season?.year),start=c?.date||e.date;
  if(!h||!a||h.id===a.id||c.competitors.length!==2||!/^\d{1,12}$/.test(String(e.id))||!Number.isFinite(Date.parse(start))||![1,2,3].includes(phase)||!Number.isInteger(season))continue;
  if(e.uid&&!/^s:40~l:46~e:\d+$/.test(e.uid))continue;
  if(teamId&&h.id!==teamId&&a.id!==teamId)throw Error('NBA 歷史賽程球隊不符');
  const name=String(type?.name||''),statusConflict=!!(e.status?.type?.name&&c.status?.type?.name&&e.status.type.name!==c.status.type.name),blocked=statusConflict||/POSTPONED|CANCELED|CANCELLED|SUSPENDED|DELAYED/.test(name);
  const state:NbaGame['state']=blocked?'other':type?.completed===true&&name.startsWith('STATUS_FINAL')?'final':type?.state==='in'?'live':name==='STATUS_SCHEDULED'?'scheduled':'other';
  const scores=state==='final'||state==='live',homeScore=scores?points(home.score):null,awayScore=scores?points(away.score):null;
  const timeConfirmed=e.timeValid!==false&&c.timeValid!==false&&name!=='STATUS_TIME_TBD'&&!/TBD|TBA/i.test(`${type?.detail||''} ${type?.shortDetail||''}`);
  const period=Number.isInteger(status?.period)?status.period:0,clock=/^\d{1,2}(?::\d{2})?(?:\.\d)?$/.test(status?.displayClock||'')?status.displayClock:'';
  const statusLabel=state==='final'?(period>4?`已完賽・${nbaPeriod(period)}`:'已完賽'):state==='live'?(name==='STATUS_HALFTIME'?'中場休息':`${period?nbaPeriod(period):'進行中'}${clock?' '+clock:''}`):state==='scheduled'?'未開賽':/POSTPONED/.test(name)?'延賽':/CANCEL/.test(name)?'取消':/SUSPENDED|DELAYED/.test(name)?'暫停':'時間待定';
  const periods=[...new Set<number>([...(home.linescores||[]),...(away.linescores||[])].map((q:any)=>Number(q.period)))].filter(p=>Number.isInteger(p)&&p>=1&&p<=20).sort((a,b)=>a-b);
  games.push({id:String(e.id),start,season,phase:phase as 1|2|3,state,statusLabel,timeConfirmed,neutral:c.neutralSite===true,home:h,away:a,homeScore,awayScore,period,clock,quarters:scores?periods.map(p=>({period:p,home:points(home.linescores?.find((q:any)=>q.period===p)),away:points(away.linescores?.find((q:any)=>q.period===p))})):[]});
 }
 return games;
}
export const nbaFixtureKey=(g:NbaGame)=>[g.id,g.start,g.season,g.phase,g.home.id,g.away.id,g.neutral,g.home.league||'NBA',g.away.league||'NBA'].join(':');
// Conflicting completed scores/identities are quarantined, not resolved by array order.
export function reconcileNbaGames(games:NbaGame[]):NbaGame[]{
 const rows=new Map<string,NbaGame>(),conflicts=new Set<string>();
 for(const g of games){const old=rows.get(g.id);if(old&&(nbaFixtureKey(old)!==nbaFixtureKey(g)||old.state==='final'&&g.state==='final'&&(old.homeScore!==g.homeScore||old.awayScore!==g.awayScore))){conflicts.add(g.id);continue;}if(!old||g.state==='final')rows.set(g.id,g);}
 return [...rows.values()].filter(g=>!conflicts.has(g.id));
}
export function nbaHistory(games:NbaGame[],teamId:string,cutoff=Date.now()):NbaGame[]{
 return reconcileNbaGames(games).filter(g=>g.phase!==1&&g.state==='final'&&(g.home.id===teamId||g.away.id===teamId)&&g.homeScore!==null&&g.awayScore!==null&&g.homeScore!==g.awayScore&&g.homeScore>0&&g.awayScore>0&&Date.parse(g.start)<cutoff&&Date.parse(g.start)>=cutoff-400*86400000).sort((a,b)=>Date.parse(b.start)-Date.parse(a.start));
}
export type NbaForm={games:number;wins:number;losses:number;pointsFor:number|null;pointsAgainst:number|null;net:number|null;lastPlayed:string|null;results:('W'|'L')[]};
export function nbaForm(history:NbaGame[],teamId:string,limit=20):NbaForm{
 const rows=history.slice(0,limit),own=rows.map(g=>(g.home.id===teamId?g.homeScore:g.awayScore)!),opp=rows.map(g=>(g.home.id===teamId?g.awayScore:g.homeScore)!),avg=(v:number[])=>v.reduce((a,b)=>a+b,0)/v.length;
 const wins=rows.filter((_,i)=>own[i]>opp[i]).length;
 return {games:rows.length,wins,losses:rows.length-wins,pointsFor:rows.length?avg(own):null,pointsAgainst:rows.length?avg(opp):null,net:rows.length?avg(own.map((n,i)=>n-opp[i])):null,lastPlayed:rows[0]?.start||null,results:rows.slice(0,5).map((_,i)=>own[i]>opp[i]?'W':'L')};
}

export const basketballTeamHref=(team:NbaTeam,day?:string)=>team.league==='WNBA'?`/teams/wnba/${encodeURIComponent(team.id)}${day&&validNbaDay(day)?`?date=${day}`:''}`:nbaTeamHref(team.id,day);
