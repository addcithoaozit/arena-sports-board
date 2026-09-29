'use client';
import {nbaDay,nbaPeriod,nbaTeamHref,type NbaGame,type NbaTeam} from '@/lib/nba';
import {nbaPick,type NbaAnalysis} from '@/lib/nba-analysis';
export const nbaTime=(value:string)=>new Date(value).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
export const nbaPercent=(n:number)=>`${(n*100).toFixed(1)}%`;
export function NbaTeamIdentity({team,day,side}:{team:NbaTeam;day?:string;side?:string}){
 return <a className="nba-team" href={nbaTeamHref(team.id,day)} aria-label={`查看${team.name}球隊數據`}><img src={team.logo} alt="" width={64} height={64} loading="lazy"/><strong>{team.name}</strong>{side&&<small>{side}</small>}</a>;
}
export function NbaMatch({game}:{game:NbaGame}){
 return <div className="nba-match"><NbaTeamIdentity team={game.away} day={nbaDay(game.start)} side={game.neutral?'客隊・中立場':'客隊'}/><b className="nba-match-score">{game.awayScore!==null&&game.homeScore!==null?<>{game.awayScore}<span>:</span>{game.homeScore}</>:'VS'}</b><NbaTeamIdentity team={game.home} day={nbaDay(game.start)} side={game.neutral?'主隊・中立場':'主隊'}/></div>;
}
// Both surfaces render this component and pick helper; never recompute a
// recommendation from a separate, rounded or market-derived probability.
export function NbaAnalysisNumbers({game,analysis}:{game:NbaGame;analysis:NbaAnalysis}){
 const p=analysis.probabilities!,e=analysis.expected!,pick=nbaPick(game,analysis);
 return <div className="nba-analysis-numbers">
  <div className="nba-probabilities"><div><span>客勝</span><strong>{nbaPercent(p.away)}</strong></div><span>近況推估</span><div><span>主勝</span><strong>{nbaPercent(p.home)}</strong></div></div>
  <div className="nba-probability-bar" aria-hidden="true"><i style={{width:`${p.away*100}%`}}/><i style={{width:`${p.home*100}%`}}/></div>
  <div className="nba-estimates"><div><span>預估比分・客：主</span><b>{Math.round(e.away)} : {Math.round(e.home)}</b></div><div><span>預估總分</span><b>{e.total.toFixed(1)}</b></div><div><span>預估分差</span><b>{e.margin===0?'持平':`${e.margin>0?'主':'客'} +${Math.abs(e.margin).toFixed(1)}`}</b></div></div>
  <div className="nba-pick" data-nba-recommendation={game.id}><span>勝負推薦</span><strong>{pick?<a href={nbaTeamHref(pick.team.id,nbaDay(game.start))}>{pick.label}</a>:'兩隊接近'}</strong>{pick&&<b>{nbaPercent(pick.probability)}</b>}</div>
 </div>;
}
export function NbaQuarters({game}:{game:NbaGame}){
 if(!game.quarters.length)return null;
 return <div className="nba-table-scroll"><table className="nba-quarter-table"><caption className="sr-only">逐節比分</caption><thead><tr><th>球隊</th>{game.quarters.map(q=><th key={q.period}>{nbaPeriod(q.period)}</th>)}<th>總分</th></tr></thead><tbody>{(['away','home'] as const).map(side=><tr key={side}><th><a href={nbaTeamHref(game[side].id)}>{game[side].code}</a></th>{game.quarters.map(q=><td key={q.period}>{q[side]??'—'}</td>)}<td>{game[`${side}Score`]??'—'}</td></tr>)}</tbody></table></div>;
}
