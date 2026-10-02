import {footballDistribution,isFootballNationalCompetition,type FootballGame,type FootballAnalysis} from './football';
import {reconcileFootballHistory} from './football-history';
export const NATIONAL_MODEL_VERSION='football-national-opponent-v2';
const DAY=86400000;
export type NationalFit={intercept:number;homeEffect:number;teams:Record<string,{attack:number;defense:number;games:number;latest:number;effectiveGames:number}>;games:number;through:number};
// Fixed before the evaluation: 180-day decay, ridge=5, home-effect ridge=10.
// Each team's effects shrink toward the pool instead of amplifying three venue games.
export function fitNationalFootball(history:FootballGame<string>[],before:number):NationalFit|null{
  if(!Number.isFinite(before))return null;
  const rows=reconcileFootballHistory(history,[]).games.filter(g=>(isFootballNationalCompetition(g.league)||g.league==='fifa.friendly')&&g.state==='final'&&g.statusName==='STATUS_FULL_TIME'&&Number.isInteger(g.homeScore)&&Number.isInteger(g.awayScore)&&g.homeScore!>=0&&g.awayScore!>=0&&g.homeScore!<=30&&g.awayScore!<=30&&g.home.id!==g.away.id&&Date.parse(g.start)<before&&Date.parse(g.start)>=before-730*DAY).sort((a,b)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id));
  const ids=[...new Set(rows.flatMap(g=>[g.home.id,g.away.id]))].sort();
  if(rows.length<100||ids.length<20)return null;
  const index=new Map(ids.map((id,i)=>[id,i])),n=ids.length,size=2+2*n;
  const samples=rows.flatMap(g=>{
    const h=index.get(g.home.id)!,a=index.get(g.away.id)!,w=Math.exp(-(before-Date.parse(g.start))/(180*DAY))*(g.league==='fifa.friendly'?.2:1),v=g.neutral?0:.5;
    return [{indices:[0,1,2+h,2+n+a],values:[1,v,1,1],y:g.homeScore!,w},{indices:[0,1,2+a,2+n+h],values:[1,-v,1,1],y:g.awayScore!,w}];
  });
  const b=new Float64Array(size),pen=Array.from({length:size},(_,i)=>i===0?0:i===1?10:5);
  const objective=(x:Float64Array)=>{
    let loss=0;for(let j=0;j<size;j++)loss+=.5*pen[j]*x[j]*x[j];
    for(const s of samples){let z=0;for(let k=0;k<4;k++)z+=s.values[k]*x[s.indices[k]];loss+=s.w*(Math.exp(z)-s.y*z);}return loss;
  };
  // Diagonal Newton direction with backtracking on the actual penalized loss.
  let previous=objective(b),converged=false;
  for(let iteration=0;iteration<500;iteration++){
    const gradient=Float64Array.from(b,(v,j)=>pen[j]*v),curvature=Float64Array.from(pen);
    for(const s of samples){let z=0;for(let k=0;k<4;k++)z+=s.values[k]*b[s.indices[k]];const mu=Math.exp(z);
      for(let k=0;k<4;k++){const j=s.indices[k],v=s.values[k];gradient[j]+=s.w*(mu-s.y)*v;curvature[j]+=s.w*mu*v*v;}}
    if(Math.max(...Array.from(gradient,Math.abs))<1e-5){converged=true;break;}
    let step=1,accepted=false;
    for(let attempt=0;attempt<20;attempt++,step*=.5){const next=Float64Array.from(b,(v,j)=>v-step*gradient[j]/Math.max(curvature[j],1e-8)),loss=objective(next);
      if(Number.isFinite(loss)&&loss<previous){const gain=previous-loss;b.set(next);previous=loss;accepted=true;if(gain<1e-9)converged=true;break;}}
    if(converged)break;if(!accepted)return null;
  }
  if(!converged||!Array.from(b).every(Number.isFinite))return null;
  const teams:NationalFit['teams']={};
  for(const [i,id] of ids.entries()){
    const played=rows.filter(g=>g.home.id===id||g.away.id===id),weights=played.map(g=>Math.exp(-(before-Date.parse(g.start))/(180*DAY))*(g.league==='fifa.friendly'?.2:1));
    teams[id]={attack:b[2+i],defense:b[2+n+i],games:played.length,latest:Math.max(...played.map(g=>Date.parse(g.start))),effectiveGames:weights.reduce((s,w)=>s+w,0)**2/weights.reduce((s,w)=>s+w*w,0)};
  }
  return {intercept:b[0],homeEffect:b[1],teams,games:rows.length,through:before};
}
export function nationalExpectedGoals(game:FootballGame,fit:NationalFit,now:number){
  const h=fit.teams[game.home.id],a=fit.teams[game.away.id];
  if(!h||!a||[h,a].some(t=>t.games<5||t.effectiveGames<3||now-t.latest>120*DAY)||fit.through>now||now-fit.through>DAY)return null;
  const venue=game.neutral?0:fit.homeEffect/2,clamp=(v:number)=>Math.max(.15,Math.min(5,Math.exp(v)));
  return {home:clamp(fit.intercept+venue+h.attack+a.defense),away:clamp(fit.intercept-venue+a.attack+h.defense)};
}
export function applyNationalFootballModel(game:FootballGame,base:FootballAnalysis,history:FootballGame<string>[],now=Date.now()):FootballAnalysis{
  if(!isFootballNationalCompetition(game.league)||base.status!=='ready'||game.state!=='scheduled'||!game.timeConfirmed||Date.parse(game.start)<=now)return base;
  const fit=fitNationalFootball(history.filter(g=>g.id!==game.id),Math.min(now,Date.parse(game.start))),expected=fit&&nationalExpectedGoals(game,fit,now);
  if(!fit||!expected){const result={...base,status:'waiting' as const,reason:'國家隊對手強度資料尚未完整更新。',version:NATIONAL_MODEL_VERSION};delete result.probabilities;delete result.expected;delete result.scores;delete result.lean;return result;}
  const result=footballDistribution(expected.home,expected.away),p=result.probabilities,best=[{name:'主勝',p:p.home},{name:'和局',p:p.draw},{name:'客勝',p:p.away}].sort((a,b)=>b.p-a.p);
  return {...base,version:NATIONAL_MODEL_VERSION,expected,...result,lean:best[0].p-best[1].p>=.08?`模型傾向${best[0].name}`:'勝負接近，保留觀望',
    calibration:{status:'baseline',label:'對手強度模型・持續驗證',version:NATIONAL_MODEL_VERSION,reasons:['近期滾動回測僅作初步檢查，尚待長期獨立驗證'],holdoutGames:0,recentGames:0,uncertainty:'對手攻防、主場效果及小樣本收縮；不代表已證明未來命中率。'},
    notes:[`以${fit.games}場成年國家隊90分鐘賽果共同估計攻防與主場效果，最多回溯兩年。`,'180天時間衰減；正式賽權重1、友誼賽0.2；小樣本向整體平均收縮，不再以三場客場資料套用60%權重。','依對手攻防調整賽程強度；中立場地不加主場效果，排除加時與十二碼賽果。','尚未納入傷停、先發、xG或即時賠率；機率為90分鐘含補時估計。']};
}

