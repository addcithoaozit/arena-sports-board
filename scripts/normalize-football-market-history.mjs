import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {moduleUrl} from '../tests/profile-loader.mjs';
const {parseMarketFootballEvents,reconcileMarketHistory,marketFixtureKey}=await import(moduleUrl('lib/football-market-core.ts'));
const manifest=JSON.parse(readFileSync('.football-research/market-sources.json','utf8')),cutoff=Date.parse(manifest.cutoff),all=[],teams={},excluded=[],crosscheck={matched:0,conflicts:0};
const old=JSON.parse(readFileSync('data/football/external-history-20260927.json','utf8')),ids=JSON.parse(readFileSync('data/football/external-team-map.json','utf8')).teams;
const peers=new Map();for(const r of old.games){const key=[r[1],r[3],r[4]].join('|');if(!peers.has(key))peers.set(key,[]);peers.get(key).push(r);}
for(const src of manifest.sources){const raw=readFileSync(src.path);if(createHash('sha256').update(raw).digest('hex')!==src.sha256)throw Error('source changed');for(const g of parseMarketFootballEvents(JSON.parse(raw),src.league)){
 if(g.state!=='final'||g.statusName!=='STATUS_FULL_TIME'||g.homeScore===null||g.awayScore===null||Date.parse(g.start)>=cutoff)continue;
 teams[g.home.id]=g.home.englishName;teams[g.away.id]=g.away.englishName;all.push(g);
 const matches=(peers.get([g.league,ids[g.home.id]?.understat,ids[g.away.id]?.understat].join('|'))||[]).filter(r=>Math.abs(Date.parse(r[2])-Date.parse(g.start))<86400000);
 if(matches.length===1){if(matches[0][5]!==g.homeScore||matches[0][6]!==g.awayScore){excluded.push(marketFixtureKey(g));crosscheck.conflicts++;}else crosscheck.matched++;}
 // Prior unresolved awarded/on-field discrepancy remains excluded.
 if(g.league==='ger.1'&&g.start.startsWith('2024-12-14')&&ids[g.home.id]?.understat==='us:240'&&ids[g.away.id]?.understat==='us:268')excluded.push(marketFixtureKey(g));
}}
const clean=reconcileMarketHistory(all,excluded),games=clean.games.map(g=>[g.id,g.league,g.start,g.home.id,g.away.id,g.homeScore,g.awayScore,g.neutral,g.season]);
const coverage={};for(const g of clean.games){const k=g.league+':'+g.start.slice(0,4);coverage[k]=(coverage[k]||0)+1;}
const artifact={schema:1,cutoff:manifest.cutoff,columns:['id','league','start','homeId','awayId','homeGoals','awayGoals','neutral','season'],sources:manifest.sources.map(({path,...r})=>r),teams,games,coverage,excludedKeys:clean.excluded,crosscheck};artifact.sha256=createHash('sha256').update(JSON.stringify(games)).digest('hex');
writeFileSync('data/football/market-history-20260928.json',JSON.stringify(artifact)+'\n');console.log(JSON.stringify({games:games.length,excludedKeys:clean.excluded.length,crosscheck,coverage},null,2));
