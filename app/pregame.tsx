"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from '@/components/ui/select';
import { RefreshCw } from 'lucide-react';
import { doubleheaderLabel,matchStartLabel,isMlbPostseason,canShowPregameMarkets,fresh,isPregame,shiftDay,taipeiDay,type Kind,type Leg,type Match,type Schedule,type Snapshot } from '@/lib/baseball';
import Markets from './markets';
import {winnerAnalysis,winnerParlayProbability} from '@/lib/winner-analysis';
import MatchInningBoard from './match-inning-board';
import {matchScore,showMatchScoreboard,type MatchScoreSnapshot} from '@/lib/match-scoreboard';
import {superOdds,type SuperSnapshot} from '@/lib/super007';
import GameContext,{type AnalysisState} from './game-context';
import {useSource} from './use-source';
import type { RunSnapshot } from '@/lib/markets';
import { teamZh } from './zh';
import TeamName from './team-name';
import PlayerLink from './player-link';
import Link from 'next/link';
import {matchOdds} from '@/lib/pinnacle';
import {boardQuote,binaryOutcome} from '@/lib/board-markets';
import MarketOutcomes from './market-outcomes';

const stamp=(s:string|undefined)=>s?new Date(s).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'尚未取得';
export default function Pregame(){
  const [parlayMode,setParlayMode]=useState<'markets'|'winner'>('markets');
  const [evaluation,setEvaluation]=useState<any>(null);
  const updateResults=useCallback((value:any)=>setEvaluation(value),[]);
  const [analysis,setAnalysis]=useState<Record<number,AnalysisState>>({});
  const updateAnalysis=useCallback((id:number,value:AnalysisState)=>setAnalysis(old=>({...old,[id]:value.loading?{...old[id],loading:true}:value})),[]);
  const primaryOdds=useSource<SuperSnapshot>('member-odds',60000);
  const runs=useSource<RunSnapshot>('runs',20*60000);
  const pitchers=useSource<Snapshot>('pitcher',20*60000),batting=useSource<Snapshot>('batter-team',20*60000),pitching=useSource<Snapshot>('pitcher-team',20*60000),schedule=useSource<Schedule>('schedule',30000);
  const [now,setNow]=useState(Date.now()),[dateMode,setDateMode]=useState('auto'),[count,setCount]=useState(3),[legs,setLegs]=useState<(Leg&{quote?:string})[]>([]),[notice,setNotice]=useState('');
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),10000);return()=>clearInterval(timer);},[]);
  const today=taipeiDay(now);
  const nextGame=(schedule.data?.games||[]).filter(g=>canShowPregameMarkets(g,now)&&taipeiDay(g.date)>=today).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date))[0];
  const activeGame=(schedule.data?.games||[]).filter(g=>g.state==='Live').sort((a,b)=>Date.parse(a.date)-Date.parse(b.date))[0];
  const autoDay=activeGame?taipeiDay(activeGame.date):nextGame?taipeiDay(nextGame.date):today;
  const day=dateMode==='auto'||dateMode<today?autoDay:dateMode;
  const scores=useSource<MatchScoreSnapshot>(`scores&date=${day}`,15000);
  const dateOptions=Array.from({length:8},(_,i)=>shiftDay(today,i));
  const previousDay=useRef(day);
  useEffect(()=>{
    if(previousDay.current!==day){setLegs([]);setNotice('');previousDay.current=day;}
  },[day]);
  useEffect(()=>{
    setDateMode('auto');
    void schedule.refresh();
  },[today,schedule.refresh]);
  useEffect(()=>{
    const resume=()=>{if(document.visibilityState==='visible'){setNow(Date.now());void schedule.refresh();}};
    document.addEventListener('visibilitychange',resume);window.addEventListener('focus',resume);
    return()=>{document.removeEventListener('visibilitychange',resume);window.removeEventListener('focus',resume);};
  },[schedule.refresh]);
  const datePicker=<Select value={dateMode<today&&dateMode!=='auto'?'auto':dateMode} onValueChange={v=>{setDateMode(v);setLegs([]);setNotice('');}}><SelectTrigger aria-label="選擇台灣賽事日期"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="auto">自動 {autoDay}（台灣）</SelectItem>{dateOptions.map(d=><SelectItem key={d} value={d}>{d}（台灣）</SelectItem>)}</SelectContent></Select>;
  const odds={...primaryOdds,data:superOdds(primaryOdds.data,schedule.data?.games||[],teamZh)};
  const selectedGames=(schedule.data?.games||[]).filter(g=>taipeiDay(g.date)===day).sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
  const scheduleOK=!schedule.error&&fresh(schedule.data?.fetchedAt,now,120000);
  const sources=[{title:'個別投手',kind:'pitcher' as Kind,...pitchers},{title:'團隊打擊',kind:'batter-team' as Kind,...batting},{title:'團隊投球',kind:'pitcher-team' as Kind,...pitching}];
  const moneyline=(g:Match)=>boardQuote(matchOdds(g,odds.data),'moneyline');
  const moneylineOK=!odds.error&&fresh(odds.data?.fetchedAt,now,150000);
  const model=(g:Match)=>winnerAnalysis(g,analysis[g.id]?.report,now,scheduleOK);
  const probability=(g:Match)=>model(g).homeWin;
  const unavailable=(g:Match)=>{
    if(!scheduleOK)return '賽程更新中或已過期';
    if(!isPregame(g,now))return g.startTimeTBD?'開賽時間待定，暫停賽前推薦':g.state==='Final'?'已完賽':'已到開賽時間，賽前選擇已關閉';
    if(!moneylineOK)return '獨贏資料尚未取得或已過期';
    const event=matchOdds(g,odds.data);
    if(!event)return '尚未對應到本場來源資料';
    return !moneyline(g)?(event.issues?.moneyline==='尚未開盤'?'來源尚未提供獨贏報價':event.issues?.moneyline||'獨贏報價無效'):'';
  };
  const analysisUnavailable=(g:Match)=>model(g).canEstimate?'':model(g).reason;
  const eligible=selectedGames.filter(g=>!unavailable(g)&&model(g).canRecommend);
  const chosen=legs.map(leg=>({leg,g: (schedule.data?.games||[]).find(g=>g.id===leg.gameId)}));
  const allValid=chosen.length===count&&chosen.every(x=>x.g&&!unavailable(x.g)&&!analysisUnavailable(x.g)&&x.leg.quote===moneyline(x.g)?.signature);
  const combined=allValid?winnerParlayProbability(chosen.map(x=>({analysis:model(x.g!),side:x.leg.side})),count):null;
  function choose(g:Match,side:'away'|'home'){
    const reason=unavailable(g);if(reason){setNotice(reason);return;}
    setParlayMode('winner');
    if(legs.some(l=>l.gameId===g.id&&l.side===side&&l.quote===moneyline(g)?.signature)){setLegs(legs.filter(l=>l.gameId!==g.id));return;}
    const rest=legs.filter(l=>l.gameId!==g.id);
    if(rest.length>=count){setNotice(`最多選 ${count} 場，請先移除一場。`);return;}
    if(rest.some(l=>{const other=schedule.data?.games.find(x=>x.id===l.gameId);return other&&[other.home.id,other.away.id].some(id=>id===g.home.id||id===g.away.id);})){setNotice('為避免同隊雙重賽的關聯，同一隊只可出現在一個關卡。');return;}
    setLegs([...rest,{gameId:g.id,side,quote:moneyline(g)?.signature}]);setNotice('');
  }
  function recommend(){const used=new Set<number>();const next:Leg[]=[];for(const g of [...eligible].sort((a,b)=>Number(model(b).status==='ready')-Number(model(a).status==='ready')||Math.abs(probability(b)!-.5)-Math.abs(probability(a)!-.5))){const p=probability(g)!;if(p===.5||used.has(g.home.id)||used.has(g.away.id))continue;used.add(g.home.id);used.add(g.away.id);next.push({gameId:g.id,side:p>.5?'home':'away'});if(next.length===count)break;}setLegs(next.map(leg=>({...leg,quote:moneyline(eligible.find(g=>g.id===leg.gameId)!)?.signature})));setNotice(next.length<count?`只有 ${next.length} 場符合條件，不勉強湊滿 ${count} 關。`:'');}
  function matchHeader(g:Match,expectedRunsInfo:ReactNode){
    const h=probability(g),pre=isPregame(g,now),show=pre&&scheduleOK&&h!==null;
    const score=matchScore(g,scores.data,day),showScoreboard=showMatchScoreboard(g,score);
    const gameLabel=doubleheaderLabel(g);
    const sourceStart=matchOdds(g,odds.data)?.sourceStart;
    const differentSourceTime=sourceStart&&(g.startTimeTBD||Math.abs(Date.parse(sourceStart)-Date.parse(g.date))>600000);
    return <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-400">{matchStartLabel(g)}</span>
          {differentSourceTime&&<span className="text-slate-400">來源暫列：{stamp(sourceStart)}（台灣，以實際開賽為準）</span>}
          {gameLabel&&<span className="inline-flex items-center rounded border border-[#ffd538]/50 bg-[#ffd538]/10 px-2 py-0.5 font-bold text-[#ffd538]" aria-label={`雙重賽第 ${g.gameNumber} 場`} title={`雙重賽第 ${g.gameNumber} 場`}>{gameLabel}</span>}
        </div>
        <div className="ml-auto min-w-0 text-right text-slate-400">{expectedRunsInfo}{!pre&&<span className="text-amber-200">{g.state==='Final'?'已完賽 不提供回填預測':g.state==='Live'?'進行中 不再提供賽前選擇':g.startTimeTBD?'開賽時間待定，暫停賽前推薦':'賽事狀態待確認／已到開賽時間'}</span>}</div>
      </div>
      <div className="match-header-teams grid gap-4 sm:grid-cols-2" data-scoreboard={showScoreboard}>
        {(['away','home'] as const).map(side=>{
          const team=g[side],prob=show?(side==='home'?h!:1-h!):null;
          return <div key={side} className="match-team-summary min-w-0" data-side={side}>
            <div className="match-team-identity">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h4 className="text-base font-bold"><Link href={`/teams/${team.id}`} prefetch={false} className="player-link"><TeamName team={team} size={32}/></Link><span className="ml-1 text-sm font-normal text-slate-400">（{side==='home'?'主':'客'}）</span></h4>
              <span className="whitespace-nowrap text-2xl font-black tabular-nums text-[#ffd538]" title="依已取得的戰績、先發與分項數據試算；尚未回測校準">
                <span className="mr-1 text-sm font-medium text-slate-400">預估勝率</span>{prob===null?'待分析':`${Math.round(prob*100)}%`}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-400">{isMlbPostseason(g.gameType)?'例行賽 ':''}{team.wins??'—'} 勝 {team.losses??'—'} 敗</p>
            </div>
            <p className="match-pitcher-summary my-2 flex flex-wrap items-center gap-x-3 gap-y-1 break-words text-sm text-slate-400"><span>預計先發：<PlayerLink id={team.pitcherId} season={g.season} gameType={isMlbPostseason(g.gameType)?'R':g.gameType}>{team.pitcherName}</PlayerLink></span><span className="whitespace-nowrap">{isMlbPostseason(g.gameType)?'例行賽':'本季'}防禦率 <strong className="font-semibold tabular-nums text-slate-200">{scheduleOK&&team.pitcherId&&team.pitcherEra!=null?team.pitcherEra.toFixed(2):'—'}</strong></span><span className="whitespace-nowrap" title="本季每局被上壘率（WHIP）">{isMlbPostseason(g.gameType)?'例行賽':'本季'} WHIP <strong className="font-semibold tabular-nums text-slate-200">{scheduleOK&&team.pitcherId&&team.pitcherWhip!=null?team.pitcherWhip.toFixed(2):'—'}</strong></span></p>
          </div>;
        })}
        {showScoreboard&&<MatchInningBoard match={g} score={score} fetchedAt={scores.data?.date===day?scores.data.fetchedAt:undefined} error={scores.error} now={now}/>}
      </div>
    </>;
  }
  function winnerOptions(g:Match){
    const state=model(g),h=state.homeWin,reason=unavailable(g),q=moneylineOK&&canShowPregameMarkets(g,now)?moneyline(g):null;
    return <section aria-label="全場獨贏選項" data-analysis-status={state.status} className="space-y-3"><h5 className="text-sm font-bold">全場獨贏</h5><div className="grid gap-4 sm:grid-cols-2">{(['away','home'] as const).map(side=>{
      const probability=h===null?null:side==='home'?h:1-h,r=!reason&&state.canEstimate&&probability!==null?binaryOutcome(probability):null;
      const active=legs.some(l=>l.gameId===g.id&&l.side===side&&l.quote===q?.signature);
      return <Button key={side} aria-pressed={active} variant={active?'default':'outline'} disabled={!!reason} onClick={()=>choose(g,side)} className="market-option-card h-auto w-full items-start whitespace-normal p-3 text-left"><span className="block w-full">
        <span className="market-pick-title flex flex-wrap items-start justify-between gap-x-3 gap-y-1 font-bold"><span className="min-w-0"><TeamName team={g[side]}/>{r&&state.favoredSide===side&&<span data-winner-recommendation={state.status} className={`ml-2 ${active?'text-green-700':'text-green-400'}`} title={state.status==='preliminary'?'依目前可用資料試算；分項未齊，僅供初步參考':'依多因素試算；尚未回測校準'}>推薦</span>}{active&&<span className="ml-1 text-green-700" aria-label="已選取">✓</span>}</span><span className="ml-auto whitespace-nowrap tabular-nums">獨贏{q?` @${(side==='home'?q.first:q.second).toFixed(3)}`:''}</span></span>
        <span className="mt-3 block text-sm">{r?<><span className="mb-1 block">預估勝率</span><MarketOutcomes outcome={r}/></>:!isPregame(g,now)?(g.startTimeTBD?'開賽時間待定':g.state==='Final'?'已完賽':'賽前選擇已關閉'):reason||state.reason}</span>
      </span></Button>;
    })}</div>
    {reason&&<p className="text-sm text-amber-200">{`不可加入獨贏串關：${reason}`}</p>}
    {!reason&&state.status==='blocked'&&<p className="text-sm text-amber-200">暫停分析推薦：{state.reason}。報價有效時仍可手動選取，不參與自動推薦或串關機率試算。</p>}
    </section>;
  }
  function chosenAnalysis(g:Match,side:'away'|'home'){
    const state=model(g);
    if(!state.canEstimate||state.homeWin===null)return `已手動選取；${state.reason}`;
    const p=side==='home'?state.homeWin:1-state.homeWin;
    return `預估勝率 ${(p*100).toFixed(1)}%`;
  }
  const winnerPanel=<div className="space-y-4"><label className="block text-sm text-slate-400">關卡數量</label><Select value={String(count)} onValueChange={v=>{const n=Number(v);setCount(n);setLegs(l=>l.slice(0,n));setNotice('');}}><SelectTrigger aria-label="選擇串關數量" className="w-full"><SelectValue/></SelectTrigger><SelectContent>{[3,4,5].map(n=><SelectItem key={n} value={String(n)}>{n} 關</SelectItem>)}</SelectContent></Select>
        <Button className="w-full" onClick={recommend} disabled={!scheduleOK||!eligible.length}>自動推薦 {count} 關</Button>
        {notice&&<div aria-live="polite" className="text-sm text-amber-200">{notice}</div>}
        <p className="font-bold">已選 {legs.length}／{count} 關</p>
        {chosen.map(({leg,g})=><div key={leg.gameId} className="rounded-lg border border-white/10 p-3"><div className="flex justify-between gap-2"><span className="font-bold">{g?<TeamName team={g[leg.side]}/>: '賽事資料已失效'} 勝</span><button aria-label="移除此關" className="text-sm underline" onClick={()=>setLegs(l=>l.filter(x=>x.gameId!==leg.gameId))}>移除</button></div>{g&&<p className="mt-1 text-xs text-slate-400"><TeamName team={g.away} size={20}/> 對 <TeamName team={g.home} size={20}/></p>}<p className="mt-1 text-sm text-amber-200">{g?unavailable(g)||(leg.quote!==moneyline(g)?.signature?'獨贏資料或賠率已變動，請重新選擇':'')||chosenAnalysis(g,leg.side):'資料缺漏，請重新選擇'}</p></div>)}
        <div className="rounded-xl bg-[#ffd538]/10 p-4" title="依各場預估勝率相乘的獨立試算"><p className="text-sm">串關預估勝率</p><p className="my-2 text-3xl font-black text-[#ffd538]">{combined===null?'—':`${(combined*100).toFixed(1)}%`}</p></div>
        <Button variant="outline" className="w-full" onClick={()=>{setLegs([]);setNotice('');}} disabled={!legs.length}>清空組合</Button>

      </div>;
  return <section className="mb-6 space-y-5" aria-label="賽前分析與自選串關">
    <div className="arena-pregame-toolbar flex flex-wrap items-center gap-3">
      <Button variant="outline" onClick={()=>{sources.forEach(s=>void s.refresh());void runs.refresh();}} disabled={sources.some(s=>s.loading)||runs.loading}><RefreshCw className={sources.some(s=>s.loading)||runs.loading?'animate-spin':''}/>更新投打數據</Button>
      {datePicker}
      <span className="text-sm text-white">賽程抓取：{stamp(schedule.data?.fetchedAt)}（台灣）</span>
    </div>
    {schedule.error&&<p role="alert" className="arena-pregame-status text-rose-300">{schedule.error} 暫停串關計算。</p>}
    {schedule.loading&&!schedule.data&&<p role="status" className="arena-pregame-status">正在取得賽程，尚無比分或勝率。</p>}
    <GameContext games={selectedGames} onChange={updateAnalysis} onResults={updateResults}/>
    <Markets analysis={analysis} key={day} games={selectedGames} now={now} data={runs.data} error={runs.error} scheduleOK={scheduleOK} scheduleMessage={schedule.error?'賽程更新失敗，稍後自動重試。':!schedule.data?'正在取得賽程，請稍候…':''} odds={odds.data} oddsError={odds.error} oddsLoading={odds.loading} refreshOdds={odds.refresh} renderMatchHeader={matchHeader} renderWinnerOptions={winnerOptions} winnerPanel={winnerPanel} parlayMode={parlayMode} onParlayModeChange={setParlayMode}/>
  </section>;
}
