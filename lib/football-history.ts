import type {FootballGame,FootballLeague} from './football';
// Resolve only actual conflicts between the live feeds. Never silently take the
// last record when two current sources disagree on fixture identity or scores.
export function reconcileFootballHistory(live:FootballGame[],archived:FootballGame[],league:FootballLeague){
  const chosen=new Map<string,FootballGame>(),conflicts=new Set<string>();
  const signature=(g:FootballGame)=>JSON.stringify([g.league,g.start,g.home.id,g.away.id,g.homeScore,g.awayScore,g.statusName,g.neutral]);
  for(const g of live){
    if(g.league!==league||conflicts.has(g.id))continue;
    const old=chosen.get(g.id);
    if(old&&signature(old)!==signature(g)){chosen.delete(g.id);conflicts.add(g.id);}else chosen.set(g.id,g);
  }
  let supplemented=0;
  for(const g of archived){if(g.league!==league||chosen.has(g.id)||conflicts.has(g.id))continue;chosen.set(g.id,g);supplemented++;}
  return {games:[...chosen.values()],conflicts:conflicts.size,supplemented};
}
