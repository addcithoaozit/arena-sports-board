// Replays the production feature extractor chronologically. No target result is
// added until after its prediction features are built.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {moduleUrl} from '../tests/profile-loader.mjs';
const {footballForm}=await import(moduleUrl('lib/football.ts'));
const source=JSON.parse(readFileSync('data/football/history-20260927.json','utf8'));
const options=[60,90,180].flatMap(decayDays=>[0,.3,.6].map(venueWeight=>({decayDays,venueWeight})));
const byTeam=new Map(),rows=[],coverage={};
for(const row of source.games){
 const [id,league,season,start,homeId,awayId,homeScore,awayScore,neutral]=row;
 const team=id=>({id,name:source.teams[id],englishName:source.teams[id]});
 const game={id,league,season,start,home:team(homeId),away:team(awayId),homeScore,awayScore,neutral:!!neutral,state:'final',statusName:'STATUS_FULL_TIME',statusLabel:'完場',timeConfirmed:true,venue:'',sourceUrl:''};
 const before=Date.parse(start)-3*3600000,homeHistory=byTeam.get(league+':'+homeId)||[],awayHistory=byTeam.get(league+':'+awayId)||[];
 const variants=options.map(option=>[footballForm(homeId,'home',homeHistory,before,!!neutral,option),footballForm(awayId,'away',awayHistory,before,!!neutral,option)]);
 const [h,a]=variants[0];
 const eligible=h.games>=5&&a.games>=5&&[h,a].every(f=>f.latest&&before-Date.parse(f.latest)<=120*86400000);
 const key=league+':'+start.slice(0,4);coverage[key]??={total:0,eligible:0};coverage[key].total++;if(eligible)coverage[key].eligible++;
 if(eligible&&start>='2022-01-01')rows.push({id,league,start,season,homeId,awayId,homeScore,awayScore,neutral:!!neutral,homeGames:h.games,awayGames:a.games,variants:variants.map(([h,a])=>[h.scored,h.conceded,a.scored,a.conceded])});
 for(const key of [league+':'+homeId,league+':'+awayId]){const list=byTeam.get(key)||[];list.push(game);byTeam.set(key,list.filter(g=>Date.parse(g.start)>=Date.parse(start)-370*86400000));}
}
mkdirSync('.football-research',{recursive:true});writeFileSync('.football-research/features.json',JSON.stringify({sourceSha256:source.sha256,options,coverage,rows}));
console.log(JSON.stringify({rows:rows.length,coverage},null,2));
