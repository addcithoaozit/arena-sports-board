import type {Database} from '../db';
import type {FootballAnalysis,FootballGame} from './football';

export function validFootballForecast(game:FootballGame,analysis:FootballAnalysis,now=Date.now()){
  const captured=Date.parse(analysis.capturedAt),start=Date.parse(game.start),p=analysis.probabilities;
  return game.state==='scheduled'&&game.timeConfirmed&&analysis.status==='ready'&&!!p&&
    Number.isFinite(start)&&Number.isFinite(captured)&&captured<=now+5000&&now-captured<=120000&&now<start-60000&&captured<start-60000&&
    [p.home,p.draw,p.away,p.over25,p.under25,p.btts].every(n=>Number.isFinite(n)&&n>=0&&n<=1)&&Math.abs(p.home+p.draw+p.away-1)<1e-6&&Math.abs(p.over25+p.under25-1)<1e-6;
}
export async function saveFootballForecast(db:Database,game:FootballGame,analysis:FootballAnalysis,now=Date.now()){
  if(!validFootballForecast(game,analysis,now))return false;
  const id=[game.league,game.id,game.start,analysis.version].join('|');
  const payload=JSON.stringify({home:game.home,away:game.away,probabilities:analysis.probabilities,calibration:analysis.calibration?.status});
  // Each version keeps its most recent valid pregame observation. Capture and
  // kickoff checks are server-side; after kickoff there is no rewrite path.
  await db.prepare(`INSERT INTO football_forecasts (id,league,game_id,start_time,captured_at,version,payload) VALUES (?,?,?,?,?,?,?) ON CONFLICT (id) DO UPDATE SET captured_at=excluded.captured_at,payload=excluded.payload WHERE football_forecasts.captured_at<excluded.captured_at`).bind(id,game.league,game.id,game.start,analysis.capturedAt,analysis.version,payload).run();
  return true;
}
export async function saveFootballResults(db:Database,games:FootballGame[],now=Date.now()){
  let count=0;
  for(const g of games){
    if(g.state!=='final'||g.statusName!=='STATUS_FULL_TIME'||!Number.isInteger(g.homeScore)||!Number.isInteger(g.awayScore)||g.homeScore!<0||g.awayScore!<0||!Number.isFinite(Date.parse(g.start))||Date.parse(g.start)>=now)continue;
    await db.prepare(`INSERT INTO football_results (id,league,game_id,start_time,home_goals,away_goals,fetched_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT (id) DO UPDATE SET start_time=excluded.start_time,home_goals=excluded.home_goals,away_goals=excluded.away_goals,fetched_at=excluded.fetched_at`).bind(g.league+'|'+g.id,g.league,g.id,g.start,g.homeScore,g.awayScore,new Date(now).toISOString()).run();count++;
  }
  return count;
}
export function summarizeFootballForecasts(rows:any[]){
  const groups:Record<string,{league:string;version:string;n:number;logLoss:number;brier:number;accuracy:number;over25Brier:number;bttsBrier:number}>={};
  for(const row of rows){
    try{
      if(!Number.isFinite(Date.parse(row.captured_at))||!Number.isFinite(Date.parse(row.start_time))||Date.parse(row.captured_at)>=Date.parse(row.start_time)-60000)continue;
      const p=JSON.parse(row.payload).probabilities,values=[p.home,p.draw,p.away],home=Number(row.home_goals),away=Number(row.away_goals);
      if(values.some(n=>!Number.isFinite(n)||n<0||n>1)||Math.abs(values.reduce((a,b)=>a+b,0)-1)>1e-6||![p.over25,p.btts].every(n=>Number.isFinite(n)&&n>=0&&n<=1)||!Number.isInteger(home)||!Number.isInteger(away)||home<0||away<0)continue;
      const y=home>away?0:home<away?2:1,key=row.league+'|'+row.version;
      const a=groups[key]??={league:row.league,version:row.version,n:0,logLoss:0,brier:0,accuracy:0,over25Brier:0,bttsBrier:0};
      a.n++;a.logLoss-=Math.log(Math.max(values[y],1e-12));a.brier+=values.reduce((sum,n,i)=>sum+(n-Number(i===y))**2,0);a.accuracy+=Number(values.indexOf(Math.max(...values))===y);a.over25Brier+=(p.over25-Number(home+away>2))**2;a.bttsBrier+=(p.btts-Number(home>0&&away>0))**2;
    }catch{/* Invalid snapshots are excluded rather than assigned zero error. */}
  }
  return Object.values(groups).map(g=>({...g,logLoss:g.logLoss/g.n,brier:g.brier/g.n,accuracy:g.accuracy/g.n,over25Brier:g.over25Brier/g.n,bttsBrier:g.bttsBrier/g.n}));
}
export async function footballLiveAudit(db:Database){
  const paired=await db.prepare(`SELECT f.league,f.version,f.start_time,f.captured_at,f.payload,r.home_goals,r.away_goals FROM football_forecasts f JOIN football_results r ON f.league=r.league AND f.game_id=r.game_id AND f.start_time=r.start_time ORDER BY f.start_time DESC LIMIT 5000`).all();
  const counts=await db.prepare("SELECT COUNT(*) AS snapshots,COUNT(DISTINCT league || '|' || game_id) AS games FROM football_forecasts").first();
  return {available:true,counts,groups:summarizeFootballForecasts(paired.results),scope:'正式上線後保存的最後一筆賽前快照；只核對實際90分鐘完場，不是實際下注紀錄。',limit:5000};
}
