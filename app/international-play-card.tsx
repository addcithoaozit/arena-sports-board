'use client';
import InternationalPlayerPhoto from './international-player-photo';
import {BaseDiamond,CountLights} from './live-scoreboard';
import InternationalTeamLogo from './international-team-logo';
import {npbDisplayPlay,npbTextZh} from '@/lib/npb-play-zh';
import type {TextPlay,TextGame,TextPitch} from '@/lib/international-play-text';
export function InternationalTextPitches({pitches,league}:{pitches:TextPitch[];league?:string}){
 return <ol className="live-pitch-list" lang={league==='NPB'?'zh-Hant':undefined}>{pitches.map(p=><li key={p.id}><span className="live-pitch-number">{p.number}</span><div><strong>{league==='NPB'?npbTextZh(p.description,[],'投球紀錄'):p.description}</strong>{(p.speedKph!==null||p.kind)&&<span>{league==='NPB'?npbTextZh(p.kind,[],'球種未提供'):p.kind}{p.speedKph!==null?` · ${p.speedKph} km/h`:''}</span>}<span className="live-pitch-count">壞球 {p.count.balls??'—'} · 好球 {p.count.strikes??'—'}</span></div></li>)}</ol>;
}
export default function InternationalPlayCard({play,game}:{play:TextPlay;game:TextGame}){
 play=npbDisplayPlay(play,game);
 const count=play.count||{balls:null,strikes:null,outs:null};
 const bases=play.bases?.length===3&&play.bases.every(v=>typeof v==='boolean')?{first:play.bases[0],second:play.bases[1],third:play.bases[2]}:null;
 const hasScore=typeof play.score?.away==='number'&&typeof play.score?.home==='number';
 const hasCount=[count.balls,count.strikes,count.outs].some(n=>n!==null);
 return <article className="live-play-card" data-text-play={play.id}>
  {play.actions.map(a=><div key={a.id} className="live-play-action"><strong>{a.event}</strong><p>{a.description}</p></div>)}
  {(play.batter||play.description)&&<div className="live-play-main"><InternationalPlayerPhoto person={play.batter}/><div className="live-play-body">
   <h4>{play.batter?.order?`第 ${play.batter.order} 棒 `:''}{play.batter?.name||play.event}</h4>
   <p>{play.description}</p>
   <div className="live-play-result"><span className={`live-event-badge ${play.tone}`}>{play.event}</span>{bases&&<BaseDiamond bases={bases} compact/>}
    {hasScore&&<strong className="live-play-score"><InternationalTeamLogo league={game.league} name={game.away.name} size={22}/>{play.score.away} : {play.score.home}<InternationalTeamLogo league={game.league} name={game.home.name} size={22}/></strong>}
   </div>
   {hasCount&&<CountLights count={count} compact/>}
   {(play.originalText.length>0||play.pitches.length>0)&&<details className="live-play-more"><summary>文字與逐球紀錄{play.pitches.length?`（${play.pitches.length} 球）`:''}</summary>
    {play.originalText.map((t,i)=><p key={i} className="live-original-text" lang={play.language}>{t}</p>)}
    {play.pitches.length>0&&<InternationalTextPitches pitches={play.pitches} league={game.league}/>}
   </details>}
  </div></div>}
 </article>;
}
