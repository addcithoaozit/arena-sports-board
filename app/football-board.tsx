'use client';
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,CalendarDays,RefreshCw} from 'lucide-react';
import {FOOTBALL_LEAGUES,footballDay,shiftFootballDay,type FootballAnalysis,type FootballGame,type FootballLeague} from '@/lib/football';
import FootballValidation from './football-validation';

type Board={games:FootballGame[];fetchedAt:string;day:string;league:FootballLeague};
type Report={game?:FootballGame;analysis?:FootballAnalysis;error?:string;sourceFetchedAt?:string;archiveAsOf?:string;snapshotSaved?:boolean};
const fixtureKey=(g?:FootballGame)=>g&&[g.league,g.id,g.start,g.home.id,g.away.id,g.neutral,g.timeConfirmed].join('|');
const percent=(n:number)=>(n*100).toFixed(1)+'%';
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
  const games=board?.games.filter(g=>filter==='all'||g.state===filter)||[];
  const stale=!!board&&now-Date.parse(board.fetchedAt)>120000;
  return <section className="football-board" data-super-league="FOOTBALL" aria-label="足球分析">
    <div className="football-heading"><div><p className="football-eyebrow">FOOTBALL · 足球數據中心</p><h1>足球分析</h1><p>五大聯賽與歐冠・賽程、比分與賽前機率</p></div><span className="football-model-tag">90分鐘分析</span></div>
    <nav className="football-leagues" aria-label="足球聯賽">{FOOTBALL_LEAGUES.map(l=><button type="button" key={l.code} onClick={()=>setLeague(l.code)} aria-pressed={l.code===league}>{l.name}</button>)}</nav>
    <div className="football-toolbar"><div><h2>{selected.fullName}</h2><p>台灣時間 UTC+8</p></div><div className="football-date"><button type="button" aria-label="前一天" onClick={()=>setDay(shiftFootballDay(day,-1))}><ArrowLeft size={17}/></button><label><CalendarDays size={17}/><span className="sr-only">比賽日期（台灣時間）</span><input type="date" value={day} min={shiftFootballDay(footballDay(),-365)} max={shiftFootballDay(footballDay(),365)} onChange={e=>{if(e.target.value)setDay(e.target.value);}}/></label><button type="button" aria-label="後一天" onClick={()=>setDay(shiftFootballDay(day,1))}><ArrowRight size={17}/></button><button type="button" onClick={()=>setDay(footballDay())}>今天</button><button type="button" aria-label="更新足球資料" disabled={loading} onClick={()=>setReload(n=>n+1)}><RefreshCw size={17} className={loading?'animate-spin':''}/></button></div></div>
    <div className="football-status"><span>{board?`${board.games.length} 場賽事・${board.games.filter(g=>g.state==='live').length} 場進行中`:'正在取得賽程'}</span><span>來源 ESPN・{board?`抓取 ${time(board.fetchedAt)}`:'等待同步'}{stale?'・資料已過期':''}</span></div>
    <div className="football-filters" role="group" aria-label="足球賽事狀態">{[['all','全部'],['scheduled','未開賽'],['live','進行中'],['final','已完場']].map(([value,label])=><button type="button" key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label}</button>)}</div>
    {error&&<div className="football-alert" role="alert">{error} {board?'目前顯示上次取得的賽程；分析暫停顯示。':''}<button type="button" onClick={()=>setReload(n=>n+1)}>重新載入</button></div>}
    {loading&&!board?<div className="football-empty" role="status"><RefreshCw className="animate-spin"/><h3>正在取得{selected.name}賽程</h3><p>賽程載入後會自動計算可分析的比賽。</p></div>:board&&!games.length?<div className="football-empty"><CalendarDays size={30}/><h3>{board.games.length?'沒有符合篩選條件的比賽':`${day} 沒有${selected.name}賽事`}</h3><p>{board.games.length?'可切換至全部查看當日賽程。':'可查看下一個比賽日，或自行選擇日期。'}</p>{!board.games.length&&<button type="button" className="football-primary" disabled={nextBusy} onClick={()=>void nextMatch()}>{nextBusy?'正在查詢…':'下一個比賽日'}<ArrowRight size={16}/></button>}{notice&&<p role="status">{notice}</p>}</div>:null}
    <div className="football-games">{games.map(game=><FootballCard key={game.id} game={game} report={reports[game.id]} now={now} unavailable={!!error||stale}/>)}</div>
    <FootballValidation league={league}/>
    <details className="football-method"><summary>分析方式與資料範圍</summary><p>使用最近一年同項賽事、最多20場正式90分鐘賽果，每隊至少5場。基礎模型採90天時間衰減，主客場樣本足夠時使用60%場地權重；中立場不採場地加權。</p><p>通過歷史驗收的西甲使用180天衰減、訓練得到的進攻防守係數與低比分修正；其餘聯賽保留基礎模型。各市場機率由同一比分分布計算，2.5球為固定分析基準。</p><p>分析含90分鐘補時，不含加時及互射十二碼。排除延期、缺比分與衝突賽果。尚未納入先發、傷停、實際xG、對手強度與賠率；抓取時間不代表供應商更新時間。</p></details>
  </section>;
}
function FootballCard({game,report,now,unavailable}:{game:FootballGame;report?:Report;now:number;unavailable:boolean}){
  const a=report?.analysis,p=a?.probabilities;
  const eligible=game.state==='scheduled'&&game.timeConfirmed&&Date.parse(game.start)>now;
  const ready=eligible&&!unavailable&&fixtureKey(report?.game)===fixtureKey(game)&&a?.status==='ready'&&p&&now-Date.parse(a.capturedAt)<15*60000;
  return <article className="football-card">
    <div className="football-card-top"><span className={game.state==='live'?'football-live':''}>{game.state==='live'&&<i/>}{game.statusLabel}</span><span>{game.timeConfirmed?time(game.start):'時間待定'}</span></div>
    <div className="football-match"><div><small>主隊</small><h3 title={game.home.englishName}>{game.home.name}</h3></div><b>{game.homeScore!==null&&game.awayScore!==null?`${game.homeScore} : ${game.awayScore}`:'VS'}</b><div><small>客隊</small><h3 title={game.away.englishName}>{game.away.name}</h3></div></div>
    {(game.venue||game.neutral)&&<p className="football-venue">{game.neutral?'中立場・':''}{game.venue}</p>}
    {ready?<>
      <div className="football-analysis-title"><strong>{a.lean}</strong><span>{a.calibration?.label||'基礎模型'}</span></div>
      <div className="football-probabilities">{[['主勝',p.home],['和局',p.draw],['客勝',p.away]].map(([label,value])=><div key={String(label)}><span>{label}</span><strong>{percent(Number(value))}</strong></div>)}</div>
      <div className="football-probability-bar" aria-hidden="true"><span style={{width:p.home*100+'%'}}/><span style={{width:p.draw*100+'%'}}/><span style={{width:p.away*100+'%'}}/></div>
      <div className="football-goals"><div><span>大 2.5 球</span><b>{percent(p.over25)}</b></div><div><span>小 2.5 球</span><b>{percent(p.under25)}</b></div><div><span>雙方都進球</span><b>{percent(p.btts)}</b></div></div>
      <div className="football-scores"><span>三組比分預測<small>主：客</small></span>{a.scores?.map(s=><div key={`${s.home}:${s.away}`}><b>{s.home} : {s.away}</b><small>{percent(s.probability)}</small></div>)}</div>
      <details className="football-detail"><summary>查看近況與分析依據</summary><div className="football-form">{[['主隊',a.homeForm],['客隊',a.awayForm]].map(([label,raw])=>{const f=raw as NonNullable<FootballAnalysis['homeForm']>;return <div key={String(label)}><b>{String(label)}・樣本 {f.games} 場</b><p>近五場（由近到遠）：{f.recent.join(' ')}</p><p>加權進球 {f.scored.toFixed(2)}・失球 {f.conceded.toFixed(2)}</p></div>;})}</div><p>模型預估進球：主 {a.expected!.home.toFixed(2)}／客 {a.expected!.away.toFixed(2)}</p><p>計算於 {time(a.capturedAt)}・歷史資料抓取 {report?.sourceFetchedAt?time(report.sourceFetchedAt):'—'}</p></details>
    </>:<div className="football-waiting" role="status">{unavailable?'資料更新中斷，請更新後再查看分析。':game.state==='live'?'比賽進行中，顯示即時比分。':game.state==='final'?'比賽已完場。':game.state==='other'?'賽事狀態異常，暫停賽前分析。':!game.timeConfirmed?'等待確認開賽時間。':Date.parse(game.start)<=now?'已到開賽時間，等待來源更新比賽狀態。':report?.error||a?.reason||(a?.status==='ready'?'分析資料已過期，正在重新取得。':'正在取得歷史賽果並計算分析…')}</div>}
    {a?.quality?.warnings.map(w=><p className="football-quality" key={w}>{w}</p>)}
    {ready&&report?.archiveAsOf&&<p className="football-quality">歷史補充快照：{report.archiveAsOf.slice(0,10)}；最新賽果另向來源確認。</p>}
    {ready&&report?.snapshotSaved===false&&<p className="football-quality">本次未保存驗證快照（可能接近開賽或儲存暫時失敗），不會計入上線後成效。</p>}
    <div className="football-card-foot"><span>90分鐘含補時</span><a href={game.sourceUrl} target="_blank" rel="noreferrer noopener">賽事來源 ↗</a></div>
  </article>;
}
