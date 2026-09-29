"use client";
import {useEffect,useState} from 'react';
import InternationalLiveFeed from './international-live-feed';
import InternationalMarkets from './international-markets';
import CpblStandings from './cpbl-standings';
import NpbStandings from './npb-standings';
import KboStandings from './kbo-standings';
import InternationalTeamLogo from './international-team-logo';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@/components/ui/table';
import {ArrowLeft,Users,Trophy,Activity} from 'lucide-react';
import type {SourceTable} from '@/lib/international';
import {useSource} from './use-source';
import {profileCode,profileHref,profileTeams} from '@/lib/international-profile';
import type {PregameData} from '@/lib/international-pregame';
import type {NpbPlayerLinks} from '@/lib/international-profile-links';
import {taipeiFixtureDay} from '@/lib/international-board-fixtures';
const names={CPBL:'中華職棒',NPB:'日本職棒',KBO:'韓國職棒'};
type League=keyof typeof names;
type Data={playerLinks?:NpbPlayerLinks;tables?:SourceTable[];games?:{id:string;label:string;url?:string;date?:string}[];status?:string;error?:string;fetchedAt?:string;scope?:string;pregame?:PregameData};
const stamp=(s?:string)=>s?new Date(s).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'尚未取得';
const teamRows=(data:Data|undefined,team:string)=>(data?.tables||[]).map(t=>({...t,rows:t.rows.filter(r=>!team||r[t.headers.indexOf('球隊')]===team)}));
export default function InternationalBoard({league,initialView="analysis",onViewChange}:{league:League;initialView?:string;onViewChange?:(view:string)=>void}){
 const [view,setView]=useState(['analysis','overview','teams','standings','live'].includes(initialView)?initialView:'analysis'),[search,setSearch]=useState('');
 const [data,setData]=useState<Record<string,Data>>({}),[loading,setLoading]=useState(false),[revision,setRevision]=useState(0);
 const [analysisDate,setAnalysisDate]=useState(()=>taipeiFixtureDay(Date.now()));
 const [scheduleDate,setScheduleDate]=useState(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
 const [game,setGame]=useState(''),[gameData,setGameData]=useState<Data>(),[gameLoading,setGameLoading]=useState(false),[liveTab,setLiveTab]=useState('score');
 const superData=useSource<any>(`member-odds&league=${league}`,60000);
 const year=new Date().getUTCFullYear();
 useEffect(()=>{const refresh=()=>setRevision(v=>v+1);window.addEventListener('arena-refresh-all',refresh);return()=>window.removeEventListener('arena-refresh-all',refresh)},[]);
 useEffect(()=>{setGame('');setData({});setAnalysisDate(taipeiFixtureDay(Date.now()));},[league]);
 useEffect(()=>{setView(['analysis','overview','teams','standings','live'].includes(initialView)?initialView:'analysis');},[initialView]);
 function changeView(value:string){setView(value);onViewChange?.(value);}
 useEffect(()=>{
  const c=new AbortController();setLoading(true);
  const kinds=league==='CPBL'?['standings','schedule']:['bat','pit','standings','schedule',...(league==='NPB'?['starters']:[])];
  let busy=false;async function load(){if(busy||document.hidden)return;busy=true;try{await Promise.all(kinds.map(async kind=>{try{const r=await fetch(`/api/international?kind=${league.toLowerCase()}-${kind}`,{signal:AbortSignal.any([c.signal,AbortSignal.timeout(45000)]),cache:'no-store'});if(!r.ok)throw new Error();const value=await r.json();if(!c.signal.aborted)setData(old=>({...old,[kind]:value}));}catch{if(!c.signal.aborted)setData(old=>({...old,[kind]:{...old[kind],error:'來源暫時無法取得',status:old[kind]?'stale':'unavailable'}}))}}));}finally{busy=false;if(!c.signal.aborted)setLoading(false)}}
  const resume=()=>{if(!document.hidden)void load();};void load();const timer=setInterval(()=>void load(),300000);document.addEventListener('visibilitychange',resume);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',resume);c.abort();};
 },[league,revision]);
 useEffect(()=>{
  if(!analysisDate)return;
  const c=new AbortController();let busy=false;
  // The selected fixture day can be tomorrow even while the local date is today.
  setData(old=>({...old,pregame:old.pregame?.pregame?.date===analysisDate?old.pregame:{}}));
  async function load(){if(busy||document.hidden)return;busy=true;try{
   const r=await fetch(`/api/international?kind=${league.toLowerCase()}-pregame&date=${encodeURIComponent(analysisDate)}`,{cache:'no-store',signal:AbortSignal.any([c.signal,AbortSignal.timeout(45000)])});
   if(!r.ok)throw new Error();const value=await r.json();
   if(!c.signal.aborted&&value.pregame?.date===analysisDate)setData(old=>({...old,pregame:value}));
  }catch{if(!c.signal.aborted)setData(old=>({...old,pregame:{...old.pregame,error:'來源暫時無法取得',status:'stale'}}))}finally{busy=false}}
  const resume=()=>{if(!document.hidden)void load()};void load();const timer=setInterval(()=>void load(),300000);document.addEventListener('visibilitychange',resume);
  return()=>{c.abort();clearInterval(timer);document.removeEventListener('visibilitychange',resume)};
 },[league,analysisDate,revision]);
 useEffect(()=>{setGameData(undefined);if(!game||!['NPB','CPBL'].includes(league))return;const c=new AbortController();setGameLoading(true);fetch(league==='CPBL'?`/api/international?kind=cpbl-game&url=${encodeURIComponent(data.schedule?.games?.find(g=>g.id===game)?.url||'')}`:`/api/international?kind=${liveTab==='preview'?'npb-preview':'npb-game'}&id=${encodeURIComponent(game)}`,{signal:c.signal}).then(async r=>{if(!r.ok)throw new Error();return r.json()}).then(value=>{if(!c.signal.aborted)setGameData(value)}).catch(()=>{if(!c.signal.aborted)setGameData({error:'單場紀錄讀取失敗'})}).finally(()=>{if(!c.signal.aborted)setGameLoading(false)});return()=>c.abort()},[game,league,revision,liveTab]);
 const directory=Object.values(profileTeams[league]);
 const record=(name:string)=>{for(const t of data.standings?.tables||[]){const r=t.rows.find(r=>r[t.headers.indexOf('球隊')]===name);if(r)return {wins:r[t.headers.indexOf('勝')],losses:r[t.headers.indexOf('敗')],ties:r[t.headers.indexOf('和')],rate:r[t.headers.indexOf('勝率')]};}return null;};
 const allPlayers=Object.values(data).flatMap(d=>d.tables||[]).filter(t=>t.headers.includes('球員')).reduce((n,t)=>n+t.rows.length,0);
 const goTeam=(name:string)=>{const code=profileCode(league,name);if(code)window.location.assign(profileHref(league,code));};
 const empty=(title:string,text:string)=><div className="panel p-6 space-y-2"><h3 className="font-bold">{title}</h3><p className="text-sm text-slate-400">{text}</p></div>;
 function tables(d:Data|undefined,selectedTeam=''){
  if(!d?.tables?.length)return empty('資料狀態',loading?'正在讀取資料…':d?.error||'目前來源沒有可用資料。');
  return <div className="space-y-4">{d.status==='stale'&&<p className="text-amber-200 text-sm">來源更新失敗，以下是上次取得的球季資料。</p>}{teamRows(d,selectedTeam).map((t,i)=>{const rows=t.rows.filter(r=>!search||r.join(' ').toLowerCase().includes(search.toLowerCase()));return <div key={i} className="panel p-4"><h3 className="mb-3 font-bold">{t.title} · {rows.length} 筆</h3><div className="max-h-[600px] overflow-auto"><Table><TableHeader><TableRow>{t.headers.map((h,j)=><TableHead key={j} className="whitespace-nowrap">{h}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((r,j)=><TableRow key={j}>{r.map((v,k)=><TableCell key={k} className="whitespace-nowrap">{v||'—'}</TableCell>)}</TableRow>)}</TableBody></Table></div>{!rows.length&&<p className="py-4 text-sm text-slate-400">沒有符合條件的資料。</p>}<p className="mt-3 text-xs text-slate-400">{d.scope||'球季累計；來源發布時間未驗證。'} · 擷取 {stamp(d.fetchedAt)}（台灣）</p></div>})}</div>
 }
 const directoryCards=league==='KBO'?<div className="team-directory">{directory.filter(n=>!search||n.toLowerCase().includes(search.toLowerCase())).map(name=>{const r=record(name);return <button key={name} type="button" onClick={()=>goTeam(name)} className="panel team-directory-card kbo-directory-card text-left"><InternationalTeamLogo league="KBO" name={name} size={52}/><div><h3>{name}</h3><p>KBO 韓國職棒</p></div>{r&&<div className="kbo-directory-record"><span className="text-emerald-300">{r.wins} 勝</span><span className="text-rose-300">{r.losses} 敗</span><span>{r.ties} 和</span><b>勝率 {r.rate}</b></div>}<small>查看球隊資料 →</small></button>})}</div>:<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{directory.filter(n=>!search||n.toLowerCase().includes(search.toLowerCase())).map(name=><button key={name} onClick={()=>goTeam(name)} className="panel group p-6 text-left transition-colors hover:border-yellow-300"><div className="flex items-center gap-3"><InternationalTeamLogo league={league} name={name}/><h3 className="text-lg font-bold break-words">{name}</h3></div><p className="mt-3 font-bold text-yellow-300">{record(name)?`${record(name)!.wins} 勝 ${record(name)!.losses} 敗 ${record(name)!.ties} 和`:""}</p><p className="mt-4 text-sm text-slate-400">查看球隊資料 →</p></button>)}</div>;
 const scheduleGames=league==='CPBL'?(data.schedule?.games||[]).filter(g=>!scheduleDate||g.date===scheduleDate):data.schedule?.games;
 const schedulePanel=<div className="space-y-4">{league==='CPBL'&&!game&&<div className="flex flex-wrap items-center gap-3"><label htmlFor="cpbl-date">台灣日期</label><Input id="cpbl-date" type="date" className="w-44" value={scheduleDate} onChange={e=>setScheduleDate(e.target.value)}/><Button variant="outline" onClick={()=>setScheduleDate('')}>全部賽事</Button></div>}{data.schedule?.error&&<p className="text-amber-200">{data.schedule.error}</p>}{game?<><Button variant="outline" onClick={()=>setGame('')}><ArrowLeft/>返回賽事</Button><h3 className="font-bold">{data.schedule?.games?.find(g=>g.id===game)?.label||'單場紀錄'}</h3><Tabs value={liveTab} onValueChange={setLiveTab}><TabsList className="flex h-auto flex-wrap"><TabsTrigger value="score">逐局比分</TabsTrigger><TabsTrigger value="players">投打紀錄</TabsTrigger>{league==='NPB'&&<TabsTrigger value="preview">先發近況</TabsTrigger>}<TabsTrigger value="plays">逐球紀錄</TabsTrigger></TabsList><TabsContent value={liveTab}>{gameLoading?empty('整理中','正在取得本場紀錄…'):liveTab==='plays'?empty('逐球紀錄尚未接通','目前沒有可靠的球數、出局數與壘包狀態，暫不顯示壘包動畫。'):tables({...gameData,tables:gameData?.tables?.filter(t=>liveTab==='score'?t.title==='逐局比分':t.title!=='逐局比分')})}</TabsContent></Tabs></>:<>{scheduleGames?.length?<div className="grid gap-4 md:grid-cols-2">{scheduleGames.map(g=><button key={g.id} className="panel p-5 text-left hover:border-yellow-300" onClick={()=>{setGame(g.id);setLiveTab('score')}}><p className="font-bold leading-relaxed">{g.label}</p><p className="mt-3 text-sm text-yellow-300">查看單場紀錄 →</p></button>)}</div>:empty('賽事紀錄',['NPB','CPBL'].includes(league)?(data.schedule?.error||(loading?'正在取得來源賽事…':'來源未列出這個日期的賽事，可切換日期或查看全部賽事。')):'目前沒有已接通的完整比分紀錄。SUPER 開放賽事可至賽前分析查看。')}<p className="text-xs text-slate-400">{['NPB','CPBL'].includes(league)?`來源頁列出的賽事，日期以場次標示為準；非逐球即時更新。擷取 ${stamp(data.schedule?.fetchedAt)}`:'完整賽程與逐球比分尚未接通。'}</p></>}</div>;
 return <section>
 <div className="league-heading arena-league-heading" data-view={view}><div><h1><span className="league-title-code">{league}</span> <span>{names[league]}</span></h1></div></div>
 <Tabs value={view} onValueChange={v=>{changeView(v);setGame('');setSearch('')}} className={`league-workspace ${league.toLowerCase()}-workspace`} data-view={view}><TabsList className="league-tabs" aria-label={`${names[league]}頁面`}>{[['overview','概覽'],['standings','戰績排名'],['teams','球隊一覽'],['live','即時比分'],['analysis','賽前分析・串關']].map(([v,label])=><TabsTrigger key={v} value={v}>{label}</TabsTrigger>)}</TabsList><TabsContent value={view} className="space-y-6">
 {view==='analysis'&&<><InternationalMarkets onDateChange={setAnalysisDate} dataLoading={loading} onRefreshData={()=>setRevision(v=>v+1)} odds={superData} league={league} schedule={data.schedule} standings={data.standings} starters={data.starters} pregame={data.pregame?.pregame}/></>}
 {view==='overview'&&<><div className="league-summary"><div><span>球季</span><strong>{year}</strong></div><div><span>已取得球隊分類</span><strong>{directory.length||'—'}</strong></div><div><span>球員成績筆數</span><strong>{allPlayers||'—'}</strong></div><div><span>SUPER 賽事</span><strong>{superData.error?'—':superData.data?.games?.length??'—'}</strong></div></div><div className="grid gap-4 md:grid-cols-3">{[['teams','球隊與球員',Users],['standings','戰績排名',Trophy],['live','比賽紀錄',Activity]].map(([v,label,Icon]:any)=><button key={v} className="panel p-5 text-left" onClick={()=>changeView(v)}><Icon className="mb-3 text-yellow-300"/><h2 className="font-bold">{label}</h2><p className="mt-2 text-sm text-slate-400">查看 {names[league]} →</p></button>)}</div><h2 className="text-xl font-bold">球隊一覽</h2>{directoryCards}{!directory.length&&empty('球隊資料待更新',league==='CPBL'?'尚無中職球員資料；連接 SUPER 後，可列出來源提供的參賽球隊。':'來源尚未回傳球隊分類。')}<p className="text-xs text-slate-400">球隊分類取自目前來源，非完整官方名冊；球員成績筆數可能包含同一人的投打紀錄。</p></>}
 {view==='standings'&&(league==='CPBL'?<CpblStandings data={data.standings} year={year} loading={loading} onRefresh={()=>setRevision(v=>v+1)} onTeamSelect={goTeam}/>:league==='NPB'?<NpbStandings data={data.standings} year={year} loading={loading} onRefresh={()=>setRevision(v=>v+1)} onTeamSelect={goTeam}/>:<KboStandings data={data.standings} year={year} loading={loading} onRefresh={()=>setRevision(v=>v+1)} onTeamSelect={goTeam}/>)}

 {view==='teams'&&<><div className="standings-heading !px-0"><h2>球隊一覽</h2><Input className="w-full sm:w-64" aria-label="搜尋球隊" placeholder="搜尋球隊" value={search} onChange={e=>setSearch(e.target.value)}/></div>{directoryCards}{!directory.length&&empty('尚未取得球隊','來源回傳球隊後會顯示可開啟的球隊卡片。')}{!!directory.length&&!directory.some(n=>n.toLowerCase().includes(search.toLowerCase()))&&<p>沒有符合條件的球隊。</p>}</>}
 {view==='live'&&<><div hidden={league==='NPB'&&!!game}><InternationalLiveFeed key={league} league={league} revision={revision} onGameDetails={league==='NPB'?id=>{setGame(id);setLiveTab('score')}:undefined}/></div>{league==='NPB'&&game&&schedulePanel}</>}
 </TabsContent></Tabs>
 </section>
}
