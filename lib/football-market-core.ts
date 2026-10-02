import {footballForm,parseFootballEvents,type FootballGame,type FootballLeague} from './football';
import {externalDayCutoff} from './football-xg-features';
export type MarketParameters={decayDays:number;venueWeight:number;blend:number;homeIntercept:number;awayIntercept:number;goalAttack:number;goalDefense:number;elo:number;rho:number;overTilt:number;bttsTilt:number;drawTilt:number};
export function parseMarketFootballEvents(data:any,league:FootballLeague){
 if(!Array.isArray(data?.events)||data.events.length>=1000||!Array.isArray(data.leagues)||!data.leagues.some((l:any)=>l.slug===league))throw Error('聯賽歷史來源不完整或身分不符');
 const events=data.events.filter((e:any)=>!(/play.?off|relegation|qualifying|tie.?break/i).test([e.season?.slug,...(e.competitions?.[0]?.notes||[]).map((n:any)=>n.headline||'')].join(' ')));
 return parseFootballEvents({...data,events},league);
}
export const marketFixtureKey=(g:FootballGame<string>)=>[g.league,g.season,g.home.id,g.away.id].join('|');
export function reconcileMarketHistory(games:FootballGame<string>[],excluded:string[]=[]){
 const blocked=new Set(excluded),byId=new Map<string,FootballGame<string>>(),groups=new Map<string,FootballGame<string>[]>();
 for(const g of games){if(g.state!=='final'||g.statusName!=='STATUS_FULL_TIME'||g.homeScore===null||g.awayScore===null)continue;const old=byId.get(g.id);if(old&&(old.homeScore!==g.homeScore||old.awayScore!==g.awayScore||old.start!==g.start||marketFixtureKey(old)!==marketFixtureKey(g))){blocked.add(marketFixtureKey(old));blocked.add(marketFixtureKey(g));}else byId.set(g.id,g);}
 for(const g of byId.values()){const k=marketFixtureKey(g);if(!groups.has(k))groups.set(k,[]);groups.get(k)!.push(g);}
 for(const [k,v] of groups)if(v.length>1)blocked.add(k);
 return {games:[...byId.values()].filter(g=>!blocked.has(marketFixtureKey(g))).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start)||a.id.localeCompare(b.id)),excluded:[...blocked]};
}
export function marketFootballFeatures(game:FootballGame<string>,history:FootballGame<string>[],eloDifference:number,options:Pick<MarketParameters,'decayDays'|'venueWeight'>,before=externalDayCutoff(game.start)){
 const rows=history.filter(g=>g.league===game.league&&g.state==='final'&&g.statusName==='STATUS_FULL_TIME'&&g.homeScore!==null&&g.awayScore!==null&&Date.parse(g.start)<before&&Date.parse(g.start)>=before-365*86400000);
 const home=footballForm(game.home.id,'home',rows,before,game.neutral,options),away=footballForm(game.away.id,'away',rows,before,game.neutral,options);
 const lg=rows.filter(g=>!g.neutral),lh=lg.length?lg.reduce((s,g)=>s+g.homeScore!,0)/lg.length:0,la=lg.length?lg.reduce((s,g)=>s+g.awayScore!,0)/lg.length:0,m=(lh+la)/2;
 const denominator=(isHome:boolean,forHomeForm:boolean)=>{const f=forHomeForm?home:away;return !game.neutral&&f.venueGames>=3?options.venueWeight*(isHome?lh:la)+(1-options.venueWeight)*m:m;};
 const log=(v:number,d:number)=>Math.log((v+.1)/(d+.1));
 const values=[log(home.scored,denominator(true,true)),log(home.conceded,denominator(false,true)),log(away.scored,denominator(false,false)),log(away.conceded,denominator(true,false)),eloDifference/400,Number(game.neutral),lh,la];
 const enough=lg.length>=180&&[home,away].every(f=>f.games>=5&&f.latest&&before-Date.parse(f.latest)<=120*86400000);
 return {home,away,leagueGames:lg.length,enough,values,baseline:[Math.max(.15,Math.min(5,(home.scored+away.conceded)/2)),Math.max(.15,Math.min(5,(away.scored+home.conceded)/2))]};
}
export function marketFootballRates(x:number[],baseline:number[],p:MarketParameters){
 const [hs,hc,as,ac,elo,neutral,lh,la]=x,clamp=(n:number)=>Math.max(.15,Math.min(5,n));
 const h=clamp((neutral?(lh+la)/2:lh)*Math.exp((neutral?(p.homeIntercept+p.awayIntercept)/2:p.homeIntercept)+p.goalAttack*hs+p.goalDefense*ac+p.elo*elo));
 const a=clamp((neutral?(lh+la)/2:la)*Math.exp((neutral?(p.homeIntercept+p.awayIntercept)/2:p.awayIntercept)+p.goalAttack*as+p.goalDefense*hc-p.elo*elo));
 return {home:p.blend*h+(1-p.blend)*baseline[0],away:p.blend*a+(1-p.blend)*baseline[1],rho:p.rho*p.blend,overTilt:p.overTilt*p.blend,bttsTilt:p.bttsTilt*p.blend,drawTilt:p.drawTilt*p.blend};
}
export function marketFootballDistribution(r:{home:number;away:number;rho:number;overTilt:number;bttsTilt:number;drawTilt:number}){
 const {home:h,away:a}=r;if(!Object.values(r).every(Number.isFinite)||h<.15||a<.15||h>5||a>5||[r.overTilt,r.bttsTilt,r.drawTilt].some(t=>Math.abs(t)>.75))throw Error('比分分布參數無效');
 const rho=Math.max(-Math.min(1/h,1/a)+1e-6,Math.min(Math.min(1-1e-6,1/(h*a)-1e-6),r.rho));
 const hp=[Math.exp(-h)],ap=[Math.exp(-a)];for(let k=1;k<=25;k++){hp.push(hp[k-1]*h/k);ap.push(ap[k-1]*a/k);}
 const scores:{home:number;away:number;probability:number}[]=[];let z=0;
 for(let i=0;i<=25;i++)for(let j=0;j<=25;j++){
  const tau=i===0&&j===0?1-h*a*rho:i===0&&j===1?1+h*rho:i===1&&j===0?1+a*rho:i===1&&j===1?1-rho:1;
  const probability=hp[i]*ap[j]*tau*Math.exp((i+j>2?r.overTilt:0)+(i>0&&j>0?r.bttsTilt:0)+(i===j?r.drawTilt:0));scores.push({home:i,away:j,probability});z+=probability;
 }
 const probabilities={home:0,draw:0,away:0,over25:0,under25:0,btts:0},expected={home:0,away:0};
 for(const s of scores){s.probability/=z;probabilities[s.home>s.away?'home':s.home<s.away?'away':'draw']+=s.probability;probabilities[s.home+s.away>2?'over25':'under25']+=s.probability;if(s.home>0&&s.away>0)probabilities.btts+=s.probability;expected.home+=s.home*s.probability;expected.away+=s.away*s.probability;}
 return {probabilities,expected,scores:scores.sort((x,y)=>y.probability-x.probability).slice(0,3)};
}

