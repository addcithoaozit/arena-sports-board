import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {moduleUrl} from './profile-loader.mjs';
const {footballDistribution}=await import(moduleUrl('lib/football.ts'));
const {selectFootballCalibration,calibratedFootballGoals,footballCalibrationRuntime:runtime}=await import(moduleUrl('lib/football-calibration.ts'));
const {reconcileFootballHistory}=await import(moduleUrl('lib/football-history.ts'));
const {validFootballForecast,saveFootballForecast,saveFootballResults,footballLiveAudit,summarizeFootballForecasts}=await import(moduleUrl('lib/football-ledger.ts'));
const now=Date.parse('2026-09-28T00:00:00Z');
const game={id:'1',league:'esp.1',start:'2026-09-29T00:00:00.000Z',state:'scheduled',statusName:'STATUS_SCHEDULED',timeConfirmed:true,home:{id:'1',name:'A'},away:{id:'2',name:'B'}};
const analysis={status:'ready',capturedAt:new Date(now).toISOString(),version:'v2',probabilities:{home:.6,draw:.25,away:.15,over25:.55,under25:.45,btts:.4}};
test('production equations match independent scipy evaluation for all six leagues',()=>{
 const fixtures=JSON.parse(readFileSync('tests/fixtures/football-calibration-parity.json','utf8'));
 for(const f of fixtures){const [hs,hc,as,ac,neutral]=f.input,goals=calibratedFootballGoals({scored:hs,conceded:hc},{scored:as,conceded:ac},f.parameters,!!neutral);for(const k of ['home','away'])assert.ok(Math.abs(goals[k]-f.expected[k])<1e-10,f.league+k);const actual=footballDistribution(goals.home,goals.away,f.parameters.rho).probabilities;for(const k of Object.keys(f.probabilities))assert.ok(Math.abs(actual[k]-f.probabilities[k])<1e-8,f.league+k);}
});
test('only a validated and unexpired league receives fitted coefficients',()=>{
 assert.deepEqual(Object.keys(runtime.leagues).filter(k=>selectFootballCalibration(k,now).parameters),['esp.1']);
 assert.equal(selectFootballCalibration('esp.1',Date.parse(runtime.createdAt)-1).parameters,null);
 assert.equal(selectFootballCalibration('esp.1',Date.parse(runtime.expiresAt)).summary.status,'expired');
 assert.equal(selectFootballCalibration('esp.1',Date.parse(runtime.expiresAt)).parameters,null);
 assert.equal(selectFootballCalibration('unknown',now).parameters,null);
});
test('Dixon-Coles remains nonnegative and normalized at extreme legal inputs',()=>{
 for(const h of [.15,1,5])for(const a of [.15,1,5])for(const rho of [-10,-.1,0,.1,10]){const {probabilities:p,scores}=footballDistribution(h,a,rho);assert.ok(Math.abs(p.home+p.draw+p.away-1)<1e-10);assert.ok(Math.abs(p.over25+p.under25-1)<1e-10);assert.ok(Object.values(p).every(n=>n>=0&&n<=1));assert.ok(scores.every(s=>s.probability>=0));}
 assert.throws(()=>footballDistribution(NaN,1));
});
test('neutral fixtures use a shared intercept and symmetric input yields symmetry',()=>{const p=runtime.leagues['esp.1'].parameters,x={scored:1.2,conceded:1.5},r=calibratedFootballGoals(x,x,p,true);assert.equal(r.home,r.away);});
test('conflicting live scores are quarantined and cannot be reintroduced from archive',()=>{
 const a={...game,state:'final',statusName:'STATUS_FULL_TIME',homeScore:1,awayScore:0},b={...a,homeScore:2};
 const result=reconcileFootballHistory([a,a,b],[a,{...a,id:'2'}],'esp.1');assert.equal(result.conflicts,1);assert.equal(result.supplemented,1);assert.deepEqual(result.games.map(g=>g.id),['2']);
 const corrected=reconcileFootballHistory([b],[a],'esp.1');assert.equal(corrected.games[0].homeScore,2);
});
test('snapshot validity rejects post-kickoff, stale, live and malformed probabilities',()=>{
 assert.equal(validFootballForecast(game,analysis,now),true);
 for(const [g,a,t] of [[game,analysis,Date.parse(game.start)], [{...game,state:'live'},analysis,now], [game,analysis,now+180000], [game,{...analysis,probabilities:{...analysis.probabilities,home:1.2}},now]])assert.equal(validFootballForecast(g,a,t),false);
});
test('Postgres ledger preserves pregame observations and settles only exact regulation fixtures',async()=>{
 const db=new PGlite({parsers:{20:Number}});await db.exec(readFileSync('db/render-schema.sql','utf8')+';SET search_path TO yj_platform_v1,pg_catalog;');
 const adapter={prepare(sql){let values=[];const q=()=>{let i=0;return db.query(sql.replace(/\?/g,()=>'$'+(++i)),values);};const s={bind(...v){values=v;return s;},async run(){return q();},async all(){return {results:(await q()).rows};},async first(){return (await q()).rows[0];}};return s;}};
 try{
  assert.equal(await saveFootballForecast(adapter,game,analysis,now),true);
  const later={...analysis,capturedAt:new Date(now+60000).toISOString()};await saveFootballForecast(adapter,game,later,now+60000);await saveFootballForecast(adapter,game,analysis,now);
  assert.equal((await db.query('SELECT captured_at FROM football_forecasts')).rows[0].captured_at,later.capturedAt);
  assert.equal(await saveFootballForecast(adapter,game,{...analysis,capturedAt:game.start},Date.parse(game.start)),false);
  const final={...game,state:'final',statusName:'STATUS_FULL_TIME',homeScore:2,awayScore:1},end=Date.parse(game.start)+10800000;
  assert.equal(await saveFootballResults(adapter,[{...final,statusName:'STATUS_FINAL_AET'},{...final,homeScore:null}],end),0);
  await saveFootballResults(adapter,[{...final,start:'2026-09-29T01:00:00.000Z'}],end);assert.equal((await footballLiveAudit(adapter)).groups.length,0);
  await saveFootballResults(adapter,[final],end);const audit=await footballLiveAudit(adapter);assert.equal(audit.counts.snapshots,1);assert.equal(audit.groups[0].n,1);assert.ok(Math.abs(audit.groups[0].logLoss+Math.log(.6))<1e-12);assert.equal(audit.groups[0].accuracy,1);
 }finally{await db.close();}
});
test('corrupt snapshots do not enter aggregate denominators',()=>{assert.deepEqual(summarizeFootballForecasts([{start_time:game.start,captured_at:'invalid',payload:JSON.stringify(analysis),home_goals:2,away_goals:1}]),[]);});
test('missing historical feeds are visible while missing current-season feeds pause prediction',async()=>{
 const {footballGameAnalysis}=await import(moduleUrl('lib/football-source.ts'));
 const {footballDay}=await import(moduleUrl('lib/football.ts'));
 const realFetch=globalThis.fetch,t=Date.now(),start=new Date(t+86400000).toISOString();
 const event=(id,date,final=false)=>({id,date,season:{year:2026},competitions:[{date,timeValid:true,status:{type:{name:final?'STATUS_FULL_TIME':'STATUS_SCHEDULED',state:final?'post':'pre',completed:final}},competitors:[{homeAway:'home',team:{id:'99901',displayName:'Test A'},score:final?'2':'0'},{homeAway:'away',team:{id:'99902',displayName:'Test B'},score:final?'1':'0'}]}]});
 const history=Array.from({length:12},(_,i)=>event('90'+i,new Date(t-(i+2)*86400000).toISOString(),true));
 globalThis.fetch=async url=>{const u=String(url);if(u.includes('/scoreboard?'))return Response.json({events:[event('998877',start)]});if(u.includes('/all/'))throw Error('fallback feed down');if(u.includes('fra.1')&&u.includes('season=2025'))throw Error('previous feed down');if(u.includes('ger.1')&&u.includes('season=2026'))throw Error('current feed down');return Response.json({team:{id:u.match(/teams\/(\d+)/)[1]},events:history});};
 try{
  const partial=await footballGameAnalysis('fra.1',footballDay(start),'998877');assert.equal(partial.analysis.status,'ready');assert.equal(partial.analysis.quality.label,'資料有限');assert.match(partial.analysis.quality.warnings.join(''),/2份歷史来源未完成|2份歷史來源未完成/);
  const unavailable=await footballGameAnalysis('ger.1',footballDay(start),'998877');assert.equal(unavailable.analysis.status,'waiting');assert.equal(unavailable.analysis.probabilities,undefined);assert.match(unavailable.analysis.reason,/本季/);
 }finally{globalThis.fetch=realFetch;}
});
