import {footballDay,type FootballAnalysis,type FootballGame,type FootballLeague} from './football';

export type FootballReport={game?:FootballGame;analysis?:FootballAnalysis;error?:string;sourceFetchedAt?:string;archiveAsOf?:string;snapshotSaved?:boolean};
export type ReadyFootballAnalysis=FootballAnalysis&{probabilities:NonNullable<FootballAnalysis['probabilities']>};
export type FootballDirection={label:string;probability:number};
export type FootballRecommendation={game:FootballGame;analysis:ReadyFootballAnalysis;result:FootballDirection|null;total:FootballDirection|null;btts:FootballDirection|null};
export const footballFixtureKey=(g?:FootballGame)=>g&&[g.league,g.id,g.season,g.start,g.home.id,g.away.id,g.neutral,g.timeConfirmed].join('|');
export function footballSourceStale(fetchedAt:string,now:number){const captured=Date.parse(fetchedAt);return !Number.isFinite(captured)||!Number.isFinite(now)||now-captured>=120000||captured-now>60000;}

// The match card and floating sheet share the same eligibility gate and snapshot.
export function readyFootballAnalysis(game:FootballGame,report:FootballReport|undefined,now:number,unavailable=false):ReadyFootballAnalysis|null{
  const analysis=report?.analysis,p=analysis?.probabilities,captured=Date.parse(analysis?.capturedAt||''),start=Date.parse(game.start);
  if(unavailable||report?.error||!Number.isFinite(now)||!Number.isFinite(start)||game.state!=='scheduled'||!game.timeConfirmed||start<=now||report?.game?.state!=='scheduled'||footballFixtureKey(report?.game)!==footballFixtureKey(game)||analysis?.status!=='ready'||!p)return null;
  if(!Number.isFinite(captured)||now-captured>=15*60000||captured-now>60000)return null;
  if([p.home,p.draw,p.away,p.over25,p.under25,p.btts].some(n=>!Number.isFinite(n)||n<0||n>1)||Math.abs(p.home+p.draw+p.away-1)>1e-6||Math.abs(p.over25+p.under25-1)>1e-6)return null;
  return analysis as ReadyFootballAnalysis;
}
function strongest(options:FootballDirection[]):FootballDirection|null{
  const sorted=[...options].sort((a,b)=>b.probability-a.probability);
  return Math.abs(sorted[0].probability-sorted[1].probability)<=1e-9?null:sorted[0];
}
export function footballRecommendations({games,reports,league,day,now,unavailable=false}:{games:FootballGame[];reports:Record<string,FootballReport>;league:FootballLeague;day:string;now:number;unavailable?:boolean}):FootballRecommendation[]{
  return games.flatMap(game=>{
    if(game.league!==league||!Number.isFinite(Date.parse(game.start))||footballDay(game.start)!==day)return [];
    const analysis=readyFootballAnalysis(game,reports[game.id],now,unavailable);
    if(!analysis)return [];
    const p=analysis.probabilities;
    return [{game,analysis,
      result:strongest([{label:'主勝',probability:p.home},{label:'和局',probability:p.draw},{label:'客勝',probability:p.away}]),
      total:strongest([{label:'大 2.5 球',probability:p.over25},{label:'小 2.5 球',probability:p.under25}]),
      btts:strongest([{label:'是',probability:p.btts},{label:'否',probability:1-p.btts}]),
    }];
  });
}
