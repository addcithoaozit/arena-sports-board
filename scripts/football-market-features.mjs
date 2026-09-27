import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {moduleUrl} from '../tests/profile-loader.mjs';
const {marketFootballFeatures}=await import(moduleUrl('lib/football-market-core.ts'));
const {FootballElo}=await import(moduleUrl('lib/football-xg-features.ts'));
const source=JSON.parse(readFileSync('data/football/market-history-20260928.json','utf8'));
const games=source.games.map(r=>({id:r[0],league:r[1],start:r[2],home:{id:r[3]},away:{id:r[4]},homeScore:r[5],awayScore:r[6],neutral:r[7],season:r[8],state:'final',statusName:'STATUS_FULL_TIME'}));
const options=[90,180].flatMap(decayDays=>[0,.6].map(venueWeight=>({decayDays,venueWeight}))),history=new Map(),elo=new FootballElo(),rows=[],coverage={};
for(let i=0;i<games.length;){const daily=[],day=games[i].start.slice(0,10);while(i<games.length&&games[i].start.slice(0,10)===day)daily.push(games[i++]);for(const g of daily){
 const e={...g,homeId:g.home.id,awayId:g.away.id,homeGoals:g.homeScore,awayGoals:g.awayScore,homeXg:null,awayXg:null};
 const variants=options.map(p=>marketFootballFeatures(g,history.get(g.league)||[],elo.difference(e),p)),k=g.league+':'+g.start.slice(0,4);coverage[k]??={total:0,eligible:0};coverage[k].total++;
 if(variants[1].enough){coverage[k].eligible++;rows.push({id:g.id,league:g.league,start:g.start,homeScore:g.homeScore,awayScore:g.awayScore,variants:variants.map(v=>v.values),baseline:variants[1].baseline});}
 }for(const g of daily){elo.update({...g,homeId:g.home.id,awayId:g.away.id,homeGoals:g.homeScore,awayGoals:g.awayScore,homeXg:null,awayXg:null});history.set(g.league,[...(history.get(g.league)||[]).filter(r=>Date.parse(r.start)>=Date.parse(g.start)-370*86400000),g]);}}
mkdirSync('.football-research',{recursive:true});writeFileSync('.football-research/market-features.json',JSON.stringify({sourceSha256:source.sha256,options,rows,coverage}));console.log(JSON.stringify({rows:rows.length,coverage},null,2));
