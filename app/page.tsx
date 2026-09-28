"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, CalendarDays, CheckCircle2, CircleDot, Database, Gauge, LogOut, RefreshCw, ShieldCheck, TimerReset, Users, Wifi, WifiOff } from "lucide-react";
import { Tabs,TabsList,TabsTrigger,TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

import { teamZh, gameDetailZh } from "./zh";
import Pregame from './pregame';
import TeamName from './team-name';
import PlayerLink from './player-link';
import Standings from './standings';
import TeamsDirectory from './teams-directory';
import LiveScoreboard from './live-scoreboard';
import SessionAccount from './session-account';
import AdminEntry from './admin-entry';
import {useLeagueLive} from './use-league-live';
import SuperWorkspace,{SuperEntryButton} from './super-workspace';
import FootballBoard from './football-board';
import InternationalBoard from './international-board';
import {BASEBALL_LEAGUES,frontSelection,leaguePageHref,type FrontLeague} from '@/lib/sport-navigation';
import './football.css';

type Player = { name:string; playerId:string; attempts:number; avgHitSpeed:number; maxHitSpeed:number; sweetSpot:number; hardHit:number; barrels:number; barrelRate:number };
type LiveGame = { id:number; awayId?:number; homeId?:number; away:string; home:string; awayScore:number|null; homeScore:number|null; status:string; detail:string; start:string; live:boolean; final:boolean; line:any; pitchCount:number|null; detailError:boolean; detailFetchedAt:string|null };
const YEAR = new Date().getFullYear();
const CSV = `https://baseballsavant.mlb.com/leaderboard/statcast?type=batter&year=${YEAR}&position=&team=&min=10&sort=6&sortDir=desc&csv=true`;
const REFRESH_MS = 20 * 60 * 1000;
const SCORE_REFRESH_MS = 15 * 1000;

function split(line:string) {
  const result:string[]=[]; let value="", quoted=false;
  for(let i=0;i<line.length;i++){ const c=line[i]; if(c==='"'&&line[i+1]==='"'&&quoted){value+='"';i++;}else if(c==='"')quoted=!quoted;else if(c===","&&!quoted){result.push(value);value="";}else value+=c; }
  result.push(value); return result;
}
function parse(csv:string):Player[]{
  const rows=csv.replace(/^\uFEFF/,"").trim().split(/\r?\n/).map(split), headers=rows.shift()??[];
  const at=(name:string)=>headers.indexOf(name), num=(row:string[],name:string)=>Number(row[at(name)]||0);
  return rows.map(row=>({name:row[at("last_name, first_name")]||"未知球員",playerId:row[at("player_id")]||"",attempts:num(row,"attempts"),avgHitSpeed:num(row,"avg_hit_speed"),maxHitSpeed:num(row,"max_hit_speed"),sweetSpot:num(row,"anglesweetspotpercent"),hardHit:num(row,"ev95percent"),barrels:num(row,"barrels"),barrelRate:num(row,"brl_percent")})).filter(p=>p.playerId&&Number.isFinite(p.avgHitSpeed));
}
function taipeiDate(){ return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Taipei",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()); }
function mapGame(game:any):LiveGame{
  const state=game.status?.abstractGameState||"Preview", line=game.linescore;
  const live=state==="Live", final=state==="Final";
  const detail=gameDetailZh(game);
  return {id:game.gamePk,awayId:game.teams?.away?.team?.id,homeId:game.teams?.home?.team?.id,away:teamZh(game.teams?.away?.team),home:teamZh(game.teams?.home?.team),awayScore:game.teams?.away?.score??null,homeScore:game.teams?.home?.score??null,status:state,detail,start:game.gameDate,live,final,line,pitchCount:game.pitchCount??null,detailError:!!game.detailError,detailFetchedAt:game.detailFetchedAt??null};
}

export default function Home(){
  const leagueLive=useLeagueLive();
  const [updatingAll,setUpdatingAll]=useState(false),[updateNotice,setUpdateNotice]=useState('');
  const updateLock=useRef(false);
  const [league,setLeague]=useState<FrontLeague>('MLB'),[baseballLeague,setBaseballLeague]=useState<'MLB'|'NPB'>('MLB');
  const [view,setView]=useState('analysis');
  useEffect(()=>{const read=()=>{const next=frontSelection(window.location.search);setLeague(next.league);if(next.league!=='FOOTBALL')setBaseballLeague(next.league);setView(next.view);};read();window.addEventListener('popstate',read);return()=>window.removeEventListener('popstate',read);},[]);
  function selectLeague(next:FrontLeague){setLeague(next);if(next!=='FOOTBALL')setBaseballLeague(next);setUpdateNotice('');window.history.replaceState(null,'',leaguePageHref(next,view));}
  function selectView(next:string){setView(next);window.history.replaceState(null,'',leaguePageHref(league,next));}
  const [scoreFilter,setScoreFilter]=useState('all');
  const [players,setPlayers]=useState<Player[]>([]);
  const [loading,setLoading]=useState(true),[error,setError]=useState(""),[updatedAt,setUpdatedAt]=useState<Date|null>(null);
  const [liveGames,setLiveGames]=useState<LiveGame[]>([]),[scoreUpdatedAt,setScoreUpdatedAt]=useState<Date|null>(null),[scoreError,setScoreError]=useState("");
  const refresh=useCallback(async()=>{setLoading(true);setError("");try{const response=await fetch(`${CSV}&refresh=${Date.now()}`,{cache:"no-store",signal:AbortSignal.timeout(20000)});if(!response.ok)throw new Error(`HTTP ${response.status}`);const next=parse(await response.text());if(!next.length)throw new Error("資料內容為空");setPlayers(next);setUpdatedAt(new Date());}catch(reason){setError("連線失敗，請稍後重試");}finally{setLoading(false);}},[]);
  useEffect(()=>{refresh();const timer=window.setInterval(refresh,REFRESH_MS);return()=>window.clearInterval(timer);},[refresh]);
  const scoresBusy=useRef(false);
  const refreshScores=useCallback(async()=>{if(scoresBusy.current)return;scoresBusy.current=true;try{setScoreError("");const response=await fetch('/api/baseball?kind=scores',{cache:"no-store",signal:AbortSignal.timeout(35000)});if(!response.ok)throw new Error(`HTTP ${response.status}`);const data=await response.json();setLiveGames((data.games||[]).map(mapGame).sort((a:LiveGame,b:LiveGame)=>Number(b.live)-Number(a.live)||Date.parse(a.start)-Date.parse(b.start)));setScoreUpdatedAt(new Date(data.fetchedAt));}catch(reason){setScoreError("比分連線失敗，請稍後重試");}finally{scoresBusy.current=false;}},[]);
  useEffect(()=>{refreshScores();const timer=window.setInterval(refreshScores,SCORE_REFRESH_MS);return()=>window.clearInterval(timer);},[refreshScores]);


  async function updateAll(){
    if(league==='FOOTBALL'){window.dispatchEvent(new Event('arena-refresh-all'));setUpdateNotice('正在更新足球賽程與分析。');return;}
    if(updateLock.current)return;updateLock.current=true;setUpdatingAll(true);setUpdateNotice('正在更新資料並連接 SUPER…');
    const stats=Promise.allSettled([refresh(),refreshScores()]);
    try{const r=await fetch('/api/hr9988',{method:'POST',cache:'no-store',signal:AbortSignal.timeout(55000)});const d=await r.json();
      if(r.status===401||['tz_auth_expired','binding_required','signin_required'].includes(d.code)){window.location.assign('/login?reason=tz-expired');return;}
      setUpdateNotice(r.ok?'已重新連接 SUPER；各頁資料更新中。':d.error||'SUPER 連線失敗，其他資料仍會更新。');
    }catch{setUpdateNotice('SUPER 連線逾時或失敗，請再按立即更新重試。');}
    finally{window.dispatchEvent(new Event('arena-refresh-all'));await stats;setUpdatingAll(false);updateLock.current=false;}
  }

  const filteredGames=liveGames.filter(g=>scoreFilter==='all'||scoreFilter==='live'&&g.live||scoreFilter==='final'&&g.final||scoreFilter==='upcoming'&&!g.live&&!g.final);
  return <SuperWorkspace league={league}><main className="arena-shell min-h-screen text-slate-100" data-sport={league==='FOOTBALL'?'football':'baseball'}>
    <header className="sticky top-0 z-20 border-b border-white/8 bg-[#081522]/95 backdrop-blur"><div className="mx-auto flex min-h-16 max-w-[1440px] flex-wrap items-center gap-3 px-4 py-3 lg:px-7">
      <div className="flex shrink-0 items-center gap-3"><a href="https://line.me/ti/p/ZuZetvA6NY" target="_blank" rel="noopener noreferrer" aria-label="透過 LINE 聯絡 YJ（另開視窗）" className="shrink-0 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ffd538]"><img src="/yj-logo.png" alt="YJ" width={40} height={40} className="size-10 object-contain"/></a><span className="whitespace-nowrap text-lg font-black">YJ體育分析</span></div>
      {league==='MLB'?<><div className="ml-auto flex items-center gap-2 text-sm text-slate-400"><TimerReset className="size-4 shrink-0"/><span>最後更新時間：{updatedAt?updatedAt.toLocaleString("zh-TW",{timeZone:"Asia/Taipei",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"}):"等待同步"}</span></div>
      <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1.5 text-xs font-bold text-emerald-300">{error?<WifiOff className="size-3.5"/>:<Wifi className="size-3.5"/>}{error?"連線異常":loading?"正在同步":"資料已連線"}</div></>:<div className="ml-auto text-sm text-slate-400">{league==='NPB'?'棒球・NPB 日本職棒':'足球・五大聯賽＋歐冠＋歐國聯'}</div>}
      <Button onClick={()=>void updateAll()} disabled={updatingAll} className="bg-[#ffd538] font-black text-[#06101b] hover:bg-[#ffe36f]"><RefreshCw className={updatingAll?"animate-spin":""}/>{updatingAll?"更新中":"立即更新"}</Button>
      <SuperEntryButton/>
      <AdminEntry/>
      <SessionAccount/>
      <a href="https://line.me/ti/p/ZuZetvA6NY" target="_blank" rel="noopener noreferrer" aria-label="LINE 聯絡我們（另開視窗）" title="LINE 聯絡我們" className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ffd538]"><img src="/line-contact.png" alt="LINE" width={36} height={36} className="size-9 object-contain" style={{clipPath:'inset(0 round 25%)'}}/></a>
    </div>{updateNotice&&<p role="status" className="mx-auto max-w-[1440px] px-4 pb-2 text-xs text-amber-200">{updateNotice}</p>}</header>
    <div className="mx-auto max-w-[1440px] px-4 py-6 lg:px-7">
      <nav className="league-switcher" aria-label="運動項目切換">
        <button type="button" aria-pressed={league!=='FOOTBALL'} onClick={()=>selectLeague(baseballLeague)}><b>棒球</b><span>MLB・NPB</span>{(leagueLive.NPB||!scoreError&&!!scoreUpdatedAt&&leagueLive.now-scoreUpdatedAt.getTime()<120000&&liveGames.some(game=>game.live))&&<i>LIVE</i>}</button>
        <button type="button" aria-pressed={league==='FOOTBALL'} onClick={()=>selectLeague('FOOTBALL')}><b>足球</b><span>五大聯賽＋歐冠＋歐國聯</span></button>
      </nav>
      {league!=='FOOTBALL'&&<nav className="baseball-league-switcher" aria-label="棒球聯盟切換">{BASEBALL_LEAGUES.map(item=><button type="button" key={item.code} aria-pressed={league===item.code} onClick={()=>selectLeague(item.code)}><b>{item.code}</b><span>{item.name}</span>{(item.code==='NPB'?leagueLive.NPB:!scoreError&&!!scoreUpdatedAt&&leagueLive.now-scoreUpdatedAt.getTime()<120000&&liveGames.some(game=>game.live))&&<i>LIVE</i>}</button>)}</nav>}
      {league==='FOOTBALL'&&<FootballBoard/>}
      {league==='NPB'&&<div data-super-league="NPB"><InternationalBoard league="NPB" initialView={view} onViewChange={selectView}/></div>}
      <div data-super-league="MLB" hidden={league!=='MLB'}>
      <div className="league-heading arena-league-heading" data-view={view}><div><h1><span className="league-title-code">MLB</span> <span>美國職棒</span></h1></div></div>
      <Tabs value={view} onValueChange={selectView} className="league-workspace" data-view={view}>
        <TabsList className="league-tabs" aria-label="美國職棒頁面"><TabsTrigger value="overview">概覽</TabsTrigger><TabsTrigger value="standings">戰績排名</TabsTrigger><TabsTrigger value="teams">球隊一覽</TabsTrigger><TabsTrigger value="live">即時比分</TabsTrigger><TabsTrigger value="analysis">賽前分析・串關</TabsTrigger></TabsList>
        <TabsContent value={view} className="space-y-6">
        {view==='teams'&&<TeamsDirectory/>}
        {view==='live'&&<LiveScoreboard/>}
        {view==='overview'&&<div className="league-summary"><div><span>台灣日期</span><strong>{taipeiDate()}</strong></div><div><span>今日與跨日賽事</span><strong>{scoreUpdatedAt?liveGames.length:'—'} <small>場</small></strong></div><div><span>進行中</span><strong className="text-rose-300">{scoreUpdatedAt?liveGames.filter(g=>g.live).length:'—'} <small>場</small></strong></div><div><span>已完賽</span><strong>{scoreUpdatedAt?liveGames.filter(g=>g.final).length:'—'} <small>場</small></strong></div></div>}
        <div hidden={view!=='overview'&&view!=='standings'}><Standings/></div>
        <div hidden={view!=='overview'}>

      <section className="panel mb-5 overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/8 px-5 py-4"><div><div className="flex items-center gap-2 font-black"><CircleDot className="size-5 text-rose-400"/>即時比分</div><p className="mt-1 text-xs text-slate-500">台灣今日與跨日賽事</p></div><div className="flex items-center gap-2 text-xs font-bold text-slate-400"><span className={`size-2 rounded-full ${liveGames.some(game=>game.live)?"bg-rose-400 animate-pulse":"bg-slate-600"}`}/>{liveGames.filter(game=>game.live).length?`${liveGames.filter(game=>game.live).length} 場進行中・更新 ${scoreUpdatedAt?.toLocaleTimeString("zh-TW",{timeZone:"Asia/Taipei"})??"同步中"}`:scoreUpdatedAt?`更新於 ${scoreUpdatedAt.toLocaleTimeString("zh-TW",{hour:"2-digit",minute:"2-digit"})}`:"同步中"}</div></div>
        <div className="score-filters" role="group" aria-label="篩選賽事狀態">{[['all','全部'],['live','進行中'],['upcoming','未開賽'],['final','已完賽']].map(([key,label])=><Button key={key} variant="ghost" aria-pressed={scoreFilter===key} onClick={()=>setScoreFilter(key)}>{label}</Button>)}</div>
        {scoreError?<div className="p-5 text-sm text-rose-200">即時比分暫時無法更新：{scoreError}</div>:<div className="score-grid">{filteredGames.map(game=><div key={game.id} className="score-card"><div className="mb-3 flex items-center justify-between text-xs font-bold"><span className={game.live?"text-rose-300":"text-slate-500"}>{game.live?"進行中":game.final?"已完賽":game.detail.includes("開賽")?"賽前":"賽事狀態"}</span><span className="text-slate-500">{game.detail}</span></div><div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 text-sm"><span className="font-bold"><TeamName team={{id:game.awayId,name:game.away}}/></span><b className="text-lg text-[#ffd538]">{game.awayScore??"—"}</b><span className="font-bold"><TeamName team={{id:game.homeId,name:game.home}}/></span><b className="text-lg text-[#ffd538]">{game.homeScore??"—"}</b></div>{(game.live||game.final)&&<details className="game-expand"><summary>逐局比分與場況</summary><LiveDetails game={game}/></details>}</div>)}{!filteredGames.length&&<div className="p-6 text-sm text-slate-400">{!scoreUpdatedAt?"正在取得賽事…":scoreFilter==="all"?"今天沒有美職棒賽事":"目前沒有符合此狀態的賽事"}</div>}</div>}
      </section>
      </div>
      <div hidden={view==='live'||view==='standings'||view==='teams'} className="analysis-workspace"><Pregame/></div>
      </TabsContent></Tabs>
      </div>

    </div>

  </main></SuperWorkspace>;
}

function LiveDetails({game}:{game:LiveGame}){
 const line=game.line;
 if(!line||(!game.live&&!game.final))return null;
 const onBase=line.offense?[['一壘',line.offense.first],['二壘',line.offense.second],['三壘',line.offense.third]].filter(([,p])=>p).map(([label])=>label).join('、'):null;
 return <div className="mt-4 space-y-3 border-t border-white/10 pt-3 text-sm">
  {game.live&&<><div className="flex flex-wrap gap-x-4 gap-y-1 text-slate-300"><span>出局 {line.outs??'—'}</span><span>好球 {line.strikes??'—'}</span><span>壞球 {line.balls??'—'}</span></div><p className="text-slate-300">壘上：{onBase===null?'尚未提供':onBase||'無人'}</p><p className="text-slate-400">打者：<PlayerLink id={line.offense?.batter?.id}>{line.offense?.batter?.fullName||'尚未提供'}</PlayerLink><br/>投手：<PlayerLink id={line.defense?.pitcher?.id}>{line.defense?.pitcher?.fullName||'尚未提供'}</PlayerLink>・本場用球 {game.pitchCount??'—'} 球</p></>}
  <div className="overflow-x-auto"><table className="w-full text-center text-sm"><caption className="sr-only">逐局得分、安打與失誤</caption><thead><tr className="text-slate-400"><th className="pr-2 text-left">球隊</th>{(line.innings||[]).map((i:any)=><th key={i.num} className="min-w-7">{i.num}</th>)}<th className="min-w-9">分</th><th className="min-w-9">安</th><th className="min-w-9">誤</th></tr></thead><tbody>{(['away','home'] as const).map(side=><tr key={side}><th className="py-1 pr-2 text-left">{side==='away'?'客':'主'}</th>{(line.innings||[]).map((i:any)=><td key={i.num}>{i[side]?.runs??'—'}</td>)}<td>{line.teams?.[side]?.runs??'—'}</td><td>{line.teams?.[side]?.hits??'—'}</td><td>{line.teams?.[side]?.errors??'—'}</td></tr>)}</tbody></table></div>
  {game.live&&<p className="text-slate-400">{game.detailError?'詳細資料更新失敗，目前顯示賽程比分。':game.detailFetchedAt?`場況抓取：${new Date(game.detailFetchedAt).toLocaleTimeString('zh-TW',{timeZone:'Asia/Taipei'})}`:'等待詳細場況'}</p>}

 </div>;
}
