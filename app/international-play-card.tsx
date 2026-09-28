'use client';
import InternationalPlayerPhoto from './international-player-photo';
import {BaseDiamond,CountLights} from './live-scoreboard';
import InternationalTeamLogo from './international-team-logo';
import type {TextPlay,TextGame,TextPitch} from '@/lib/international-play-text';
export function InternationalTextPitches({pitches}:{pitches:TextPitch[]}){
 return <ol className="live-pitch-list">{pitches.map(p=><li key={p.id}><span className="live-pitch-number">{p.number}</span><div><strong>{p.description}</strong>{(p.speedKph!==null||p.kind)&&<span>{p.kind}{p.speedKph!==null?` · ${p.speedKph} km/h`:''}</span>}<span className="live-pitch-count">B {p.count.balls??'—'} · S {p.count.strikes??'—'}</span></div></li>)}</ol>;
}
export default function InternationalPlayCard({play,game}:{play:TextPlay;game:TextGame}){
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
    {play.pitches.length>0&&<InternationalTextPitches pitches={play.pitches}/>}
   </details>}
  </div></div>}
 </article>;
}
