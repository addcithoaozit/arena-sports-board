'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,CalendarDays,RefreshCw} from 'lucide-react';
import {NBA_TEAMS,nbaDay,nbaFixtureKey,nbaPhase,shiftNbaDay,validNbaDay,type NbaBoard as Board,type NbaGame} from '@/lib/nba';
import {nbaEligible,nbaSourceStale,readyNbaAnalysis,type NbaReport} from '@/lib/nba-analysis';
import {NbaAnalysisNumbers,NbaMatch,NbaQuarters,NbaTeamIdentity,nbaTime} from './nba-match';
import NbaRecommendations from './nba-recommendations';
import {nbaRequest} from './nba-request';
import './nba.css';
export default function NbaBoard({view,onViewChange}:{view:string;onViewChange:(view:string)=>void}){
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
  const base=`/api/nba?date=${day}`;
  async function update(){
   if(busy||controller.signal.aborted)return;clearTimeout(timer);busy=true;
   try{
    const data:Board=await nbaRequest(base,controller.signal);if(controller.signal.aborted)return;
    setBoard(data);setError('');setLoading(false);
    const todo=data.games.filter(g=>nbaEligible(g)&&!queued.has(g.id)&&(!known[g.id]?.analysis||nbaFixtureKey(known[g.id].game!)!==nbaFixtureKey(g)||nbaSourceStale(known[g.id].sourceFetchedAt,Date.now(),5*60000)));
    todo.forEach(g=>queued.add(g.id));
    async function worker(){while(todo.length&&!controller.signal.aborted){const g=todo.shift()!;try{const report=await nbaRequest(base+`&kind=analysis&game=${g.id}`,controller.signal);if(!controller.signal.aborted){known[g.id]=report;setReports({...known});}}catch(e){if(!controller.signal.aborted){known[g.id]={error:e instanceof Error?e.message:'分析暫時無法取得'};setReports({...known});}}finally{queued.delete(g.id);}}}
    void Promise.all([worker(),worker()]);
   }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'NBA 資料更新失敗');}
   finally{busy=false;if(!controller.signal.aborted){setLoading(false);timer=setTimeout(()=>void update(),30000);}}
  }
  void update();const resume=()=>{if(document.visibilityState==='visible'){setNow(Date.now());void update();}};document.addEventListener('visibilitychange',resume);
  return()=>{controller.abort();clearTimeout(timer);document.removeEventListener('visibilitychange',resume);};
 },[day,reload]);
 function selectDay(value:string){if(!validNbaDay(value)||Math.abs(Date.parse(value)-Date.parse(nbaDay()))>365*86400000)return;setDay(value);const p=new URLSearchParams(window.location.search);p.set('date',value);window.history.replaceState(null,'',`/?${p}`);}
 async function nextMatch(){
  nextController.current?.abort();const controller=new AbortController();nextController.current=controller;setNextBusy(true);setNotice('');
  try{const d=await nbaRequest(`/api/nba?kind=next&date=${day}`,controller.signal);if(!controller.signal.aborted){if(d.day)selectDay(d.day);else setNotice('尚無下一個比賽日');}}
  catch(e){if(!controller.signal.aborted)setNotice(e instanceof Error?e.message:'查詢失敗');}finally{if(!controller.signal.aborted)setNextBusy(false);}
 }
 const current=board?.day===day,clock=Math.max(now,Date.now()),unavailable=!!error||!current||nbaSourceStale(board?.fetchedAt,clock);
 const games=current?board.games.filter(g=>filter==='all'||g.state===filter):[];
 return <section className="nba-board" data-super-league="NBA" aria-label="NBA 分析">
  <div className="nba-heading"><div><span className="nba-eyebrow">BASKETBALL</span><h1>NBA <span>美國職籃</span></h1></div><span>全場・含延長賽</span></div>
  <nav className="nba-tabs" aria-label="NBA 頁面">{[['analysis','賽前分析'],['live','賽程・比分'],['teams','球隊一覽']].map(([v,label])=><button type="button" key={v} aria-pressed={tab===v} onClick={()=>onViewChange(v)}>{label}</button>)}</nav>
  {tab==='teams'?<div className="nba-team-directory">{NBA_TEAMS.map(team=><NbaTeamIdentity key={team.id} team={team}/>)}</div>:<>
   <div className="nba-toolbar"><div><h2>{tab==='analysis'?'賽前分析':'賽程與即時比分'}</h2><small>台灣時間 UTC+8</small></div><div className="nba-date"><button type="button" aria-label="前一天" onClick={()=>selectDay(shiftNbaDay(day,-1))}><ArrowLeft size={18}/></button><label><CalendarDays size={18}/><span className="sr-only">NBA 比賽日期</span><input type="date" value={day} min={shiftNbaDay(nbaDay(),-365)} max={shiftNbaDay(nbaDay(),365)} onChange={e=>selectDay(e.target.value)}/></label><button type="button" aria-label="後一天" onClick={()=>selectDay(shiftNbaDay(day,1))}><ArrowRight size={18}/></button><button type="button" onClick={()=>selectDay(nbaDay())}>今天</button><button type="button" disabled={loading} aria-label="更新 NBA 資料" onClick={()=>setReload(n=>n+1)}><RefreshCw size={18} className={loading?'animate-spin':''}/></button></div></div>
   <div className="nba-status"><span>{current?`${board.games.length} 場賽事`:'載入中'}</span><span>{current?`ESPN・更新 ${nbaTime(board.fetchedAt)}`:''}</span></div>
   <div className="nba-filters" role="group" aria-label="NBA 賽事狀態">{[['all','全部'],['scheduled','未開賽'],['live','進行中'],['final','已完賽']].map(([v,label])=><button type="button" key={v} aria-pressed={filter===v} onClick={()=>setFilter(v)}>{label}</button>)}</div>
   {error&&<p className="nba-alert" role="alert">{error}<button type="button" onClick={()=>setReload(n=>n+1)}>重試</button></p>}
   {loading&&!current?<p className="nba-empty" role="status">正在取得 NBA 賽程…</p>:current&&!games.length?<div className="nba-empty"><CalendarDays size={32}/><h3>{board.games.length?'沒有符合篩選的比賽':`${day} 沒有 NBA 賽事`}</h3>{!board.games.length&&<button type="button" className="nba-primary" disabled={nextBusy} onClick={()=>void nextMatch()}>{nextBusy?'查詢中…':'下一個比賽日'}<ArrowRight size={16}/></button>}{notice&&<p role="status">{notice}</p>}</div>:null}
   <div className="nba-games">{games.map(game=><NbaCard key={game.id} game={game} report={reports[game.id]} now={clock} unavailable={unavailable} showAnalysis={tab==='analysis'}/>)}</div>
  </>}
  <NbaRecommendations games={current?board.games:[]} reports={reports} day={day} now={clock} fetchedAt={current?board.fetchedAt:undefined} unavailable={unavailable} loading={loading}/>
 </section>;
}
function NbaCard({game,report,now,unavailable,showAnalysis}:{game:NbaGame;report?:NbaReport;now:number;unavailable:boolean;showAnalysis:boolean}){
 const a=readyNbaAnalysis(game,report,now,unavailable),form=report?.analysis;
 return <article className="nba-card"><header><span className={game.state==='live'?'nba-live':''}>{nbaPhase(game.phase)}・{game.statusLabel}</span><time dateTime={game.start}>{game.timeConfirmed?nbaTime(game.start):'時間待定'}</time></header><NbaMatch game={game}/><NbaQuarters game={game}/>
  {showAnalysis&&a&&<NbaAnalysisNumbers game={game} analysis={a}/>}
  {showAnalysis&&!a&&nbaEligible(game,now)&&<p className="nba-analysis-status" role="status">{!report&&!unavailable?'正在計算…':'暫無賽前分析'}</p>}
  {showAnalysis&&a&&form&&<div className="nba-form"><span>近期正式賽</span>{(['away','home'] as const).map(side=>{const f=form[`${side}Form`];return <div key={side}><small>{side==='away'?'客隊':'主隊'}・近 {f.games} 場</small><strong>{f.wins} 勝 {f.losses} 負</strong><span>得 {f.pointsFor?.toFixed(1)} ／ 失 {f.pointsAgainst?.toFixed(1)}</span><div className="nba-streak">{f.results.map((r,i)=><i key={i} data-result={r}>{r==='W'?'勝':'負'}</i>)}</div></div>;})}</div>}
 </article>;
}
