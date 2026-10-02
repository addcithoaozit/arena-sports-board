import {readFileSync,writeFileSync} from 'node:fs';
import {moduleUrl} from '../tests/profile-loader.mjs';
const {FootballOpponentXgHistory}=await import(moduleUrl('lib/football-opponent-xg.ts'));
const {FootballElo,externalAsGame}=await import(moduleUrl('lib/football-xg-features.ts'));
const {marketFootballFeatures,marketFootballRates,marketFootballDistribution}=await import(moduleUrl('lib/football-market-core.ts'));
const read=p=>JSON.parse(readFileSync(p));
const archive=read('data/football/external-history-20260927.json'),runtime=read('data/football/market-calibration-runtime.json'),quarantine=read('data/football/external-quarantine.json');
for(const league of ['ger.1','ita.1']){
 const games=archive.games.filter(r=>r[1]===league).map(r=>({id:r[0],league:r[1],start:r[2],homeId:r[3],awayId:r[4],homeGoals:r[5],awayGoals:r[6],homeXg:r[7],awayXg:r[8],neutral:!!r[9]})).filter(g=>!quarantine.matches.some(q=>q.league===league&&q.homeId===g.homeId&&q.awayId===g.awayId&&Math.abs(Date.parse(q.day)-Date.parse(g.start.slice(0,10)))<=86400000)).sort((a,b)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id));
 const states=[90,180].map(decayDays=>new FootballOpponentXgHistory({decayDays,lookbackDays:365}));
 const p=runtime.leagues[league].parameters,history=[],elo=new FootballElo(),rows=[],days=Map.groupBy(games,g=>g.start.slice(0,10));
 for(const [day,pending] of days){
  const before=Date.parse(day+'T00:00:00Z'),gh=history.map(externalAsGame);
  for(const game of pending){
   const g=externalAsGame(game),diff=elo.difference(game),f=marketFootballFeatures(g,gh,diff,p),b=marketFootballFeatures(g,gh,diff,{decayDays:90,venueWeight:.6}),features=states.map(s=>s.features(game.homeId,game.awayId,before));
   if(!f.enough||features.some(f=>!f.enough))continue;
   const rates=marketFootballRates(f.values,b.baseline,p);
   rows.push({id:game.id,start:game.start,neutral:game.neutral,goals:[game.homeGoals,game.awayGoals],features:features.map(f=>f.values),old:{rates,probabilities:marketFootballDistribution(rates).probabilities}});
  }
  for(const s of states)s.addDay(pending);for(const g of pending){history.push(g);elo.update(g);}
 }
 writeFileSync('upgrade-v6/'+league+'-features.json',JSON.stringify(rows));console.log(league,rows.length);
}
