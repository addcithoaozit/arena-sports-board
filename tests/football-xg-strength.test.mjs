import {test} from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {moduleUrl} from './profile-loader.mjs';
const {footballXgStrengthRuntime:runtime,selectFootballXgStrengthModel:select,xgStrengthDistribution:dist}=await import(moduleUrl('lib/football-xg-strength-model.ts'));
const fixtures=JSON.parse(readFileSync('tests/fixtures/football-xg-strength-parity.json'));const now=Date.parse(runtime.createdAt)+1000;
test('new xG strength production grid matches independent SciPy calculations in all five leagues',()=>{for(const f of fixtures){const d=dist(f.input,f.baseline,f.parameters);for(const k of Object.keys(f.probabilities))assert.ok(Math.abs(d.probabilities[k]-f.probabilities[k])<1e-10,f.league+k);for(const k of ['home','away'])assert.ok(Math.abs(d.expected[k]-f.expected[k])<1e-10);}});
test('only accepted candidates within their validity window are selectable',()=>{assert.deepEqual(Object.keys(runtime.leagues).filter(l=>select(l,now)),['esp.1','fra.1']);for(const l of Object.keys(runtime.leagues)){assert.equal(select(l,Date.parse(runtime.createdAt)-1),null);assert.equal(select(l,Date.parse(runtime.expiresAt)),null);}assert.equal(select('uefa.nations',now),null);});
test('promoted leagues beat the deployed model within every frozen acceptance gate',()=>{for(const e of Object.values(runtime.leagues)){if(!e.enabled)continue;assert.ok(e.sampleSizes.training>=180);for(const [k,m] of Object.entries(e.metrics)){assert.ok(m.candidate.n>=(k==='holdout'?160:k==='selection'?80:60));assert.ok(m.candidate.logLoss<m.baseline.logLoss);assert.ok(m.candidate.brier<=m.baseline.brier);for(const b of ['over25Brier','bttsBrier'])assert.ok(m.candidate[b]<=m.baseline[b]+.002);}}});
test('increasing home pregame xG or Elo changes the actual result probability',()=>{const f=fixtures.find(x=>x.league==='esp.1'),initial=dist(f.input,f.baseline,f.parameters).probabilities.home;for(const index of [4,8]){const x=[...f.input];x[index]+=.5;assert.ok(dist(x,f.baseline,f.parameters).probabilities.home>initial);}});
const {applyExternalFootballAnalysis}=await import(moduleUrl('lib/football-external-source.ts'));
const {analyzeFootball}=await import(moduleUrl('lib/football.ts'));
const teams=JSON.parse(readFileSync('data/football/external-team-map.json')).teams;
test('accepted xG model is used by the production analysis path; missing xG preserves fallback',()=>{
 const game={id:'audit-fixture',league:'esp.1',season:2026,start:new Date(now+86400000).toISOString(),home:{id:'96',name:'Home'},away:{id:'1068',name:'Away'},state:'scheduled',timeConfirmed:true,neutral:false};
 const history=Array.from({length:15},(_,i)=>({id:'test:'+i,league:'esp.1',start:new Date(now-(i+2)*86400000).toISOString(),homeId:teams['96'].understat,awayId:teams['1068'].understat,homeGoals:1,awayGoals:2,homeXg:.8,awayXg:1.8,neutral:false}));
 const context={history,fetchedAt:new Date(now).toISOString(),teams:new Set([history[0].homeId,history[0].awayId]),conflicts:0,sources:['Understat']},base=analyzeFootball(game,[],now),a=applyExternalFootballAnalysis(game,base,[],context,now);
 assert.equal(a.status,'ready');assert.equal(a.version,runtime.version);assert.equal(a.external.modelApplied,true);
 const noXg=applyExternalFootballAnalysis(game,base,[],{...context,history:history.map(g=>({...g,homeXg:null,awayXg:null}))},now);
 assert.notEqual(noXg.version,runtime.version);assert.equal(noXg.external.modelApplied,false);
});
