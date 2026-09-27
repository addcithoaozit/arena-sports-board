// One chronological pass using the same feature functions as the runtime.
// Finish a calendar day before updating Elo/history; never use target-day data.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {moduleUrl} from '../tests/profile-loader.mjs';
mkdirSync('.football-research',{recursive:true});
const {externalFootballFeatures,FootballElo}=await import(moduleUrl('lib/football-xg-features.ts'));
const {calibratedFootballGoals,footballCalibrationRuntime}=await import(moduleUrl('lib/football-calibration.ts'));
const data=JSON.parse(readFileSync('data/football/external-history-20260927.json','utf8'));
const options=[90,180].flatMap(decayDays=>[0,.6].map(venueWeight=>({decayDays,venueWeight})));
const games=data.games.map(r=>({id:r[0],league:r[1],start:r[2],homeId:r[3],awayId:r[4],homeGoals:r[5],awayGoals:r[6],homeXg:r[7],awayXg:r[8],neutral:r[9]}));
const byTeam=new Map(),elo=new FootballElo(),rows=[],coverage={};
for(let i=0;i<games.length;){
 const day=games[i].start.slice(0,10),daily=[];while(i<games.length&&games[i].start.slice(0,10)===day)daily.push(games[i++]);
 for(const g of daily){
  const history=[...(byTeam.get(g.league+'|'+g.homeId)||[]),...(byTeam.get(g.league+'|'+g.awayId)||[])];
  const diff=elo.difference(g),variants=options.map(p=>externalFootballFeatures(g,history,diff,p)),base=variants[1];
  const enough=base.enough&&(g.league==='uefa.champions'||base.xgEnough),key=g.league+':'+day.slice(0,4);coverage[key]??={total:0,eligible:0};coverage[key].total++;
  if(enough){
   coverage[key].eligible++;
   const entry=footballCalibrationRuntime.leagues[g.league];let deployed=null;
   // Old fitted coefficients saw 2022/23. Compare them only in the recent audits,
   // never in the new 2019/20 holdout which predates their training data.
   if(entry?.enabled&&day>='2025-01-01'){
    const f=externalFootballFeatures(g,history,diff,entry.parameters),rates=calibratedFootballGoals(f.home,f.away,entry.parameters,g.neutral);
    deployed=[rates.home,rates.away,entry.parameters.rho];
   }
   rows.push({id:g.id,league:g.league,start:g.start,homeScore:g.homeGoals,awayScore:g.awayGoals,variants:variants.map(v=>v.values),deployed});
  }
 }
 for(const g of daily){elo.update(g);for(const id of [g.homeId,g.awayId]){const key=g.league+'|'+id;byTeam.set(key,[...(byTeam.get(key)||[]).filter(r=>Date.parse(r.start)>=Date.parse(g.start)-370*86400000),g]);}}
}
writeFileSync('.football-research/external-features.json',JSON.stringify({sourceSha256:data.sha256,options,coverage,rows}));
console.log(JSON.stringify({rows:rows.length,coverage},null,2));
