'use client';
import {useId} from 'react';
import {createPortal} from 'react-dom';
import {nbaPhase,type NbaGame} from '@/lib/nba';
import {nbaSourceStale,readyNbaAnalysis,type NbaReport} from '@/lib/nba-analysis';
import {useSuperWorkspace} from './super-workspace';
import {NbaAnalysisNumbers,NbaMatch,nbaTime} from './nba-match';
export default function NbaRecommendations({games,reports,day,now,fetchedAt,unavailable,loading,league='NBA'}:{league?:'NBA'|'WNBA';games:NbaGame[];reports:Record<string,NbaReport>;day:string;now:number;fetchedAt?:string;unavailable:boolean;loading:boolean}){
 const id=useId(),workspace=useSuperWorkspace(),docked=workspace?.activePane===id&&!!workspace.host,clock=Math.max(now,Date.now());
 const rows=games.flatMap(game=>{const analysis=readyNbaAnalysis(game,reports[game.id],clock,unavailable||nbaSourceStale(fetchedAt,clock));return analysis?[{game,analysis}]:[];});
 return <><span data-super-parlay={id} hidden/>{docked&&createPortal(<section className="nba-recommendations" aria-label={`${league} 推薦內容`}><div className="nba-pane-context"><strong>{league}</strong><span>{day}・{rows.length} 場</span></div>{rows.length?rows.map(({game,analysis})=><article className="nba-card" key={game.id}><header><span>{nbaPhase(game.phase)}</span><time dateTime={game.start}>{nbaTime(game.start)}</time></header><NbaMatch game={game}/><NbaAnalysisNumbers game={game} analysis={analysis}/></article>):<p className="nba-empty" role="status">{loading?`正在整理 ${league} 推薦…`:'目前沒有可用的賽前推薦'}</p>}</section>,workspace!.host!)}</>;
}
