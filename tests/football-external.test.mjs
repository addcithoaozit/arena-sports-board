import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {moduleUrl} from './profile-loader.mjs';
const {footballDistribution,analyzeFootball}=await import(moduleUrl('lib/football.ts'));
const {externalFootballRates,selectExternalFootballModel,footballExternalRuntime:runtime}=await import(moduleUrl('lib/football-external-model.ts'));
const {externalFootballFeatures,FootballElo}=await import(moduleUrl('lib/football-xg-features.ts'));
const {parseUnderstatGames,mergeExternalFootballHistory,applyExternalFootballAnalysis,loadExternalFootballContext}=await import(moduleUrl('lib/football-external-source.ts'));
const read=p=>JSON.parse(readFileSync(p,'utf8')),ids=read('data/football/external-team-map.json').teams;
const now=Date.parse('2026-09-28T12:00:00Z');
const pair=Object.entries(ids).filter(([,t])=>t.understat).slice(0,2);
const target={id:'991991',league:'eng.1',season:2026,start:'2026-09-30T16:00:00Z',timeConfirmed:true,state:'scheduled',statusName:'STATUS_SCHEDULED',home:{id:pair[0][0],name:pair[0][1].name},away:{id:pair[1][0],name:pair[1][1].name},neutral:false};
const history=Array.from({length:15},(_,i)=>({id:'synthetic:'+i,league:'eng.1',start:new Date(now-(i+2)*86400000).toISOString(),homeId:pair[0][1].understat,awayId:pair[1][1].understat,homeGoals:2,awayGoals:1,homeXg:1.6,awayXg:1.1,neutral:false}));
const context={history,fetchedAt:new Date(now).toISOString(),teams:new Set([history[0].homeId,history[0].awayId]),conflicts:0,sources:['Understat','ESPN']};
const base=analyzeFootball(target,[],now);
test('production external score equations match independent SciPy results',()=>{
 for(const f of read('tests/fixtures/football-external-parity.json')){const rates=externalFootballRates(f.input,f.baselineInput,f.parameters);for(const k of ['home','away','rho'])assert.ok(Math.abs(rates[k]-f.expected[k])<1e-10,f.league+k);const p=footballDistribution(rates.home,rates.away,rates.rho).probabilities;for(const k of Object.keys(f.probabilities))assert.ok(Math.abs(p[k]-f.probabilities[k])<1e-8,f.league+k);}
});
test('only accepted leagues within the fixed validity window can use new parameters',()=>{
 assert.deepEqual(Object.keys(runtime.leagues).filter(k=>selectExternalFootballModel(k,now)),['eng.1','fra.1','uefa.champions']);
 for(const code of Object.keys(runtime.leagues)){assert.equal(selectExternalFootballModel(code,Date.parse(runtime.createdAt)-1),null);assert.equal(selectExternalFootballModel(code,Date.parse(runtime.expiresAt)),null);}
 assert.equal(selectExternalFootballModel('unknown',now),null);
 const hash=createHash('sha256').update(readFileSync('docs/football-external-protocol.json')).digest('hex');assert.equal(hash,runtime.protocolSha256);
 for(const [code,e] of Object.entries(runtime.leagues)){if(!e.enabled)continue;for(const k of ['selection','holdout','audit2025','audit2026']){const m=e.metrics[k];assert.ok(m.candidate.logLoss<m.baseline.logLoss,code+k);assert.ok(m.candidate.brier<=m.baseline.brier);for(const metric of ['over25Brier','bttsBrier'])assert.ok(m.candidate[metric]<=m.baseline[metric]+.002);}}
});
test('rolling features exclude target-day outcomes, future matches and other competitions',()=>{
 const g={...history[0],start:'2026-09-28T20:00:00Z'},elo=new FootballElo();history.forEach(r=>elo.update(r));
 const opts={decayDays:90,venueWeight:.6},a=externalFootballFeatures(g,history,elo.difference(g),opts);
 const poison=[{...g,id:'same-day',start:'2026-09-28T01:00:00Z',homeXg:20,homeGoals:20},{...g,id:'future',start:'2026-09-29T00:00:00Z'},{...history[0],id:'wrong-league',league:'fra.1'}];
 assert.deepEqual(externalFootballFeatures(g,[...history,...poison],elo.difference(g),opts),a);
 assert.equal(a.home.games,15);assert.equal(a.home.xgGames,15);
 assert.equal(externalFootballFeatures(g,history.map(r=>({...r,homeXg:null,awayXg:null})),0,opts).xgEnough,false);
});
test('cross-provider duplicate IDs do not inflate samples and conflicts stay excluded across merge stages',()=>{
 const a=history[0],copy={...a,id:'espn:other',homeXg:null,awayXg:null};
 const same=mergeExternalFootballHistory([a],[copy]);assert.equal(same.games.length,1);assert.equal(same.games[0].homeXg,a.homeXg);
 const bad=mergeExternalFootballHistory([a],[{...copy,homeGoals:9},copy]);assert.equal(bad.games.length,0);assert.equal(bad.conflicts,1);
 const third=mergeExternalFootballHistory(bad.games,[copy],bad.excluded);assert.equal(third.games.length,0);
 const wrongIdentity=mergeExternalFootballHistory([a],[{...a,awayId:'other-team'},copy]);assert.equal(wrongIdentity.games.length,0);
});
test('Understat parser rejects unfinished, malformed, future and missing xG records',()=>{
 const r={id:'123',isResult:true,h:{id:'1'},a:{id:'2'},datetime:'2026-09-26 18:30:00',goals:{h:'2',a:'1'},xG:{h:'1.5',a:'0.8'}};
 const dates=[r,{...r,id:'124',isResult:false},{...r,id:'125',datetime:'2026-09-29 10:00:00'},{...r,id:'126',xG:{h:null,a:'1'}},{...r,id:'127',goals:{h:'',a:'1'}},{...r,id:'128',xG:{h:'NaN',a:'.1'}}];
 assert.equal(parseUnderstatGames({teams:{1:{},2:{}},dates},'eng.1',now).length,1);
 assert.throws(()=>parseUnderstatGames({dates:[]},'eng.1',now));
});
test('fresh verified external history fills sparse teams and activates an accepted model only with xG coverage',()=>{
 const a=applyExternalFootballAnalysis(target,base,[],context,now);assert.equal(a.status,'ready');assert.equal(a.version,runtime.version);assert.equal(a.external.modelApplied,true);assert.equal(a.homeForm.games,15);
 assert.ok(Math.abs(a.probabilities.home+a.probabilities.draw+a.probabilities.away-1)<1e-10);
 const sparse=applyExternalFootballAnalysis(target,base,[],{...context,history:history.map((r,i)=>i<4?r:{...r,homeXg:null,awayXg:null})},now);assert.equal(sparse.status,'ready');assert.equal(sparse.external.modelApplied,false);assert.notEqual(sparse.version,runtime.version);
 for(const c of [{...context,fetchedAt:'invalid'},{...context,fetchedAt:new Date(now-36*60000).toISOString()},{...context,teams:new Set()}])assert.deepEqual(applyExternalFootballAnalysis(target,base,[],c,now),base);
 assert.deepEqual(applyExternalFootballAnalysis({...target,state:'live'},base,[],context,now),base);
 const waiting=applyExternalFootballAnalysis(target,base,[],{...context,history:history.slice(0,4)},now);assert.equal(waiting.status,'waiting');assert.equal(waiting.probabilities,undefined);
 const rejected=applyExternalFootballAnalysis({...target,league:'ger.1'},base,[],{...context,history:history.map(g=>({...g,league:'ger.1'}))},now);assert.notEqual(rejected.version,runtime.version);assert.equal(rejected.external.modelApplied,false);
});
test('failed external source rejects without fabricating current freshness',async()=>{
 const realFetch=globalThis.fetch;globalThis.fetch=async()=>new Response('unavailable',{status:503});
 try{await assert.rejects(loadExternalFootballContext('ita.1',now),/無法更新/);}finally{globalThis.fetch=realFetch;}
});
test('all fixed team identities exist in archive and remain one-to-one',()=>{
 const archive=read('data/football/external-history-20260927.json'),seen=new Set();
 for(const t of Object.values(ids))for(const key of [t.understat,t.openfootball])if(key){assert.ok(archive.teams[key],key);assert.ok(!seen.has(key),key);seen.add(key);}
 assert.equal(archive.games.length,23810);assert.equal(archive.sha256,runtime.sourceSha256);
 const quarantine=read('data/football/external-quarantine.json');for(const q of quarantine.matches)assert.ok(!archive.games.some(g=>g[0]===q.id));
});
test('2020 Champions League restart retains four home grounds and limits neutral labels to Lisbon final eight',()=>{
 const archive=read('data/football/external-history-20260927.json');
 const august=archive.games.filter(g=>g[1]==='uefa.champions'&&g[2]>='2020-08-01'&&g[2]<'2020-09-01');
 assert.equal(august.filter(g=>!g[9]).length,4);assert.equal(august.filter(g=>g[9]).length,7);
 const errata=read('docs/football-external-venue-correction.json');
 for(const id of errata.affectedIds)assert.equal(archive.games.find(g=>g[0]===id)?.[9],false);
 assert.ok(august.filter(g=>g[9]).every(g=>g[2]>='2020-08-12'));
});
