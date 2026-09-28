'use client';

import {useId} from 'react';
import {createPortal} from 'react-dom';
import type {FootballGame,FootballLeague} from '@/lib/football';
import {footballRecommendations,footballSourceStale,type FootballReport,type ReadyFootballAnalysis} from '@/lib/football-recommendations';
import {useSuperWorkspace} from './super-workspace';

const percent=(n:number)=>(n*100).toFixed(1)+'%';
const time=(value:string)=>new Date(value).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});

// Render the exact same numbers in the match card and the floating recommendation.
export function FootballAnalysisNumbers({analysis}:{analysis:ReadyFootballAnalysis}){
  const p=analysis.probabilities;
  return <>
    <div className="football-probabilities">{[['主勝',p.home],['和局',p.draw],['客勝',p.away]].map(([label,value])=><div key={String(label)}><span>{label}</span><strong>{percent(Number(value))}</strong></div>)}</div>
    <div className="football-probability-bar" aria-hidden="true"><span style={{width:p.home*100+'%'}}/><span style={{width:p.draw*100+'%'}}/><span style={{width:p.away*100+'%'}}/></div>
    <div className="football-goals"><div><span>大 2.5 球</span><b>{percent(p.over25)}</b></div><div><span>小 2.5 球</span><b>{percent(p.under25)}</b></div><div><span>雙方都進球</span><b>{percent(p.btts)}</b></div></div>
    <div className="football-scores"><span>三組比分預測<small>主：客</small></span>{analysis.scores?.map(s=><div key={`${s.home}:${s.away}`}><b>{s.home} : {s.away}</b><small>{percent(s.probability)}</small></div>)}</div>
  </>;
}

type Props={games:FootballGame[];reports:Record<string,FootballReport>;league:FootballLeague;leagueName:string;day:string;now:number;sourceFetchedAt?:string;unavailable:boolean;loading:boolean};
export default function FootballRecommendationsPane(props:Props){
  const id=useId(),workspace=useSuperWorkspace();
  const docked=workspace?.activePane===id&&!!workspace.host;
  const clock=Math.max(props.now,Date.now());
  const unavailable=props.unavailable||(props.sourceFetchedAt?footballSourceStale(props.sourceFetchedAt,clock):!props.loading);
  const rows=docked?footballRecommendations({...props,now:clock,unavailable}):[];
  const pending=props.loading||props.games.some(game=>game.state==='scheduled'&&game.timeConfirmed&&Date.parse(game.start)>Date.now()&&!props.reports[game.id]);
  return <>
    <span data-super-parlay={id} hidden/>
    {docked&&createPortal(<section className="football-recommendations" aria-label="足球推薦內容">
      <div className="football-recommendations-context"><strong>{props.leagueName}</strong><span>{props.day}・{rows.length} 場</span></div>
      {rows.length?rows.map(row=><article className="football-recommendation-card" key={row.game.id}>
        <header><time dateTime={row.game.start}>{time(row.game.start)}</time><span>90 分鐘</span></header>
        <div className="football-recommendation-match"><div><small>主隊</small><strong>{row.game.home.name}</strong></div><b>VS</b><div><small>客隊</small><strong>{row.game.away.name}</strong></div></div>
        <dl className="football-recommendation-directions">{[['勝負推薦',row.result],['大小球推薦',row.total],['雙方進球',row.btts]].map(([label,pick])=>typeof pick==='object'&&pick&&<div key={String(label)}><dt>{String(label)}</dt><dd><strong>{pick.label}</strong><b>{percent(pick.probability)}</b></dd></div>)}</dl>
        <FootballAnalysisNumbers analysis={row.analysis}/>
      </article>):<p className="football-recommendations-empty" role="status">{unavailable?'推薦資料暫時無法取得':pending?'正在整理足球推薦…':'目前沒有可用的賽前推薦'}</p>}
    </section>,workspace!.host!)}
  </>;
}
