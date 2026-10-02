import {readFileSync,writeFileSync} from 'node:fs';
import {moduleUrl} from '../tests/profile-loader.mjs';
const {FootballOpponentXgHistory}=await import(moduleUrl('lib/football-opponent-xg.ts'));
const {FootballElo,externalFootballFeatures}=await import(moduleUrl('lib/football-xg-features.ts'));
const {externalFootballRates}=await import(moduleUrl('lib/football-external-model.ts'));
const {footballDistribution}=await import(moduleUrl('lib/football.ts'));
const {fitNationalFootball,nationalExpectedGoals}=await import(moduleUrl('lib/football-national-model.ts'));
const read=p=>JSON.parse(readFileSync(p));
const source=read('upgrade-v6/joined-cups.json'),espn=read('upgrade-v6/espn-games.json').games,archive=read('data/football/external-history-20260927.json'),mapping=read('data/football/external-team-map.json').teams,ex=read('data/football/external-calibration-runtime.json');
const id=(id,league)=>league==='uefa.champions'?(mapping[id]?.openfootball||'espn:'+id):id;
const convert=g=>({id:'espn:'+g.id,league:g.league,start:g.start,homeId:id(g.home.id,g.league),awayId:id(g.away.id,g.league),homeGoals:g.homeScore,awayGoals:g.awayScore,homeXg:null,awayXg:null,neutral:g.neutral});
const eligible=g=>g.state==='final'&&g.statusName==='STATUS_FULL_TIME'&&g.homeScore!==null&&g.awayScore!==null;
// Date-only legacy archive entries can be replaced only when both teams and
// scores agree. An identity/score conflict excludes the fixture from both arms.
function merge(base,live){
 const groups=new Map();
 for(const g of [...base,...live]){const key=[g.league,g.start.slice(0,10),g.homeId,g.awayId].join('|');const old=groups.get(key);if(old===null)continue;if(old&&(old.homeGoals!==g.homeGoals||old.awayGoals!==g.awayGoals)){groups.set(key,null);continue;}groups.set(key,{...g,homeXg:g.homeXg??old?.homeXg??null,awayXg:g.awayXg??old?.awayXg??null});}
 return [...groups.values()].filter(Boolean).sort((a,b)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id));
}
for(const league of process.argv.slice(2)){
 const national=league==='uefa.nations';
 const oldHistory=national?espn.filter(g=>g.league!=='uefa.champions'&&eligible(g)):merge(archive.games.filter(r=>r[1]===league).map(r=>({id:r[0],league:r[1],start:r[2],homeId:r[3],awayId:r[4],homeGoals:r[5],awayGoals:r[6],homeXg:null,awayXg:null,neutral:!!r[9]})),espn.filter(g=>g.league===league&&eligible(g)).map(convert));
 const poolLeagues=national?new Set(['uefa.nations','uefa.euro','fifa.world','uefa.euroq','fifa.worldq.uefa']):new Set([league]);
 const newHistory=merge(espn.filter(g=>poolLeagues.has(g.league)&&eligible(g)).map(convert),source.games.filter(g=>poolLeagues.has(g.league)));
 const targetIds=new Set(source.games.filter(g=>g.league===league).map(g=>g.id));
 const states=[90,180].map(decayDays=>new FootballOpponentXgHistory({decayDays,lookbackDays:national?730:365}));
 const rows=[],processed=[],elo=new FootballElo(),days=Map.groupBy(newHistory,g=>g.start.slice(0,10));
 for(const [day,pending] of days){
  const before=Date.parse(day+'T00:00:00Z'),targets=pending.filter(g=>g.league===league&&targetIds.has(g.id));
  let fit;if(national&&targets.length)fit=fitNationalFootball(oldHistory,before);
  const historic=national?[]:oldHistory.filter(g=>Date.parse(g.start)<before);if(!national){for(const g of historic.slice(processed.length)){elo.update(g);processed.push(g);}}
  for(const game of targets){
   const features=states.map(s=>s.features(game.homeId,game.awayId,before));if(features.some(f=>!f.enough))continue;
   let rates;
   if(national){
    const g=espn.find(g=>'espn:'+g.id===game.id);if(!g||!fit)continue;
    const r=nationalExpectedGoals(g,fit,before);if(!r)continue;rates={...r,rho:0};
   }else{
    const p=ex.leagues[league].parameters,diff=elo.difference(game),g={...game,neutral:espn.find(g=>'espn:'+g.id===game.id)?.neutral??game.neutral};
    const f=externalFootballFeatures(g,historic,diff,p,before),base=externalFootballFeatures(g,historic,diff,{decayDays:90,venueWeight:.6},before);if(!f.enough)continue;
    rates=externalFootballRates(f.values,base.values,p);
   }
   rows.push({id:game.id,start:game.start,neutral:game.neutral,goals:[game.homeGoals,game.awayGoals],features:features.map(f=>f.values),old:{rates,probabilities:footballDistribution(rates.home,rates.away,rates.rho).probabilities}});
  }
  for(const state of states)state.addDay(pending);
 }
 writeFileSync('upgrade-v6/'+league+'-features.json',JSON.stringify(rows));console.log(league,rows.length);
}
