'use client';
import {nbaDay,nbaPeriod,basketballTeamHref,type NbaGame,type NbaTeam} from '@/lib/nba';
import {nbaPick,type NbaAnalysis} from '@/lib/nba-analysis';
export const nbaTime=(value:string)=>new Date(value).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
export const nbaPercent=(n:number)=>`${(n*100).toFixed(1)}%`;
export const nbaDisplayedProbabilities=(p:{home:number;away:number})=>{const home=Math.round(p.home*1000);return {home:`${(home/10).toFixed(1)}%`,away:`${((1000-home)/10).toFixed(1)}%`};};
// Integer scorelines preserve the model winner without changing probabilities.
export function nbaDisplayedScore(e:{home:number;away:number},p:{home:number;away:number}){
 const direction=Math.sign(p.home-p.away)||Math.sign(e.home-e.away);
 if(!direction)return null;
 let home=Math.round(e.home),away=Math.round(e.away);
 if(home===away){
  const candidates=direction>0?[{home:home+1,away},{home,away:away-1}]:[{home,away:away+1},{home:home-1,away}];
  const score=candidates.filter(c=>c.home>=0&&c.away>=0).sort((a,b)=>((a.home-e.home)**2+(a.away-e.away)**2)-((b.home-e.home)**2+(b.away-e.away)**2))[0];
  home=score.home;away=score.away;
 }
 return {home,away,total:home+away,margin:home-away};
}
export function NbaTeamIdentity({team,day,side}:{team:NbaTeam;day?:string;side?:string}){
 return <a className="nba-team" href={basketballTeamHref(team,day)} aria-label={`查看${team.name}球隊數據`}><span className="nba-team-logo"><img src={team.logo} alt="" width={80} height={80} loading="lazy"/></span><strong>{team.name}</strong><small>{side||team.code}</small></a>;
}
export function NbaMatch({game}:{game:NbaGame}){
 return <div className="nba-match"><NbaTeamIdentity team={game.away} day={nbaDay(game.start)} side={game.neutral?'客隊・中立場':'客隊'}/><b className="nba-match-score">{game.awayScore!==null&&game.homeScore!==null?<>{game.awayScore}<span>:</span>{game.homeScore}</>:'VS'}</b><NbaTeamIdentity team={game.home} day={nbaDay(game.start)} side={game.neutral?'主隊・中立場':'主隊'}/></div>;
}
// Both surfaces render this component and pick helper; never recompute a
// recommendation from a separate, rounded or market-derived probability.
export function NbaAnalysisNumbers({game,analysis}:{game:NbaGame;analysis:NbaAnalysis}){
 const p=analysis.probabilities!,e=analysis.expected!,pick=nbaPick(game,analysis),display=nbaDisplayedProbabilities(p),score=nbaDisplayedScore(e,p);
 return <div className="nba-analysis-numbers">
  <div className="nba-analysis-heading"><span>賽前預測</span><small>{analysis.model.includes('monte-carlo')?'效率模擬':'近況推估'}</small></div>
  <div className="nba-forecast-score"><span>預估比分<small>客：主</small></span><b>{score?<>{score.away}<i>:</i>{score.home}</>:'—'}</b></div>
  <div className="nba-probabilities"><div><span>客勝</span><strong>{display.away}</strong></div><div><span>主勝</span><strong>{display.home}</strong></div></div>
  <div className="nba-probability-bar" aria-hidden="true"><i style={{width:`${p.away*100}%`}}/><i style={{width:`${p.home*100}%`}}/></div>
  <div className="nba-estimates"><div><span>預估總分</span><b>{score?.total??Math.round(e.total)}</b></div><div><span>預估分差</span><b>{score?`${score.margin>0?'主':'客'} +${Math.abs(score.margin)}`:'勝負接近'}</b></div></div>
  <div className="nba-pick" data-nba-recommendation={game.id}><span className="nba-pick-icon" aria-hidden="true">↗</span><div><span>勝負推薦</span><strong>{pick?<a href={basketballTeamHref(pick.team,nbaDay(game.start))}>{pick.label}</a>:'兩隊接近'}</strong></div>{pick&&<b>{display[pick.team.id===game.home.id?'home':'away']}</b>}</div>
 </div>;
}
export function NbaQuarters({game}:{game:NbaGame}){
 if(!game.quarters.length)return null;
 return <div className="nba-table-scroll"><table className="nba-quarter-table"><caption className="sr-only">逐節比分</caption><thead><tr><th>球隊</th>{game.quarters.map(q=><th key={q.period}>{nbaPeriod(q.period)}</th>)}<th>總分</th></tr></thead><tbody>{(['away','home'] as const).map(side=><tr key={side}><th><a href={basketballTeamHref(game[side])}>{game[side].code}</a></th>{game.quarters.map(q=><td key={q.period}>{q[side]??'—'}</td>)}<td>{game[`${side}Score`]??'—'}</td></tr>)}</tbody></table></div>;
}
