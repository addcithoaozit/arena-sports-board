'use client';
import {useEffect,useState} from 'react';
import {ArrowLeft,RefreshCw} from 'lucide-react';
import {FOOTBALL_LEAGUES,type FootballGame,type FootballLeague} from '@/lib/football';
import {footballBoardHref,footballCompetitionName,footballVenue,selectFootballProfileGames,summarizeFootballProfile,type FootballTeamProfileData,type FootballVenue} from '@/lib/football-team-profile';
import './football.css';

const decimal=(n:number|null)=>n===null?'—':n.toFixed(2),percent=(n:number|null)=>n===null?'—':(100*n).toFixed(1)+'%';
const dateTime=(date:string,time=true)=>new Date(date).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',...(time?{hour:'2-digit',minute:'2-digit',hour12:false}:{})});
const venueNames={home:'主場',away:'客場',neutral:'中立場',all:'全部'};
export default function FootballTeamProfile({league,teamId,returnDay}:{league:FootballLeague;teamId:string;returnDay?:string}){
 const [data,setData]=useState<FootballTeamProfileData|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
 const [limit,setLimit]=useState(10),[venue,setVenue]=useState<FootballVenue>('all'),[failedLogo,setFailedLogo]=useState(false);
 useEffect(()=>{
  const c=new AbortController();setLoading(true);setError('');setData(null);setFailedLogo(false);
  fetch(`/api/football-team?league=${encodeURIComponent(league)}&team=${teamId}`,{cache:'no-store',signal:AbortSignal.any([c.signal,AbortSignal.timeout(55000)])}).then(async r=>{
   if(r.status===401){window.location.assign('/login');throw Error('請重新登入');}
   const d=await r.json();if(!r.ok)throw Error(d.error||'資料讀取失敗');if(d.league!==league||d.team?.id!==teamId)throw Error('球隊資料不符');if(!c.signal.aborted)setData(d);
  }).catch(e=>{if(!c.signal.aborted)setError(e instanceof Error?e.message:'資料讀取失敗');}).finally(()=>{if(!c.signal.aborted)setLoading(false);});
  return()=>c.abort();
 },[league,teamId,revision]);
 const selected=selectFootballProfileGames(data?.results||[],teamId,venue,limit),summary=summarizeFootballProfile(selected,teamId);
 const competition=FOOTBALL_LEAGUES.find(l=>l.code===league)!;
 return <main className="arena-shell football-team-page" data-sport="football">
  <div className="football-profile-shell">
   <header className="football-profile-nav"><a href={footballBoardHref(league,returnDay)}><ArrowLeft size={18}/>返回足球分析</a><span>YJ體育分析</span><button type="button" aria-label="更新球隊資料" onClick={()=>setRevision(n=>n+1)} disabled={loading}><RefreshCw size={18} className={loading?'animate-spin':''}/></button></header>
   <section className="football-profile-heading"><div className="football-profile-logo">{data&&!failedLogo&&<img src={`https://a.espncdn.com/i/teamlogos/soccer/500/${teamId}.png`} alt="" width={76} height={76} onError={()=>setFailedLogo(true)}/>}</div><div><p>{competition.fullName}</p><h1>{data?.team.name||'球隊數據'}</h1>{data&&<span>{data.team.englishName}</span>}</div></section>
   {loading&&<div className="football-profile-loading" role="status"><RefreshCw className="animate-spin" size={22}/><span>正在取得球隊數據</span></div>}
   {error&&<div className="football-alert" role="alert">{error}<button type="button" onClick={()=>setRevision(n=>n+1)}>重新載入</button></div>}
   {data&&<>
    <section className="football-profile-panel">
     <div className="football-profile-section-title"><h2>近期表現</h2><span>近一年・90分鐘賽果</span></div>
     <div className="football-profile-filters"><div role="group" aria-label="近期場數">{[5,10,20].map(n=><button type="button" key={n} aria-pressed={limit===n} onClick={()=>setLimit(n)}>近 {n} 場</button>)}</div><label><span className="sr-only">主客場篩選</span><select aria-label="主客場篩選" value={venue} onChange={e=>setVenue(e.target.value as FootballVenue)}>{(['all','home','away','neutral'] as const).map(v=><option key={v} value={v}>{venueNames[v]}</option>)}</select></label></div>
     <div className="football-profile-record"><div><b>{summary.wins}<small>勝</small></b><b>{summary.draws}<small>和</small></b><b>{summary.losses}<small>負</small></b><span>共 {summary.games} 場</span></div><div className="football-profile-form" aria-label="近五場，由近至遠">{summary.recent.map((r,i)=><span key={i} data-result={r}>{r}</span>)}</div></div>
     <div className="football-profile-stats">{[['勝率',percent(summary.winRate)],['場均進球',decimal(summary.scoredPerGame)],['場均失球',decimal(summary.concededPerGame)],['淨勝球',summary.games?(summary.goalDifference>0?'+':'')+summary.goalDifference:'—'],['總進球',summary.games?summary.scored:'—'],['總失球',summary.games?summary.conceded:'—'],['零封率',percent(summary.cleanSheetRate)],['雙方進球',percent(summary.bttsRate)],['大於2.5球',percent(summary.over25Rate)]].map(([label,value])=><div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    </section>
    <div className="football-profile-columns">
     <section className="football-profile-panel"><div className="football-profile-section-title"><h2>近期賽果</h2><span>本隊：對手</span></div><div className="football-profile-match-list">{selected.map(g=><ProfileMatch key={g.id} game={g} teamId={teamId}/>)}{!selected.length&&<p className="football-profile-empty">此範圍尚無賽果</p>}</div></section>
     <div className="football-profile-sidebar">
      <section className="football-profile-panel"><div className="football-profile-section-title"><h2>主客場表現</h2><span>各取近 {limit} 場</span></div><div className="football-profile-splits">{(['home','away','neutral'] as const).map(v=>{const s=summarizeFootballProfile(selectFootballProfileGames(data.results,teamId,v,limit),teamId);return <div key={v}><strong>{venueNames[v]}</strong><span>{s.wins} 勝 {s.draws} 和 {s.losses} 負</span><b>{percent(s.winRate)}</b></div>;})}</div></section>
      <section className="football-profile-panel"><div className="football-profile-section-title"><h2>接下來的賽程</h2><span>台灣時間</span></div><div className="football-profile-match-list">{data.upcoming?.map(g=><ProfileMatch key={g.id} game={g} teamId={teamId} upcoming/>)}{data.upcoming===null?<button className="football-profile-retry" type="button" onClick={()=>setRevision(n=>n+1)}>重新載入賽程</button>:!data.upcoming.length&&<p className="football-profile-empty">尚無後續賽程</p>}</div></section>
     </div>
    </div>
    <footer className="football-profile-footer">ESPN・更新 {dateTime(data.fetchedAt)}（台灣時間）</footer>
   </>}
  </div>
 </main>;
}
function ProfileMatch({game,teamId,upcoming=false}:{game:FootballGame<string>;teamId:string;upcoming?:boolean}){
 const home=game.home.id===teamId,opponent=home?game.away:game.home,own=home?game.homeScore:game.awayScore,against=home?game.awayScore:game.homeScore;
 const result=upcoming?'':own!>against!?'勝':own!<against!?'負':'和';
 return <article className="football-profile-match"><div className="football-profile-match-meta"><time dateTime={game.start}>{dateTime(game.start,upcoming&&game.timeConfirmed)}{upcoming&&!game.timeConfirmed?'・時間待定':''}</time><span>{footballCompetitionName(game.league)}</span></div><div className="football-profile-match-main"><span className="football-profile-venue">{venueNames[footballVenue(game,teamId)]}</span><strong>{opponent.name}</strong>{upcoming?<b className="football-profile-vs">VS</b>:<><b className="football-profile-score">{own} : {against}</b><span className="football-profile-result" data-result={result}>{result}</span></>}</div></article>;
}
