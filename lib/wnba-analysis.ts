import {wnbaFixtureKey,wnbaForm,wnbaHistory,type WnbaGame,type WnbaForm} from './wnba';
export type WnbaAnalysis={status:'ready'|'waiting';capturedAt:string;homeForm:WnbaForm;awayForm:WnbaForm;expected?:{home:number;away:number;total:number;margin:number};probabilities?:{home:number;away:number};model:'wnba-recent-results-v1'};
export type WnbaReport={game?:WnbaGame;analysis?:WnbaAnalysis;sourceFetchedAt?:string;error?:string};
const DAY=86400000;
export function wnbaEligible(g:WnbaGame,now=Date.now()){return g.home.league==='WNBA'&&g.away.league==='WNBA'&&g.state==='scheduled'&&g.timeConfirmed&&Date.parse(g.start)>now&&Date.parse(g.start)<=now+30*DAY;}
function rates(rows:WnbaGame[],teamId:string,venue:'home'|'away'|null){
 const weighted=rows.map((g,i)=>({g,w:Math.exp(-i/10)*(venue&&!g.neutral&&g[venue].id===teamId?1.5:1)}));
 const sum=weighted.reduce((a,r)=>a+r.w,0),mean=(f:(g:WnbaGame)=>number)=>weighted.reduce((a,r)=>a+r.w*f(r.g),0)/sum;
 const own=(g:WnbaGame)=>(g.home.id===teamId?g.homeScore:g.awayScore)!,against=(g:WnbaGame)=>(g.home.id===teamId?g.awayScore:g.homeScore)!;
 const net=mean(g=>own(g)-against(g));
 return {offense:mean(own),defense:mean(against),variance:mean(g=>(own(g)-against(g)-net)**2)};
}
// Baseline from completed WNBA results, including overtime. No fitted/calibrated
// accuracy claim: weighted recent scoring, empirical margin spread, and shrinkage
// for small samples, offseason age and preseason rotations. No market odds used.
export function analyzeWnba(game:WnbaGame,history:WnbaGame[],now=Date.now()):WnbaAnalysis{
 const cutoff=Math.min(now,Date.parse(game.start)),home=wnbaHistory(history.filter(g=>g.home.league==='WNBA'&&g.away.league==='WNBA'),game.home.id,cutoff).slice(0,20),away=wnbaHistory(history.filter(g=>g.home.league==='WNBA'&&g.away.league==='WNBA'),game.away.id,cutoff).slice(0,20);
 const a:WnbaAnalysis={status:'waiting',capturedAt:new Date(now).toISOString(),homeForm:wnbaForm(home,game.home.id),awayForm:wnbaForm(away,game.away.id),model:'wnba-recent-results-v1'};
 if(!wnbaEligible(game,now)||home.length<8||away.length<8)return a;
 const age=Math.max(now-Date.parse(home[0].start),now-Date.parse(away[0].start))/DAY;
 if(age>210)return a;
 const h=rates(home,game.home.id,game.neutral?null:'home'),v=rates(away,game.away.id,game.neutral?null:'away');
 const homeMean=(h.offense+v.defense)/2,awayMean=(v.offense+h.defense)/2;
 const reliability=Math.min(home.length,away.length)/(Math.min(home.length,away.length)+8)*Math.exp(-Math.max(0,age-30)/180)*(game.phase===1?.45:1);
 const margin=(homeMean-awayMean)*reliability,total=homeMean+awayMean;
 const deviation=Math.max(10,Math.sqrt((h.variance+v.variance)/2));
 const probability=1/(1+Math.exp(-1.7*margin/deviation));
 const homeExpected=Math.round((total+margin)/2*10)/10,awayExpected=Math.round((total-margin)/2*10)/10;
 a.status='ready';a.expected={home:homeExpected,away:awayExpected,total:Math.round((homeExpected+awayExpected)*10)/10,margin:Math.round((homeExpected-awayExpected)*10)/10};
 a.probabilities={home:probability,away:1-probability};return a;
}
export const wnbaSourceStale=(at:string|undefined,now=Date.now(),maxAge=120000)=>!at||!Number.isFinite(Date.parse(at))||now-Date.parse(at)>maxAge||Date.parse(at)>now+5000;
export function readyWnbaAnalysis(game:WnbaGame,report:WnbaReport|undefined,now=Date.now(),unavailable=false):WnbaAnalysis|null{
 const a=report?.analysis;
 if(unavailable||!wnbaEligible(game,now)||!report?.game||wnbaFixtureKey(report.game)!==wnbaFixtureKey(game)||!a||a.status!=='ready'||wnbaSourceStale(a.capturedAt,now,10*60000)||wnbaSourceStale(report.sourceFetchedAt,now,10*60000)||!a.expected||!a.probabilities)return null;
 const p=a.probabilities,e=a.expected;
 if(![p.home,p.away,e.home,e.away,e.total,e.margin].every(Number.isFinite)||p.home<=0||p.home>=1||p.away<=0||p.away>=1||Math.abs(p.home+p.away-1)>.00001)return null;
 if(Math.abs(e.home+e.away-e.total)>.15||Math.abs(e.home-e.away-e.margin)>.15||(p.home-.5)*e.margin<0)return null;
 return a;
}
export function wnbaPick(game:WnbaGame,a:WnbaAnalysis){
 const p=a.probabilities!;
 if(Math.abs(p.home-p.away)<.002)return null;
 const side=p.home>p.away?'home':'away';
 return {team:game[side],probability:p[side],label:game[side].name+' 勝'};
}
