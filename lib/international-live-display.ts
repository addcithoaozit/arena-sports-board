export type InternationalLivePerson={id?:string|number|null;name?:string;photoUrls?:string[];confirmation?:string;pitchCount?:number|null;stats?:Record<string,number|null>;order?:number|null;position?:string|null};
type Team={id?:string|number;name:string;score:number|null;hits:number|null;errors:number|null};
export type InternationalLiveGame={key:string;league:string;date:string;status:string;startTime:string|null;sourceStale?:boolean;currentAtBat?:{batterId:string;inning:number;half:string;fetchedAt:string;pitches:import('./international-play-text').TextPitch[]}|null;away:Team;home:Team;currentPitcher?:InternationalLivePerson|null;currentBatter?:InternationalLivePerson|null;inning:number|null;half:string|null;balls:number|null;strikes:number|null;outs:number|null;bases:(boolean|null)[]|null;starters:{away:InternationalLivePerson|null;home:InternationalLivePerson|null};innings:{away:{inning:number;runs:number|null}[];home:{inning:number;runs:number|null}[]};lineups:{away:InternationalLivePerson[];home:InternationalLivePerson[]};batting?:{away:InternationalLivePerson[];home:InternationalLivePerson[]};pitching:{away:InternationalLivePerson[];home:InternationalLivePerson[]};source:{url:string;provider:string;fetchedAt:string};warnings?:string[]};
export type InternationalInningRecord={key:string;inning:number;half:'top'|'bottom';side:'away'|'home';runs:number;awayScore:number|null;homeScore:number|null;active:boolean};
const valid=(n:unknown):n is number=>Number.isInteger(n)&&Number(n)>=0;
/** Inning totals are summaries, never reconstructed at-bats, runners or pitch counts. */
export function internationalInningRecords(game:InternationalLiveGame):InternationalInningRecord[]{
 if(!['live','final','suspended'].includes(game.status))return [];
 const maps={away:new Map<number,number|null>(),home:new Map<number,number|null>()};
 for(const side of ['away','home'] as const)for(const row of game.innings[side]){
  if(!Number.isInteger(row.inning)||row.inning<1||row.inning>50)continue;
  maps[side].set(row.inning,maps[side].has(row.inning)?null:valid(row.runs)?row.runs:null);
 }
 const cumulative=(side:'away'|'home',end:number)=>{let sum=0;for(let i=1;i<=end;i++){const n=maps[side].get(i);if(!valid(n))return null;sum+=n;}return sum;};
 const rows:InternationalInningRecord[]=[];
 for(const side of ['away','home'] as const)for(const [inning,runs] of maps[side]){
  if(!valid(runs))continue;
  const half=side==='away'?'top':'bottom';
  if(game.status==='live'&&game.inning!==null&&(inning>game.inning||inning===game.inning&&game.half==='top'&&half==='bottom'))continue;
  rows.push({key:`${game.key}:${inning}:${half}`,inning,half,side,runs,awayScore:cumulative('away',inning),homeScore:cumulative('home',side==='away'?inning-1:inning),active:game.status==='live'&&inning===game.inning&&half===game.half});
 }
 return rows.sort((a,b)=>a.inning-b.inning||(a.half==='top'?-1:1));
}
export function internationalBatter(game:InternationalLiveGame){
 const batter=game.currentBatter;
 if(!batter?.name)return null;
 const side=game.half==='top'?'away':game.half==='bottom'?'home':null;
 const match=(p:InternationalLivePerson)=>batter.id!=null&&p.id!=null?String(p.id)===String(batter.id):p.name===batter.name;
 const players=side?game.batting?.[side]||[]:[],rows=players.filter(match),lineup=side?game.lineups[side].filter(match):[];
 return {...batter,stats:rows.length===1?rows[0].stats:batter.stats,order:lineup.length===1?lineup[0].order:null,position:lineup.length===1?lineup[0].position:null,side};
}
const positions:Record<string,string>={PITCHER:'投手',CATCHER:'捕手',FIRST_BASE:'一壘手',SECOND_BASE:'二壘手',THIRD_BASE:'三壘手',SHORTSTOP:'游擊手',LEFT_FIELD:'左外野',CENTER_FIELD:'中外野',RIGHT_FIELD:'右外野',DESIGNATED_HITTER:'指定打擊'};
export const internationalPosition=(position?:string|null)=>position?positions[position]||position:'';
