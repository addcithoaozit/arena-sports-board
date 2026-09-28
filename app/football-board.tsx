'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,CalendarDays,RefreshCw} from 'lucide-react';
import {FOOTBALL_LEAGUES,footballDay,shiftFootballDay,type FootballGame,type FootballLeague} from '@/lib/football';
import {footballFixtureKey,footballSourceStale,readyFootballAnalysis,type FootballReport} from '@/lib/football-recommendations';
import FootballTeamIdentity from './football-team';
import FootballRecommendationsPane,{FootballAnalysisNumbers} from './football-recommendations';

type Board={games:FootballGame[];fetchedAt:string;day:string;league:FootballLeague};
type Report=FootballReport;
const fixtureKey=footballFixtureKey;
const time=(value:string)=>new Date(value).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
async function request(url:string,signal:AbortSignal){
  const r=await fetch(url,{cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(55000)])});
  if(r.status===401){window.location.assign('/login');throw Error('請重新登入');}
  const d=await r.json();if(!r.ok)throw Error(d.error||'資料更新失敗');return d;
}
export default function FootballBoard(){
  const [league,setLeague]=useState<FootballLeague>('eng.1'),[day,setDay]=useState(footballDay);
  const [board,setBoard]=useState<Board|null>(null),[reports,setReports]=useState<Record<string,Report>>({});
  const [error,setError]=useState(''),[loading,setLoading]=useState(true),[nextBusy,setNextBusy]=useState(false),[notice,setNotice]=useState('');
  const [filter,setFilter]=useState('all'),[reload,setReload]=useState(0),[now,setNow]=useState(Date.now);
  const nextController=useRef<AbortController|null>(null);
  const selected=FOOTBALL_LEAGUES.find(l=>l.code===league)!;
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),15000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{
    const refresh=()=>setReload(n=>n+1);window.addEventListener('arena-refresh-all',refresh);
    return()=>window.removeEventListener('arena-refresh-all',refresh);
  },[]);
  useEffect(()=>{
    nextController.current?.abort();setNextBusy(false);setNotice('');
    return()=>nextController.current?.abort();
  },[league,day]);
  useEffect(()=>{
    const controller=new AbortController();let busy=false,timer:ReturnType<typeof setTimeout>;
    const known:Record<string,Report>={},queued=new Set<string>();
    setBoard(null);setReports({});setError('');setLoading(true);
    const base=`/api/football?league=${encodeURIComponent(league)}&date=${day}`;
    async function update(){
      if(busy||controller.signal.aborted)return;clearTimeout(timer);busy=true;
      try{
        const data:Board=await request(base,controller.signal);if(controller.signal.aborted)return;
        setBoard(data);setError('');setLoading(false);
        const todo=data.games.filter(g=>g.state==='scheduled'&&g.timeConfirmed&&Date.parse(g.start)>Date.now()&&!queued.has(g.id)&&(!known[g.id]?.analysis||fixtureKey(known[g.id]?.game)!==fixtureKey(g)||Date.now()-Date.parse(known[g.id].analysis!.capturedAt)>600000));
        todo.forEach(g=>queued.add(g.id));
        async function worker(){
          while(todo.length&&!controller.signal.aborted){
            const game=todo.shift()!;
            try{const r=await request(base+`&kind=analysis&game=${game.id}`,controller.signal);if(!controller.signal.aborted){known[game.id]=r;setReports({...known});}}
            catch(e){if(!controller.signal.aborted){known[game.id]={error:e instanceof Error?e.message:'分析暫時無法取得'};setReports({...known});}}
            finally{queued.delete(game.id);}
          }
        }
        // Keep the scoreboard polling while historical analysis runs independently.
        void Promise.all([worker(),worker()]);
      }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'足球資料更新失敗');}
      finally{busy=false;if(!controller.signal.aborted){setLoading(false);timer=setTimeout(()=>void update(),30000);}}
    }
    void update();const resume=()=>{if(document.visibilityState==='visible')void update();};document.addEventListener('visibilitychange',resume);
    return()=>{controller.abort();clearTimeout(timer);document.removeEventListener('visibilitychange',resume);};
  },[league,day,reload]);
  async function nextMatch(){
    nextController.current?.abort();const controller=new AbortController();nextController.current=controller;setNextBusy(true);setNotice('');
    try{const d=await request(`/api/football?league=${league}&date=${day}&kind=next`,controller.signal);if(!controller.signal.aborted){if(d.day)setDay(d.day);else setNotice('來源尚未提供近期的下一個比賽日，可使用日期選擇器查詢。');}}
    catch(e){if(!controller.signal.aborted)setNotice(e instanceof Error?e.message:'查詢失敗');}
    finally{if(!controller.signal.aborted)setNextBusy(false);}
  }
  const current=board?.league===league&&board.day===day;
  const games=current?board.games.filter(g=>filter==='all'||g.state===filter):[];
  const clock=Math.max(now,Date.now());
  const stale=!!board&&footballSourceStale(board.fetchedAt,clock);
  const unavailable=!!error||stale||(!current&&!loading);
  return <section className="football-board" data-super-league="FOOTBALL" aria-label="足球分析">
    <div className="football-heading"><div><h1>足球分析</h1><p>五大聯賽與歐冠・賽程、比分與賽前機率</p></div><span className="football-model-tag">90分鐘分析</span></div>
    <nav className="football-leagues" aria-label="足球聯賽">{FOOTBALL_LEAGUES.map(l=><button type="button" key={l.code} onClick={()=>setLeague(l.code)} aria-pressed={l.code===league}>{l.name}</button>)}</nav>
    <div className="football-toolbar"><div><h2>{selected.fullName}</h2><p>台灣時間 UTC+8</p></div><div className="football-date"><button type="button" aria-label="前一天" onClick={()=>setDay(shiftFootballDay(day,-1))}><ArrowLeft size={17}/></button><label><CalendarDays size={17}/><span className="sr-only">比賽日期（台灣時間）</span><input type="date" value={day} min={shiftFootballDay(footballDay(),-365)} max={shiftFootballDay(footballDay(),365)} onChange={e=>{if(e.target.value)setDay(e.target.value);}}/></label><button type="button" aria-label="後一天" onClick={()=>setDay(shiftFootballDay(day,1))}><ArrowRight size={17}/></button><button type="button" onClick={()=>setDay(footballDay())}>今天</button><button type="button" aria-label="更新足球資料" disabled={loading} onClick={()=>setReload(n=>n+1)}><RefreshCw size={17} className={loading?'animate-spin':''}/></button></div></div>
    <div className="football-status"><span>{board?`${board.games.length} 場賽事・${board.games.filter(g=>g.state==='live').length} 場進行中`:'正在取得賽程'}</span><span>{board?`抓取 ${time(board.fetchedAt)}`:'等待同步'}{stale?'・資料已過期':''}</span></div>
    <div className="football-filters" role="group" aria-label="足球賽事狀態">{[['all','全部'],['scheduled','未開賽'],['live','進行中'],['final','已完場']].map(([value,label])=><button type="button" key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}</div>
    {error&&<div className="football-alert" role="alert">{error} {board?'目前顯示上次取得的賽程；分析暫停顯示。':''}<button type="button" onClick={()=>setReload(n=>n+1)}>重新載入</button></div>}
    {loading&&!board?<div className="football-empty" role="status"><RefreshCw className="animate-spin"/><h3>正在取得{selected.name}賽程</h3><p>賽程載入後會自動計算可分析的比賽。</p></div>:board&&!games.length?<div className="football-empty"><CalendarDays size={30}/><h3>{board.games.length?'沒有符合篩選條件的比賽':`${day} 沒有${selected.name}賽事`}</h3><p>{board.games.length?'可切換至全部查看當日賽程。':'可查看下一個比賽日，或自行選擇日期。'}</p>{!board.games.length&&<button type="button" className="football-primary" disabled={nextBusy} onClick={()=>void nextMatch()}>{nextBusy?'正在查詢…':'下一個比賽日'}<ArrowRight size={16}/></button>}{notice&&<p role="status">{notice}</p>}</div>:null}
    <div className="football-games">{games.map(game=><FootballCard key={game.id} game={game} report={reports[game.id]} now={clock} unavailable={unavailable}/>)}</div>
    <FootballRecommendationsPane games={games} reports={reports} league={league} leagueName={selected.name} day={day} now={clock} sourceFetchedAt={current?board.fetchedAt:undefined} unavailable={unavailable} loading={loading}/>
  </section>;
}
function FootballCard({game,report,now,unavailable}:{game:FootballGame;report?:Report;now:number;unavailable:boolean}){
  const a=readyFootballAnalysis(game,report,now,unavailable);
  const eligible=game.state==='scheduled'&&game.timeConfirmed&&Date.parse(game.start)>now;
  return <article className="football-card">
    <div className="football-card-top"><span className={game.state==='live'?'football-live':''}>{game.state==='live'&&<i/>}{game.statusLabel}</span><span>{game.timeConfirmed?time(game.start):'時間待定'}</span></div>
    <div className="football-match"><FootballTeamIdentity team={game.home} side="home"/><b>{game.homeScore!==null&&game.awayScore!==null?`${game.homeScore} : ${game.awayScore}`:'VS'}</b><FootballTeamIdentity team={game.away} side="away"/></div>
    {(game.venue||game.neutral)&&<p className="football-venue">{game.neutral?'中立場・':''}{game.venue}</p>}
    {a?<>
      <div className="football-analysis-title"><strong>{a.lean?.replace('模型傾向','').replace('，保留觀望','')}</strong></div>
      <FootballAnalysisNumbers analysis={a}/>
    </>:eligible&&!unavailable&&!report?<div className="football-loading" role="status" aria-label="分析載入中"><RefreshCw size={18} className="animate-spin"/></div>:null}
  </article>;
}
