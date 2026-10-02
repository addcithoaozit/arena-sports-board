import {readFileSync,writeFileSync} from 'node:fs';import {moduleUrl} from '../../tests/profile-loader.mjs';
const {externalFootballFeatures,externalAsGame,FootballElo}=await import(moduleUrl('lib/football-xg-features.ts'));
const {calibratedFootballGoals}=await import(moduleUrl('lib/football-calibration.ts'));
const {externalFootballRates}=await import(moduleUrl('lib/football-external-model.ts'));
const {marketFootballFeatures,marketFootballRates,marketFootballDistribution}=await import(moduleUrl('lib/football-market-core.ts'));
const {footballDistribution}=await import(moduleUrl('lib/football.ts'));
const read=p=>JSON.parse(readFileSync(p));
const cal=read('data/football/calibration-runtime.json'),ex=read('data/football/external-calibration-runtime.json'),market=read('data/football/market-calibration-runtime.json');
const archive=read('data/football/external-history-20260927.json');
for(const league of ['eng.1','esp.1','ger.1','ita.1','fra.1']){
 const games=archive.games.filter(r=>r[1]===league).map(r=>({id:r[0],league:r[1],start:r[2],homeId:r[3],awayId:r[4],homeGoals:r[5],awayGoals:r[6],homeXg:r[7],awayXg:r[8],neutral:!!r[9]})).sort((a,b)=>a.start.localeCompare(b.start));
 const history=[],elo=new FootballElo(),rows=[];let lastDay='',pending=[];
 for(const game of games){const day=game.start.slice(0,10);if(day!==lastDay){for(const g of pending){elo.update(g);history.push(g);}pending=[];lastDay=day;}pending.push(game);
  const diff=elo.difference(game),features=[90,180].map(decayDays=>externalFootballFeatures(game,history,diff,{decayDays,venueWeight:0}));
  if(features.some(f=>!f.enough||!f.xgEnough))continue;
  let old;
  if(league==='eng.1'||league==='fra.1'){const p=ex.leagues[league].parameters,f=externalFootballFeatures(game,history,diff,p),b=externalFootballFeatures(game,history,diff,{decayDays:90,venueWeight:.6});const rates=externalFootballRates(f.values,b.values,p);old={rates,probabilities:footballDistribution(rates.home,rates.away,rates.rho).probabilities};}
  else if(league==='esp.1'){const p=cal.leagues[league].parameters,f=externalFootballFeatures(game,history,diff,p),rates={...calibratedFootballGoals(f.home,f.away,p,game.neutral),rho:p.rho};old={rates,probabilities:footballDistribution(rates.home,rates.away,rates.rho).probabilities};}
  else{const p=market.leagues[league].parameters,gh=history.map(externalAsGame),g=externalAsGame(game),f=marketFootballFeatures(g,gh,diff,p),b=marketFootballFeatures(g,gh,diff,{decayDays:90,venueWeight:.6});if(!f.enough)continue;const rates=marketFootballRates(f.values,b.baseline,p);old={rates,probabilities:marketFootballDistribution(rates).probabilities};}
  rows.push({id:game.id,start:game.start,goals:[game.homeGoals,game.awayGoals],features:features.map(f=>f.values),old});
 }
 writeFileSync('scripts/football-xg-strength/'+league+'-features.json',JSON.stringify(rows));console.log(league,rows.length);
}
