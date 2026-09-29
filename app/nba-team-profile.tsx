'use client';
import {useEffect,useState} from 'react';
import {nbaDay,nbaForm,nbaPhase,nbaTeam,nbaTeamHref,type NbaGame} from '@/lib/nba';
import type {NbaTeamProfileData} from '@/lib/nba-source';
import {nbaRequest} from './nba-request';
import {NbaTeamIdentity,nbaTime} from './nba-match';
import './nba.css';
export default function NbaTeamProfile({id,returnDay}:{id:string;returnDay?:string}){
 const team=nbaTeam(id)!,[data,setData]=useState<NbaTeamProfileData|null>(null),[error,setError]=useState(''),[revision,setRevision]=useState(0),[limit,setLimit]=useState(10),[venue,setVenue]=useState('all');
 useEffect(()=>{const c=new AbortController();setData(null);setError('');nbaRequest(`/api/nba?kind=team&team=${id}`,c.signal).then(d=>{if(!c.signal.aborted)setData(d);}).catch(e=>{if(!c.signal.aborted)setError(e.message);});return()=>c.abort();},[id,revision]);
 const results=(data?.results||[]).filter(g=>venue==='all'||!g.neutral&&g[venue as 'home'|'away'].id===id).slice(0,limit),form=nbaForm(results,id,limit);
 return <main className="arena-shell nba-profile" data-sport="basketball"><div className="nba-profile-inner"><a className="nba-back" href={`/?league=NBA&view=analysis${returnDay?`&date=${returnDay}`:''}`}>← 返回 NBA 分析</a><div className="nba-profile-heading"><NbaTeamIdentity team={team}/><div><span className="nba-eyebrow">NBA 球隊數據</span><h1>{team.name}</h1><p>{team.code}</p></div></div>
  {error?<p className="nba-alert" role="alert">{error}<button type="button" onClick={()=>setRevision(n=>n+1)}>重新載入</button></p>:!data?<p className="nba-empty" role="status">正在取得球隊數據…</p>:<>
   <div className="nba-profile-controls"><div className="nba-filters" role="group" aria-label="近期場次">{[5,10,20].map(n=><button type="button" key={n} aria-pressed={limit===n} onClick={()=>setLimit(n)}>近 {n} 場</button>)}</div><div className="nba-filters" role="group" aria-label="主客場篩選">{[['all','全部'],['home','主場'],['away','客場']].map(([v,label])=><button type="button" key={v} aria-pressed={venue===v} onClick={()=>setVenue(v)}>{label}</button>)}</div></div>
   <div className="nba-profile-stats"><div><span>近期戰績</span><strong>{form.wins} 勝 {form.losses} 負</strong><small>{form.games} 場正式賽</small></div><div><span>場均得分</span><strong>{form.pointsFor?.toFixed(1)??'—'}</strong></div><div><span>場均失分</span><strong>{form.pointsAgainst?.toFixed(1)??'—'}</strong></div><div><span>場均淨勝分</span><strong>{form.net===null?'—':`${form.net>0?'+':''}${form.net.toFixed(1)}`}</strong></div></div>
   <div className="nba-profile-columns"><section className="nba-profile-panel"><h2>近期賽果</h2>{results.map(g=><ProfileMatch key={g.id} game={g} teamId={id}/>)}{!results.length&&<p className="nba-empty">此範圍尚無賽果</p>}</section><section className="nba-profile-panel"><h2>接下來的賽程</h2>{data.upcoming.map(g=><ProfileMatch key={g.id} game={g} teamId={id} upcoming/>)}{!data.upcoming.length&&<p className="nba-empty">尚無後續賽程</p>}</section></div>
   <footer className="nba-status">ESPN・更新 {nbaTime(data.fetchedAt)}（台灣時間）</footer>
  </>}
 </div></main>;
}
function ProfileMatch({game:g,teamId,upcoming=false}:{game:NbaGame;teamId:string;upcoming?:boolean}){
 const home=g.home.id===teamId,opponent=home?g.away:g.home,own=home?g.homeScore:g.awayScore,against=home?g.awayScore:g.homeScore,win=own!>against!;
 return <article className="nba-profile-game"><div><time dateTime={g.start}>{g.timeConfirmed?nbaTime(g.start):`${nbaDay(g.start)}・時間待定`}</time><span>{nbaPhase(g.phase)}</span></div><div><small>{g.neutral?'中立':home?'主場':'客場'}</small><a href={nbaTeamHref(opponent.id)}>{opponent.name}</a>{upcoming?<b>VS</b>:<><b>{own} : {against}</b><span className="nba-result" data-result={win?'W':'L'}>{win?'勝':'負'}</span></>}</div></article>;
}
