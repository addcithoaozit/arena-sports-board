import {nbaFixtureKey,nbaForm,nbaHistory,type NbaGame,type NbaForm} from './nba';
export type BasketballLeague='NBA'|'WNBA';
export type Weights=[number,number,number,number,number];
export const DEFAULT_WEIGHTS:Weights=[20,20,20,20,20];
export function normalizedWeights(values:readonly number[]):Weights{if(values.length!==5||values.some(v=>!Number.isFinite(v)||v<0||v>100)||values.reduce((a,b)=>a+b,0)<=0)throw Error('分析權重錯誤');const sum=values.reduce((a,b)=>a+b,0);return values.map(v=>v/sum) as Weights;}
export const weightKey=(values:readonly number[])=>normalizedWeights(values).map(v=>v.toFixed(8)).join(',');
export function parseWeights(value:string|null):Weights{if(value===null)return [...DEFAULT_WEIGHTS];const fields=value.split(',');if(fields.some(f=>!/^\d+(?:\.\d+)?$/.test(f)))throw Error('分析權重錯誤');const weights=fields.map(Number);normalizedWeights(weights);return weights as Weights;}
export type BoxTeam={id:string;points:number;fga:number;fgm:number;threeMade:number;threeAttempted:number;fta:number;ftm:number;oreb:number;turnovers:number};
export type EfficiencyBox={key:string;league:BasketballLeague;id:string;start:string;minutes:number;possessions:number;home:BoxTeam;away:BoxTeam};
const integer=(v:unknown)=>{if(typeof v!=='number'||!Number.isInteger(v)||v<0)throw Error('比分數據不完整');return v;};
export function parseEfficiencyBox(raw:any,game:NbaGame,league:BasketballLeague):EfficiencyBox{
 const c=raw?.header?.competitions?.[0],leagueId=league==='NBA'?'46':'59';
 if(String(raw?.header?.id)!==game.id||String(c?.id)!==game.id||c.uid!==`s:40~l:${leagueId}~e:${game.id}~c:${game.id}`||Date.parse(c.date)!==Date.parse(game.start)||c.status?.type?.completed!==true||!String(c.status.type.name).startsWith('STATUS_FINAL')||!Array.isArray(c.competitors)||c.competitors.length!==2||!Array.isArray(raw.boxscore?.teams)||raw.boxscore.teams.length!==2)throw Error('比賽數據來源不符');
 const read=(side:'home'|'away'):BoxTeam=>{
  const id=game[side].id,head=c.competitors.find((t:any)=>t.homeAway===side),box=raw.boxscore.teams.find((t:any)=>String(t.team?.id)===id);
  if(String(head?.id)!==id||Number(head.score)!==game[`${side}Score`]||box?.team?.uid!==`s:40~l:${leagueId}~t:${id}`||!Array.isArray(box.statistics))throw Error('球隊數據來源不符');
  const values=new Map<string,string>(box.statistics.map((s:any)=>[String(s.name),String(s.displayValue)]));
  const count=(name:string)=>{const s=values.get(name);if(!s||!/^\d+$/.test(s))throw Error('球隊數據不完整');return integer(Number(s));};
  const pair=(name:string)=>{const s=values.get(name);if(!s||!/^\d+\s*-\s*\d+$/.test(s))throw Error('投籃數據不完整');const [made,attempted]=s.split('-').map(Number);if(made>attempted)throw Error('投籃數據不符');return [made,attempted];};
  const [fgm,fga]=pair('fieldGoalsMade-fieldGoalsAttempted'),[threeMade,threeAttempted]=pair('threePointFieldGoalsMade-threePointFieldGoalsAttempted'),[ftm,fta]=pair('freeThrowsMade-freeThrowsAttempted'),points=integer(game[`${side}Score`]),oreb=count('offensiveRebounds'),turnovers=count(values.has('totalTurnovers')?'totalTurnovers':'turnovers');
  if(fga<=0||threeMade>fgm||threeAttempted>fga||oreb>fga-fgm+fta-ftm||2*fgm+threeMade+ftm!==points)throw Error('投籃與完賽比分不符');
  return {id,points,fgm,fga,threeMade,threeAttempted,fta,ftm,oreb,turnovers};
 };
 const home=read('home'),away=read('away'),periods=c.competitors.map((t:any)=>t.linescores?.length||0),period=game.period||periods[0];
 if(!Number.isInteger(period)||period<4||period>20||periods.some((p:number)=>p!==period))throw Error('比賽節數不完整');
 const minutes=(league==='NBA'?48:40)+(period-4)*5,possessions=([home,away].reduce((n,t)=>n+t.fga+.44*t.fta-t.oreb+t.turnovers,0))/2;
 if(!Number.isFinite(possessions)||possessions<=0)throw Error('回合數不完整');
 return {key:nbaFixtureKey(game),league,id:game.id,start:game.start,minutes,possessions,home,away};
}
export type EfficiencyMetrics={games:number;ortg:number;drtg:number;pace:number;threePct:number;threeRate:number;ftRate:number;observations:{offense:number;defense:number;three:number|null;freeThrows:number;margin:number}[]};
export function efficiencyMetrics(boxes:EfficiencyBox[],teamId:string,league:BasketballLeague):EfficiencyMetrics{
 if(boxes.length<8||boxes.some(b=>b.league!==league||b.home.id!==teamId&&b.away.id!==teamId)||new Set(boxes.map(b=>b.id)).size!==boxes.length)throw Error('效率樣本不足或不符');
 let points=0,against=0,possessions=0,minutes=0,threes=0,threeAttempts=0,fta=0,fga=0;
 const observations=boxes.map(b=>{const t=b.home.id===teamId?b.home:b.away,o=b.home.id===teamId?b.away:b.home;points+=t.points;against+=o.points;possessions+=b.possessions;minutes+=b.minutes;threes+=t.threeMade;threeAttempts+=t.threeAttempted;fta+=t.fta;fga+=t.fga;return {offense:t.points/b.possessions*100,defense:o.points/b.possessions*100,three:t.threeAttempted?t.threeMade/t.threeAttempted:null,freeThrows:t.fta/t.fga,margin:t.points-o.points};});
 if(!threeAttempts||!fga||!possessions||!minutes)throw Error('效率指標不足');
 return {games:boxes.length,ortg:points/possessions*100,drtg:against/possessions*100,pace:possessions/minutes*(league==='NBA'?48:40),threePct:threes/threeAttempts,threeRate:threeAttempts/fga,ftRate:fta/fga,observations};
}
const variance=(values:number[])=>{const mean=values.reduce((a,b)=>a+b,0)/values.length;return values.reduce((a,v)=>a+(v-mean)**2,0)/values.length;};
const standardized=(delta:number,values:number[])=>{const sd=Math.sqrt(variance(values));return sd>1e-9?delta/sd:0;};
export function projectEfficiency(home:EfficiencyMetrics,away:EfficiencyMetrics,league:BasketballLeague,neutral:boolean,values:readonly number[]=DEFAULT_WEIGHTS){
 const weights=normalizedWeights(values),alpha=4,hca=neutral?0:2.5;
 const rows=[...home.observations,...away.observations];
 const deltas=[standardized(home.ortg-away.ortg,rows.map(r=>r.offense)),standardized(away.drtg-home.drtg,rows.map(r=>r.defense)),standardized(home.threePct-away.threePct,rows.flatMap(r=>r.three===null?[]:[r.three])),standardized(home.ftRate-away.ftRate,rows.map(r=>r.freeThrows))];
 const projectedPace=(home.pace+away.pace)/2,finalPace=projectedPace*(1+(weights[4]-.2)*.1),adjustment=alpha*deltas.reduce((n,d,i)=>n+weights[i]*d,0);
 const baselineHome=((home.ortg+away.drtg)/2+hca)*finalPace/100,baselineAway=((away.ortg+home.drtg)/2)*finalPace/100;
 const expectedHome=baselineHome+adjustment,expectedAway=baselineAway-adjustment;
 // User explicitly requested identical model parameters for NBA and WNBA.
 const sigma=10.5;
 if(![expectedHome,expectedAway,sigma,...deltas].every(Number.isFinite)||expectedHome<=0||expectedAway<=0)throw Error('效率預估無效');
 return {home:expectedHome,away:expectedAway,weights,alpha,hca,deltas,projectedPace,finalPace,baselineHome,baselineAway,adjustment,sigma};
}
export function simulateMargin(margin:number,sigma:number,identity:string){
 if(!Number.isFinite(margin)||!Number.isFinite(sigma)||sigma<=0)throw Error('模擬參數錯誤');
 let seed=2166136261;for(const c of identity){seed^=c.charCodeAt(0);seed=Math.imul(seed,16777619);}const initialSeed=seed>>>0;
 const uniform=()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
 let homeWins=0;const margins:number[]=[];
 // Antithetic normal draws: 5,000 pairs = 10,000 results. Reproducible and
 // symmetric, so sampling noise cannot recommend the lower expected-score side.
 for(let i=0;i<5000;i++){const z=Math.sqrt(-2*Math.log(Math.max(Number.EPSILON,uniform())))*Math.cos(2*Math.PI*uniform());for(const v of [margin+sigma*z,margin-sigma*z]){margins.push(v);if(v>0)homeWins++;else if(v===0)homeWins+=.5;}}
 margins.sort((a,b)=>a-b);return {iterations:10000,homeWins,awayWins:10000-homeWins,home:homeWins/10000,away:1-homeWins/10000,sigma,seed:initialSeed,marginP10:margins[999],marginP50:(margins[4999]+margins[5000])/2,marginP90:margins[8999],distribution:'normal-margin' as const};
}
export type EfficiencyAnalysis={status:'ready'|'waiting';capturedAt:string;homeForm:NbaForm;awayForm:NbaForm;expected?:{home:number;away:number;total:number;margin:number};probabilities?:{home:number;away:number};model:'nba-efficiency-monte-carlo-v2'|'wnba-efficiency-monte-carlo-v2';weightsKey:string;simulation?:ReturnType<typeof simulateMargin>;inputs?:{home:Omit<EfficiencyMetrics,'observations'>;away:Omit<EfficiencyMetrics,'observations'>;calculation:ReturnType<typeof projectEfficiency>;possessionsMethod:string}};
export function efficiencyHistory(game:NbaGame,history:NbaGame[],teamId:string,league:BasketballLeague,now=Date.now()){
 return nbaHistory(history.filter(g=>(g.home.league||'NBA')===league&&(g.away.league||'NBA')===league),teamId,Math.min(now,Date.parse(game.start))).slice(0,20);
}
export function analyzeEfficiency(game:NbaGame,history:NbaGame[],boxes:EfficiencyBox[],league:BasketballLeague,values:readonly number[]=DEFAULT_WEIGHTS,now=Date.now()):EfficiencyAnalysis{
 const home=efficiencyHistory(game,history,game.home.id,league,now),away=efficiencyHistory(game,history,game.away.id,league,now),model=league==='NBA'?'nba-efficiency-monte-carlo-v2':'wnba-efficiency-monte-carlo-v2';
 const report:EfficiencyAnalysis={status:'waiting',capturedAt:new Date(now).toISOString(),homeForm:nbaForm(home,game.home.id),awayForm:nbaForm(away,game.away.id),model,weightsKey:weightKey(values)};
 if((game.home.league||'NBA')!==league||(game.away.league||'NBA')!==league||game.state!=='scheduled'||!game.timeConfirmed||Date.parse(game.start)<=now||Date.parse(game.start)>now+30*86400000||home.length<8||away.length<8||Math.max(now-Date.parse(home[0].start),now-Date.parse(away[0].start))>210*86400000)return report;
 const forTeam=(games:NbaGame[],id:string)=>efficiencyMetrics(games.map(g=>{const b=boxes.find(b=>b.key===nbaFixtureKey(g)&&b.league===league);if(!b||b.home.points!==g.homeScore||b.away.points!==g.awayScore)throw Error('近期比賽效率資料不完整');return b;}),id,league);
 const h=forTeam(home,game.home.id),a=forTeam(away,game.away.id),calculation=projectEfficiency(h,a,league,game.neutral,values),simulation=simulateMargin(calculation.home-calculation.away,calculation.sigma,`${league}:${nbaFixtureKey(game)}:v2`),round=(x:number)=>Math.round(x*10)/10;
 const homeScore=round(calculation.home),awayScore=round(calculation.away),{observations:_h,...hm}=h,{observations:_a,...am}=a;
 return {...report,status:'ready',expected:{home:homeScore,away:awayScore,total:round(homeScore+awayScore),margin:round(homeScore-awayScore)},probabilities:{home:simulation.home,away:simulation.away},simulation,inputs:{home:hm,away:am,calculation,possessionsMethod:'mean(FGA + 0.44*FTA - OREB + total turnovers); pace per regulation game'}};
}
