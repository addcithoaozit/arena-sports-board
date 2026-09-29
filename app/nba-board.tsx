'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,CalendarDays,RefreshCw} from 'lucide-react';
import {NBA_TEAMS,nbaDay,nbaFixtureKey,nbaPhase,shiftNbaDay,validNbaDay,type NbaBoard as Board,type NbaGame} from '@/lib/nba';
import {WNBA_TEAMS} from '@/lib/wnba';
import {nbaEligible,nbaSourceStale,readyNbaAnalysis,type NbaReport} from '@/lib/nba-analysis';
import {NbaAnalysisNumbers,NbaMatch,NbaQuarters,NbaTeamIdentity,nbaTime} from './nba-match';
import NbaRecommendations from './nba-recommendations';
import {nbaRequest} from './nba-request';
import './nba.css';
export default function NbaBoard({view,onViewChange,league='NBA'}:{league?:'NBA'|'WNBA';view:string;onViewChange:(view:string)=>void}){
 const teams=league==='WNBA'?WNBA_TEAMS:NBA_TEAMS,api=`/api/${league.toLowerCase()}`;
 const tab=['analysis','teams','live'].includes(view)?view:'analysis';
 const [day,setDay]=useState(nbaDay),[board,setBoard]=useState<Board|null>(null),[reports,setReports]=useState<Record<string,NbaReport>>({});
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[filter,setFilter]=useState('all'),[reload,setReload]=useState(0),[now,setNow]=useState(Date.now);
 const [nextBusy,setNextBusy]=useState(false),[notice,setNotice]=useState(''),nextController=useRef<AbortController|null>(null);
 useEffect(()=>{const date=new URLSearchParams(window.location.search).get('date');if(date&&validNbaDay(date)&&Math.abs(Date.parse(date)-Date.parse(nbaDay()))<=365*86400000)setDay(date);},[]);
 useEffect(()=>{const tick=setInterval(()=>setNow(Date.now()),15000),refresh=()=>setReload(n=>n+1);window.addEventListener('arena-refresh-all',refresh);return()=>{clearInterval(tick);window.removeEventListener('arena-refresh-all',refresh);};},[]);
 useEffect(()=>{nextController.current?.abort();setNextBusy(false);setNotice('');return()=>nextController.current?.abort();},[day]);
 useEffect(()=>{
  const controller=new AbortController(),known:Record<string,NbaReport>={},queued=new Set<string>();let busy=false,timer:ReturnType<typeof setTimeout>;
  setBoard(null);setReports({});setError('');setLoading(true);
  const base=`${api}?date=${day}`;
  async function update(){
   if(busy||controller.signal.aborted)return;clearTimeout(timer);busy=true;
   try{
    const data:Board=await nbaRequest(base,controller.signal);if(controller.signal.aborted)return;
    setBoard(data);setError('');setLoading(false);
    const todo=data.games.filter(g=>nbaEligible(g)&&!queued.has(g.id)&&(!known[g.id]?.analysis||nbaFixtureKey(known[g.id].game!)!==nbaFixtureKey(g)||nbaSourceStale(known[g.id].sourceFetchedAt,Date.now(),5*60000)));
    todo.forEach(g=>queued.add(g.id));
    async function worker(){while(todo.length&&!controller.signal.aborted){const g=todo.shift()!;try{const report=await nbaRequest(base+`&kind=analysis&game=${g.id}`,controller.signal);if(!controller.signal.aborted){known[g.id]=report;setReports({...known});}}catch(e){if(!controller.signal.aborted){known[g.id]={error:e instanceof Error?e.message:'分析暫時無法取得'};setReports({...known});}}finally{queued.delete(g.id);}}}
    void Promise.all([worker(),worker()]);
   }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:`${league} 資料更新失敗`);}
   finally{busy=false;if(!controller.signal.aborted){setLoading(false);timer=setTimeout(()=>void update(),30000);}}
  }
  void update();const resume=()=>{if(document.visibilityState==='visible'){setNow(Date.now());void update();}};document.addEventListener('visibilitychange',resume);
  return()=>{controller.abort();clearTimeout(timer);document.removeEventListener('visibilitychange',resume);};
 },[day,reload,api]);
 function selectDay(value:string){if(!validNbaDay(value)||Math.abs(Date.parse(value)-Date.parse(nbaDay()))>365*86400000)return;setDay(value);const p=new URLSearchParams(window.location.search);p.set('date',value);window.history.replaceState(null,'',`/?${p}`);}
 async function nextMatch(){
  nextController.current?.abort();const controller=new AbortController();nextController.current=controller;setNextBusy(true);setNotice('');
  try{const d=await nbaRequest(`${api}?kind=next&date=${day}`,controller.signal);if(!controller.signal.aborted){if(d.day)selectDay(d.day);else setNotice('尚無下一個比賽日');}}
  catch(e){if(!controller.signal.aborted)setNotice(e instanceof Error?e.message:'查詢失敗');}finally{if(!controller.signal.aborted)setNextBusy(false);}
 }
 const current=board?.day===day,clock=Math.max(now,Date.now()),unavailable=!!error||!current||nbaSourceStale(board?.fetchedAt,clock);
 const games=current?board.games.filter(g=>filter==='all'||g.state===filter):[];
 return <section className="nba-board" data-super-league={league} aria-label={`${league} 分析`}>
  <div className="nba-heading"><div className="nba-heading-title"><svg className="nba-sport-mark" viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle cx="32" cy="32" r="26"/><path d="M6 32h52M32 6v52M13.6 13.6c24.5 7.6 24.5 29.2 36.8 36.8M50.4 13.6C25.9 21.2 25.9 42.8 13.6 50.4"/></svg><div><h1>{league} <span>{league==='WNBA'?'美國女子職籃':'美國職籃'}</span></h1><p>全場分析・含延長賽</p></div></div><div className="nba-heading-stats"><div><strong>{current?board.games.length:'—'}</strong><span>當日賽事</span></div><div><strong>{current?board.games.filter(g=>g.state==='live').length:'—'}</strong><span>進行中</span></div><div><strong>{teams.length}</strong><span>聯盟球隊</span></div></div><svg className="nba-court-art" viewBox="0 0 360 240" fill="none" aria-hidden="true"><rect x="10" y="10" width="340" height="220" rx="6"/><path d="M180 10v220M10 55h75v130H10M350 55h-75v130h75M10 35c180 0 180 170 0 170M350 35c-180 0-180 170 0 170"/><circle cx="180" cy="120" r="34"/></svg></div>
  <nav className="nba-tabs" aria-label={`${league} 頁面`}>{[['analysis','賽前分析'],['live','賽程・比分'],['teams','球隊一覽']].map(([v,label])=><button type="button" key={v} aria-pressed={tab===v} onClick={()=>onViewChange(v)}>{label}</button>)}</nav>
  {tab==='teams'?<div className="nba-team-directory">{teams.map(team=><NbaTeamIdentity key={team.id} team={team}/>)}</div>:<>
   <div className="nba-toolbar"><div><h2>{new Date(day+'T12:00:00+08:00').toLocaleDateString('zh-TW',{timeZone:'Asia/Taipei',month:'long',day:'numeric',weekday:'long'})}</h2><small>台灣時間 UTC+8</small></div><div className="nba-date"><button type="button" aria-label="前一天" onClick={()=>selectDay(shiftNbaDay(day,-1))}><ArrowLeft size={18}/></button><label><CalendarDays size={18}/><span className="sr-only">{league} 比賽日期</span><input type="date" value={day} min={shiftNbaDay(nbaDay(),-365)} max={shiftNbaDay(nbaDay(),365)} onChange={e=>selectDay(e.target.value)}/></label><button type="button" aria-label="後一天" onClick={()=>selectDay(shiftNbaDay(day,1))}><ArrowRight size={18}/></button><button type="button" className="nba-today" onClick={()=>selectDay(nbaDay())}>今天</button><button type="button" disabled={loading} aria-label={`更新 ${league} 資料`} onClick={()=>setReload(n=>n+1)}><RefreshCw size={18} className={loading?'animate-spin':''}/></button></div></div>
   <div className="nba-board-meta"><div className="nba-filters" role="group" aria-label={`${league} 賽事狀態`}>{[['all','全部'],['scheduled','未開賽'],['live','進行中'],['final','已完賽']].map(([v,label])=><button type="button" key={v} aria-pressed={filter===v} onClick={()=>setFilter(v)}>{label}{current&&<span>{v==='all'?board.games.length:board.games.filter(g=>g.state===v).length}</span>}</button>)}</div><span className="nba-updated">{current?`更新 ${nbaTime(board.fetchedAt)}`:'正在取得賽程'}</span></div>
   {error&&<p className="nba-alert" role="alert">{error}<button type="button" onClick={()=>setReload(n=>n+1)}>重試</button></p>}
   {loading&&!current?<p className="nba-empty" role="status">正在取得 {league} 賽程…</p>:current&&!games.length?<div className="nba-empty"><CalendarDays size={32}/><h3>{board.games.length?'沒有符合篩選的比賽':`${day} 沒有 ${league} 賽事`}</h3>{!board.games.length&&<button type="button" className="nba-primary" disabled={nextBusy} onClick={()=>void nextMatch()}>{nextBusy?'查詢中…':'下一個比賽日'}<ArrowRight size={16}/></button>}{notice&&<p role="status">{notice}</p>}</div>:null}
   <div className="nba-games" data-view={tab}>{games.map(game=><NbaCard key={game.id} game={game} report={reports[game.id]} now={clock} unavailable={unavailable} showAnalysis={tab==='analysis'}/>)}</div>
  </>}
  <NbaRecommendations league={league} games={current?board.games:[]} reports={reports} day={day} now={clock} fetchedAt={current?board.fetchedAt:undefined} unavailable={unavailable} loading={loading}/>
 </section>;
}
function NbaCard({game,report,now,unavailable,showAnalysis}:{game:NbaGame;report?:NbaReport;now:number;unavailable:boolean;showAnalysis:boolean}){
 const a=readyNbaAnalysis(game,report,now,unavailable),form=report?.analysis;
 return <article className="nba-card" data-state={game.state}><header><div className="nba-card-labels"><span className="nba-phase-tag">{nbaPhase(game.phase)}</span><span className={game.state==='live'?'nba-live':'nba-game-status'}><i/>{game.statusLabel}</span></div><time dateTime={game.start}>{game.timeConfirmed?nbaTime(game.start):'時間待定'}</time></header><div className="nba-card-layout" data-analysis={showAnalysis&&(!!a||nbaEligible(game,now))}>
  <div className="nba-match-overview"><NbaMatch game={game}/><NbaQuarters game={game}/>
   {showAnalysis&&a&&form&&<div className="nba-form"><span>近期正式賽</span>{(['away','home'] as const).map(side=>{const f=form[`${side}Form`];return <div key={side}><small>{side==='away'?'客隊':'主隊'}・近 {f.games} 場</small><strong>{f.wins} <em>勝</em> {f.losses} <em>負</em></strong><span>得 {f.pointsFor==null?'—':Math.round(f.pointsFor)} ／ 失 {f.pointsAgainst==null?'—':Math.round(f.pointsAgainst)}</span><div className="nba-streak" aria-label="近五場，最近一場在左">{f.results.map((r,i)=><i key={i} data-result={r}>{r==='W'?'勝':'負'}</i>)}</div></div>;})}</div>}
  </div>
  {showAnalysis&&a&&<div className="nba-card-analysis"><NbaAnalysisNumbers game={game} analysis={a}/></div>}
  {showAnalysis&&!a&&nbaEligible(game,now)&&<div className="nba-card-analysis nba-analysis-pending"><span className="nba-section-kicker">賽前分析</span><p role="status">{!report&&!unavailable?'正在計算…':'暫無賽前分析'}</p></div>}
  </div>
 </article>;
}
