'use client';
import {useEffect,useRef,useState} from 'react';
import {footballDay,type FootballAnalysis,type FootballGame,type FootballLeague} from '@/lib/football';
type Report={game:FootballGame;analysis:FootballAnalysis;sourceFetchedAt?:string;archiveAsOf?:string;snapshotSaved?:boolean};
export default function FootballDiagnostics({league}:{league:FootballLeague}){
 const [day,setDay]=useState(footballDay),[games,setGames]=useState<FootballGame[]>([]),[id,setId]=useState(''),[report,setReport]=useState<Report|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const controller=useRef<AbortController|null>(null);
 useEffect(()=>{controller.current?.abort();setGames([]);setId('');setReport(null);setError('');setBusy(false);return()=>controller.current?.abort();},[league,day]);
 async function inspect(kind:'schedule'|'analysis'){
  controller.current?.abort();const current=new AbortController();controller.current=current;setBusy(true);setError('');setReport(null);
  if(kind==='schedule'){setGames([]);setId('');}
  try{
   const r=await fetch(`/api/football?league=${league}&date=${day}&kind=${kind}${kind==='analysis'?`&game=${id}`:''}`,{cache:'no-store',signal:AbortSignal.any([current.signal,AbortSignal.timeout(55000)])});
   if(!r.ok)throw Error('讀取失敗，請重新查詢');const d=await r.json();if(current.signal.aborted)return;
   if(kind==='schedule'){setGames(d.games);setId(d.games[0]?.id||'');}else setReport(d);
  }catch(e){if(!current.signal.aborted)setError(e instanceof Error?e.message:'讀取失敗');}
  finally{if(!current.signal.aborted)setBusy(false);}
 }
 const a=report?.analysis;
 return <details className="football-method"><summary>賽事近況與資料診斷</summary>
  <div className="mt-3 flex flex-wrap gap-2"><label>比賽日期 <input type="date" value={day} onChange={e=>{if(e.target.value)setDay(e.target.value);}} className="rounded border border-white/20 bg-slate-900 px-2 py-1"/></label><button type="button" disabled={busy} onClick={()=>void inspect('schedule')}>查詢賽事</button></div>
  {!!games.length&&<div className="mt-3 flex flex-wrap gap-2"><label>賽事 <select value={id} onChange={e=>{controller.current?.abort();setBusy(false);setReport(null);setId(e.target.value);}} className="max-w-full rounded border border-white/20 bg-slate-900 px-2 py-1">{games.map(g=><option key={g.id} value={g.id}>{g.home.name} vs {g.away.name}</option>)}</select></label><button type="button" disabled={busy||!id} onClick={()=>void inspect('analysis')}>檢查近期戰績</button></div>}
  {busy&&<p role="status">讀取中…</p>}{error&&<p role="alert">{error}</p>}
  {a&&<div><p>{a.calibration?.label}・版本 {a.version}</p>{a.reason&&<p>{a.reason}</p>}
   <div className="football-audit-scroll"><table><thead><tr><th>球隊</th><th>採用場數</th><th>跨賽事場數</th><th>近五場</th><th>最新賽果</th></tr></thead><tbody>{(['home','away'] as const).map(side=>{const f=a[side==='home'?'homeForm':'awayForm'];return <tr key={side}><th>{report.game[side].name}</th><td>{f?.games??0}</td><td>{f?.supplementGames??0}</td><td>{f?.recent.join('／')||'—'}</td><td>{f?.latest?footballDay(f.latest):'—'}</td></tr>;})}</tbody></table></div>
   {a.external&&<p>外部資料：{a.external.sources.join('＋')}；{a.external.modelFamily==='score-market'?`聯賽近一年${a.external.leagueGames}場；比分模型不要求xG`:`主隊 xG ${a.external.homeXgGames}場、客隊 ${a.external.awayXgGames}場`}；排除衝突 {a.external.conflicts} 場。{a.external.modelApplied?'已套用外部資料模型':'使用原模型'}。抓取時間：{a.external.fetchedAt}</p>}
   {a.external?.reasons.map(r=><p key={r}>{r}</p>)}
   {a.quality?.warnings.map(w=><p key={w}>{w}</p>)}{a.calibration?.reasons.map(r=><p key={r}>{r}</p>)}{a.notes.map(n=><p key={n}>{n}</p>)}
   {report.sourceFetchedAt&&<p>來源抓取：{report.sourceFetchedAt}</p>}{report.archiveAsOf&&<p>歷史快照：{report.archiveAsOf}</p>}<p>賽前快照：{report.snapshotSaved?'已保存':'未保存'}</p>
  </div>}
 </details>;
}
