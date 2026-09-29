import {nbaFixtureKey,nbaForm,nbaHistory,type NbaGame,type NbaForm} from './nba';
export type NbaAnalysis={status:'ready'|'waiting';capturedAt:string;homeForm:NbaForm;awayForm:NbaForm;expected?:{home:number;away:number;total:number;margin:number};probabilities?:{home:number;away:number};model:'nba-recent-results-v1'|'wnba-recent-results-v1'};
export type NbaReport={game?:NbaGame;analysis?:NbaAnalysis;sourceFetchedAt?:string;error?:string};
const DAY=86400000;
export function nbaEligible(g:NbaGame,now=Date.now()){return g.state==='scheduled'&&g.timeConfirmed&&Date.parse(g.start)>now&&Date.parse(g.start)<=now+30*DAY;}
function rates(rows:NbaGame[],teamId:string,venue:'home'|'away'|null){
 const weighted=rows.map((g,i)=>({g,w:Math.exp(-i/10)*(venue&&!g.neutral&&g[venue].id===teamId?1.5:1)}));
 const sum=weighted.reduce((a,r)=>a+r.w,0),mean=(f:(g:NbaGame)=>number)=>weighted.reduce((a,r)=>a+r.w*f(r.g),0)/sum;
 const own=(g:NbaGame)=>(g.home.id===teamId?g.homeScore:g.awayScore)!,against=(g:NbaGame)=>(g.home.id===teamId?g.awayScore:g.homeScore)!;
 const net=mean(g=>own(g)-against(g));
 return {offense:mean(own),defense:mean(against),variance:mean(g=>(own(g)-against(g)-net)**2)};
}
// Baseline from completed NBA results, including overtime. No fitted/calibrated
// accuracy claim: weighted recent scoring, empirical margin spread, and shrinkage
// for small samples, offseason age and preseason rotations. No market odds used.
export function analyzeNba(game:NbaGame,history:NbaGame[],now=Date.now()):NbaAnalysis{
 const cutoff=Math.min(now,Date.parse(game.start)),home=nbaHistory(history,game.home.id,cutoff).slice(0,20),away=nbaHistory(history,game.away.id,cutoff).slice(0,20);
 const a:NbaAnalysis={status:'waiting',capturedAt:new Date(now).toISOString(),homeForm:nbaForm(home,game.home.id),awayForm:nbaForm(away,game.away.id),model:'nba-recent-results-v1'};
 if(!nbaEligible(game,now)||home.length<8||away.length<8)return a;
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
export const nbaSourceStale=(at:string|undefined,now=Date.now(),maxAge=120000)=>!at||!Number.isFinite(Date.parse(at))||now-Date.parse(at)>maxAge||Date.parse(at)>now+5000;
export function readyNbaAnalysis(game:NbaGame,report:NbaReport|undefined,now=Date.now(),unavailable=false):NbaAnalysis|null{
 const a=report?.analysis;
 if(a&&a.model!==(game.home.league==='WNBA'?'wnba-recent-results-v1':'nba-recent-results-v1'))return null;
 if(unavailable||!nbaEligible(game,now)||!report?.game||nbaFixtureKey(report.game)!==nbaFixtureKey(game)||!a||a.status!=='ready'||nbaSourceStale(a.capturedAt,now,10*60000)||nbaSourceStale(report.sourceFetchedAt,now,10*60000)||!a.expected||!a.probabilities)return null;
 const p=a.probabilities,e=a.expected;
 if(![p.home,p.away,e.home,e.away,e.total,e.margin].every(Number.isFinite)||p.home<=0||p.home>=1||p.away<=0||p.away>=1||Math.abs(p.home+p.away-1)>.00001)return null;
 if(Math.abs(e.home+e.away-e.total)>.15||Math.abs(e.home-e.away-e.margin)>.15||(p.home-.5)*e.margin<0)return null;
 return a;
}
export function nbaPick(game:NbaGame,a:NbaAnalysis){
 const p=a.probabilities!;
 if(Math.abs(p.home-p.away)<.002)return null;
 const side=p.home>p.away?'home':'away';
 return {team:game[side],probability:p[side],label:game[side].name+' 勝'};
}
