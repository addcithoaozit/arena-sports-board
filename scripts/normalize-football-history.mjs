import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {moduleUrl} from '../tests/profile-loader.mjs';
const {parseFootballEvents}=await import(moduleUrl('lib/football.ts'));
const sources=JSON.parse(readFileSync('.football-research/sources.json','utf8'));
const games=new Map(),teams={},counts={},rejected={future:0,notRegulationFinal:0,missingScore:0,duplicate:0,conflict:0};
const cutoff=Date.parse('2026-09-27T12:35:04Z');
for(const source of sources){
 const raw=JSON.parse(readFileSync(source.path,'utf8'));
 for(const g of parseFootballEvents(raw,source.league)){
  if(Date.parse(g.start)>=cutoff){rejected.future++;continue;}
  if(g.state!=='final'||g.statusName!=='STATUS_FULL_TIME'){rejected.notRegulationFinal++;continue;}
  if(g.homeScore===null||g.awayScore===null){rejected.missingScore++;continue;}
  const row=[g.id,g.league,g.season,g.start,g.home.id,g.away.id,g.homeScore,g.awayScore,g.neutral?1:0];
  const key=g.league+':'+g.id;
  if(games.has(key)){
   if(JSON.stringify(games.get(key))!==JSON.stringify(row)){rejected.conflict++;throw Error('Conflicting result '+key);}
   rejected.duplicate++;continue;
  }
  games.set(key,row);teams[g.home.id]=g.home.englishName;teams[g.away.id]=g.away.englishName;
 }
}
const rows=[...games.values()].sort((a,b)=>a[3].localeCompare(b[3])||a[0].localeCompare(b[0]));
for(const g of rows){const key=g[1]+':'+g[3].slice(0,4);counts[key]=(counts[key]||0)+1;}
const payload={schema:1,cutoff:new Date(cutoff).toISOString(),fields:['id','league','season','start','homeId','awayId','homeGoals','awayGoals','neutral'],sources:sources.map(({path,...s})=>s),teams,counts,rejected,sha256:createHash('sha256').update(JSON.stringify(rows)).digest('hex'),games:rows};
mkdirSync('data/football',{recursive:true});writeFileSync('data/football/history-20260927.json',JSON.stringify(payload));
console.log(JSON.stringify({games:rows.length,counts,rejected,sha256:payload.sha256},null,2));
