'use client';
import {useState} from 'react';
import InternationalPlayerPhoto from './international-player-photo';
import {BaseDiamond,CountLights} from './live-scoreboard';
import InternationalTeamLogo from './international-team-logo';
import {internationalBatter,internationalPosition} from '@/lib/international-live-display';
import {internationalTextEvents,internationalTextInnings,selectTextInnings,currentTextPlay,type TextGame} from '@/lib/international-play-text';
import InternationalPlayCard,{InternationalTextPitches} from './international-play-card';
const stat=(n:unknown)=>typeof n==='number'&&Number.isFinite(n)?n:'—';
export default function InternationalLiveRecords({game,stale}:{game:TextGame;stale:boolean}){
 const [panel,setPanel]=useState<'player'|'scoring'>('player'),[inning,setInning]=useState('latest');
 const current=!stale&&game.status==='live',batter=current?internationalBatter(game):null;
 const groups=internationalTextInnings(game),events=internationalTextEvents(game),scoring=events.filter(p=>p.scoring),atBat=currentTextPlay(game,stale);
 const innings=[...new Set(groups.map(r=>r.inning))].sort((a,b)=>a-b),shown=selectTextInnings(groups,inning);
 const bases=current&&game.bases?.length===3&&game.bases.every(v=>typeof v==='boolean')?{first:game.bases[0]!,second:game.bases[1]!,third:game.bases[2]!}:null;
 return <div className="live-record-layout">
  <section className="panel live-current-panel" aria-label="當前打者與得分紀錄">
   <div className="live-panel-tabs" role="group" aria-label="切換打者與得分紀錄"><button type="button" aria-pressed={panel==='player'} onClick={()=>setPanel('player')}>當前打者 <small>NOW PLAYER</small></button><button type="button" aria-pressed={panel==='scoring'} onClick={()=>setPanel('scoring')}>得分紀錄 <small>SCORING</small></button></div>
   {panel==='player'?<div className="live-now-player">{batter?<><div className="live-now-identity"><InternationalPlayerPhoto person={batter}/><div><p className="live-side-label">{batter.side==='away'?'客隊進攻':batter.side==='home'?'主隊進攻':'當前打者'}</p><h3>{batter.order?`第 ${batter.order} 棒 `:''}{batter.name}</h3><p>對戰投手：{game.currentPitcher?.name||'—'}</p></div></div><div className="live-batter-stats">{[['打數','AT_BATS'],['安打','HITS'],['全壘打','HOME_RUNS'],['打點','RBIS']].map(([label,key])=><div key={key}><span>{label}</span><strong>{stat(batter.stats?.[key])}</strong></div>)}</div><div className="international-current-count"><BaseDiamond bases={bases} compact/><CountLights count={{balls:game.balls,strikes:game.strikes,outs:game.outs}} compact/></div><h4 className="live-subheading">本打席逐球紀錄</h4>{atBat?.pitches.length?<InternationalTextPitches pitches={atBat.pitches} league={game.league}/>:<p className="live-empty">尚未取得本打席逐球文字。</p>}</>:<p className="live-empty">{game.status==='final'?'比賽已結束，請查看得分與各局紀錄。':game.status==='pregame'?'比賽尚未開始。':stale?'場況待更新。':'尚無當前打者資料。'}</p>}</div>:<div className="live-scoring-list">{scoring.map(p=><div key={p.id}><p className="live-scoring-inning">{p.inning} 局{p.half==='top'?'上':'下'}</p><InternationalPlayCard play={p} game={game}/></div>)}{!scoring.length&&<p className="live-empty">{game.status==='pregame'?'比賽尚未開始。':game.playText?.status==='available'&&events.length?'目前沒有可顯示的得分事件。':'尚未取得得分事件文字紀錄。'}</p>}</div>}
   <details className="international-lineup-details"><summary>先發與打序 <small>LINEUP</small></summary><div className="international-lineups">{(['away','home'] as const).map(side=><div key={side}><h4><InternationalTeamLogo league={game.league} name={game[side].name} size={30}/>{game[side].name}</h4><p>預告先發：{game.starters[side]?.name||'—'}</p>{game.lineups[side].length?<ol>{game.lineups[side].map((p,i)=><li key={`${p.id||p.name}:${i}`}><span>{p.position==='PITCHER'?'投':p.order??'—'}</span>{p.name||'—'}<small>{internationalPosition(p.position)}</small></li>)}</ol>:<p className="live-empty">尚無打序。</p>}</div>)}</div></details>
  </section>
  <section className="panel live-all-plays" aria-label="各局文字紀錄" data-play-text-version="international-play-text-v1"><h3 className="live-record-title">各局紀錄 <small>ALL PLAYS</small></h3><div className="live-inning-filter" role="group" aria-label="篩選局數">{[['latest','最新局'],['all','全部'],...innings.map(n=>[String(n),`${n} 局`])].map(([value,label])=><button type="button" key={value} aria-pressed={inning===value} onClick={()=>setInning(value)}>{label}</button>)}</div>
   {events.length>0&&game.playText?.fetchedAt&&<p className="live-record-stamp">文字紀錄更新 {new Date(game.playText.fetchedAt).toLocaleTimeString('zh-TW',{timeZone:'Asia/Taipei'})}（台灣）{game.playText.stale?' · 來源待更新，保留既有紀錄':game.playText.status==='partial'?' · 部分局數待補齊':''}</p>}
   {shown.map(group=><section key={group.key} className="live-inning-group" aria-label={`${group.inning} 局${group.half==='top'?'上':'下'}`}><h4><InternationalTeamLogo league={game.league} name={game[group.side].name} size={26}/>{group.inning} 局{group.half==='top'?'上':'下'}<span>{game[group.side].name}</span></h4>{group.plays.length?group.plays.map(play=><InternationalPlayCard key={play.id} play={play} game={game}/>):<p className="live-empty">本半局暫無文字紀錄</p>}</section>)}
   {!shown.length&&<p className="live-empty">{game.status==='pregame'?'開賽後顯示各局文字紀錄。':'尚未取得本場文字事件資料。'}</p>}
  </section>
 </div>;
}
