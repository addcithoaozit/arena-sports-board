import {attachCupXgEvidence} from './football-cup-xg-source';
import {loadNationalFootballPool,canonicalNationalGame,mergeNationalProviderHistory} from './football-national-source';
import {applyNationalFootballModel,NATIONAL_MODEL_VERSION} from './football-national-model';
import {sportsSourceFetch} from './sports-source-access';
import {bbcTeamHistoryPage} from './alternate-schedules';
import {analyzeFootball,isFootballNationalCompetition,type FootballGame} from './football';
const cache=new Map<string,{until:number;games:FootballGame<string>[]} >();
async function teamHistory(team:FootballGame['home'],national:boolean){
 const key=team.id+':'+national,hit=cache.get(key);if(hit&&hit.until>Date.now())return hit.games;
 let games:FootballGame<string>[]=[];
 // Include every month back to the last 20 eligible results, up to one year.
 for(let i=0;i<12;i+=3){
  const months=Array.from({length:3},(_,n)=>{const d=new Date();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()-i-n);return d.toISOString().slice(0,7);});
  const rows=await Promise.all(months.map(m=>bbcTeamHistoryPage(team,m)));games.push(...rows.flatMap(r=>r.games));
  const finals=games.filter(g=>g.state==='final'&&g.statusName==='STATUS_FULL_TIME'&&Date.parse(g.start)<Date.now());if(finals.length>=20)break;
 }
 games=[...new Map(games.map(g=>[g.id,g])).values()];cache.set(key,{until:Date.now()+10*60000,games});return games;
}
export async function bbcFootballAnalysis(game:FootballGame){
 if(game.state!=='scheduled'||Date.parse(game.start)<=Date.now())return {game,analysis:analyzeFootball(game,[]),sourceFetchedAt:new Date().toISOString()};
 // Each team loads three pages at a time; process teams consecutively to respect
 // the Worker connection limit while the visible scoreboard keeps updating.
 const national=isFootballNationalCompetition(game.league),home=await teamHistory(game.home,national),away=await teamHistory(game.away,national);
 const map=new Map<string,FootballGame<string>>();for(const g of [...home,...away]){const old=map.get(g.id);if(old&&(old.homeScore!==g.homeScore||old.awayScore!==g.awayScore))throw Error('近期賽果衝突，暫停分析');map.set(g.id,g);}
 const history=[...map.values()];let analysis=analyzeFootball(game,history,Date.now(),history);
 if(national&&analysis.status==='ready'){
  const pool=await loadNationalFootballPool(Date.now(),sportsSourceFetch),canonical=canonicalNationalGame(game);
  if(pool&&canonical)analysis=applyNationalFootballModel(canonical,analysis,mergeNationalProviderHistory(history,pool));
  else{analysis={...analysis,status:'waiting',version:NATIONAL_MODEL_VERSION,reason:'國家隊對手強度資料尚未完整更新。'};delete analysis.probabilities;delete analysis.expected;delete analysis.scores;delete analysis.lean;}
 }
 analysis.quality={label:'BBC 近期賽果',warnings:['使用已核對的90分鐘賽果；先發、傷停與即時xG未納入。'],historyConflicts:0,archiveSupplementGames:0};
 console.info('alternate-analysis-result',{league:game.league,status:analysis.status,home:analysis.homeForm?.games,away:analysis.awayForm?.games});
 const canonical=national?canonicalNationalGame(game):null;
 return {game,analysis:canonical?attachCupXgEvidence(canonical,analysis):analysis,sourceFetchedAt:new Date().toISOString(),dataSource:'BBC Sport'};
}

