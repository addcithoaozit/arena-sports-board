import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {moduleUrl} from './profile-loader.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const {marketFootballRates,marketFootballDistribution,marketFootballFeatures,parseMarketFootballEvents,reconcileMarketHistory}=await import(moduleUrl('lib/football-market-core.ts'));
const {footballMarketRuntime:runtime,selectFootballMarketModel}=await import(moduleUrl('lib/football-market-model.ts'));
const {applyFootballMarketAnalysis,loadFootballMarketContext}=await import(moduleUrl('lib/football-market-source.ts'));
const now=Date.parse(runtime.createdAt)+86400000;
const game={id:'99123',league:'ger.1',season:2026,start:new Date(now+86400000).toISOString(),home:{id:'132',name:'Home'},away:{id:'133',name:'Away'},state:'scheduled',statusName:'STATUS_SCHEDULED',timeConfirmed:true,neutral:false};
const rows=Array.from({length:220},(_,i)=>({...game,id:String(50000+i),start:new Date(now-(i+2)*86400000).toISOString(),home:i%11===0?game.home:{id:String(700+i%6),name:'H'},away:i%11===0?game.away:{id:String(800+i%6),name:'A'},homeScore:i%4,awayScore:i%3,state:'final',statusName:'STATUS_FULL_TIME'}));
const context={history:[...rows].reverse(),fetchedAt:new Date(now).toISOString(),fixtures:new Map([[game.id,game]]),conflicts:0};
const base={status:'waiting',reason:'不足',version:'old',capturedAt:new Date(now).toISOString(),notes:[]};
test('production market equations agree with independent scipy score-grid reference',()=>{
 for(const f of read('tests/fixtures/football-market-parity.json')){
  const rates=marketFootballRates(f.input,f.baseline,f.parameters);for(const k of Object.keys(f.rates))assert.ok(Math.abs(rates[k]-f.rates[k])<1e-10,k);
  const a=marketFootballDistribution(rates);for(const k of Object.keys(f.probabilities))assert.ok(Math.abs(a.probabilities[k]-f.probabilities[k])<1e-8,f.league+k);
  for(const k of ['home','away'])assert.ok(Math.abs(a.expected[k]-f.expected[k])<1e-9,k);
 }
});
test('new DE/IT model passes every frozen gate and exact study hashes identify selection before audit',()=>{
 for(const path of ['docs/football-market-protocol.json','data/football/market-selection-20260928.json']){const hash=createHash('sha256').update(readFileSync(path)).digest('hex');assert.equal(hash,path.includes('protocol')?runtime.protocolSha256:runtime.selectionSha256);}
 const selection=read('data/football/market-selection-20260928.json');assert.ok(Date.parse(selection.createdAt)<Date.parse(runtime.createdAt));
 for(const league of ['ger.1','ita.1']){const e=runtime.leagues[league];assert.equal(e.enabled,true);for(const [split,min] of [['training',180],['selection',80],['holdout',160],['audit2019',60],['audit2025',60],['audit2026',60]])assert.ok(e.sampleSizes[split]>=min);assert.deepEqual(e.parameters,selection.leagues[league].winner.parameters);assert.equal(selection.leagues[league].candidates.length,96);
  for(const split of ['selection','holdout','audit2019','audit2025','audit2026']){const m=e.metrics[split];assert.ok(m.candidate.logLoss<m.baseline.logLoss);assert.ok(m.candidate.brier<=m.baseline.brier);for(const metric of ['over25Brier','bttsBrier'])assert.ok(m.candidate[metric]-m.baseline[metric]<=.002);}
  assert.ok(selectFootballMarketModel(league,now));assert.equal(selectFootballMarketModel(league,Date.parse(runtime.createdAt)-1),null);assert.equal(selectFootballMarketModel(league,Date.parse(runtime.expiresAt)),null);
 }
 assert.equal(selectFootballMarketModel('eng.1',now),null);
});
test('league-rate and team-form features exclude target-day, future and wrong-league results',()=>{
 const p=selectFootballMarketModel('ger.1',now),g={...game,start:new Date(now).toISOString()},a=marketFootballFeatures(g,rows,0,p);
 const poison=[{...rows[0],id:'p1',start:new Date(new Date(now).setUTCHours(0,1)).toISOString(),homeScore:30},{...rows[0],id:'p2',start:game.start},{...rows[0],id:'p3',league:'ita.1'}];
 assert.equal(a.enough,true);assert.equal(a.leagueGames,220);assert.deepEqual(marketFootballFeatures(g,[...rows,...poison],0,p),a);
 assert.equal(marketFootballFeatures(g,rows.slice(0,100),0,p).enough,false);
});
test('tilted score distribution is normalized and symmetric for neutral equal-strength inputs',()=>{
 for(const home of [.15,1.5,5])for(const away of [.15,1.5,5])for(const tilt of [-.75,0,.75]){const a=marketFootballDistribution({home,away,rho:.2,overTilt:tilt,bttsTilt:-tilt,drawTilt:tilt}),p=a.probabilities;assert.ok(Object.values(p).every(n=>n>=0&&n<=1));assert.ok(Math.abs(p.home+p.draw+p.away-1)<1e-10);assert.ok(Math.abs(p.over25+p.under25-1)<1e-10);assert.ok(a.scores.every(s=>s.probability>0));}
 const p=selectFootballMarketModel('ita.1',now),r=marketFootballRates([0,0,0,0,0,1,1.8,1.2],[1.5,1.5],p);assert.equal(r.home,r.away);const d=marketFootballDistribution(r);assert.ok(Math.abs(d.probabilities.home-d.probabilities.away)<1e-12);assert.throws(()=>marketFootballDistribution({...r,home:NaN}));
});
test('archive excludes ambiguous duplicate fixtures and cross-provider discrepancies',()=>{
 const a=read('data/football/market-history-20260928.json');assert.equal(a.games.length,15508);assert.equal(a.sha256,createHash('sha256').update(JSON.stringify(a.games)).digest('hex'));assert.equal(runtime.sourceSha256,a.sha256);
 for(const r of a.games)assert.ok(!a.excludedKeys.includes([r[1],r[8],r[3],r[4]].join('|')));
 const one=rows[0],result=reconcileMarketHistory([one,{...one,id:'new-id',homeScore:4}]);assert.equal(result.games.length,0);assert.equal(reconcileMarketHistory([one],result.excluded).games.length,0);
});
test('regular-league parser rejects wrong identity, truncated feed, playoff and extra-time history',()=>{
 const event=(id,slug,status='STATUS_FULL_TIME')=>({id,date:rows[0].start,season:{year:2026,slug},competitions:[{date:rows[0].start,timeValid:true,status:{type:{name:status,state:'post',completed:true}},competitors:[{homeAway:'home',team:{id:'132'},score:'2'},{homeAway:'away',team:{id:'133'},score:'1'}]}]});
 const d={leagues:[{slug:'ger.1'}],events:[event('11','regular-season'),event('12','playoffs'),event('13','regular-season','STATUS_FINAL_AET')]};
 const parsed=parseMarketFootballEvents(d,'ger.1');assert.equal(parsed.length,2);assert.equal(reconcileMarketHistory(parsed).games.length,1);assert.throws(()=>parseMarketFootballEvents(d,'ita.1'));assert.throws(()=>parseMarketFootballEvents({...d,events:Array(1000).fill(d.events[0])},'ger.1'));
});
test('runtime requires exact current fixture identity, freshness and sufficient own-league history',()=>{
 const a=applyFootballMarketAnalysis(game,base,context,now);assert.equal(a.status,'ready');assert.equal(a.version,runtime.version);assert.equal(a.external.modelApplied,true);assert.equal(a.external.modelFamily,'score-market');assert.equal(a.external.leagueGames,220);assert.equal(a.homeForm.supplementGames,0);
 for(const c of [{...context,fetchedAt:'invalid'},{...context,fetchedAt:new Date(now-36*60000).toISOString()},{...context,fixtures:new Map()},{...context,fixtures:new Map([[game.id,{...game,home:{id:'wrong'}}]])}])assert.deepEqual(applyFootballMarketAnalysis(game,base,c,now),base);
 const sparse=applyFootballMarketAnalysis(game,base,{...context,history:rows.slice(0,4)},now);assert.equal(sparse.status,'waiting');assert.equal(sparse.external.modelApplied,false);assert.equal(sparse.probabilities,undefined);
 assert.deepEqual(applyFootballMarketAnalysis({...game,state:'live'},base,context,now),base);
});
test('annual history source failure cannot activate the model using stale archive alone',async()=>{
 const real=globalThis.fetch;globalThis.fetch=async()=>new Response('down',{status:503});
 try{await assert.rejects(loadFootballMarketContext('ita.1'),/無法更新/);}finally{globalThis.fetch=real;}
});
