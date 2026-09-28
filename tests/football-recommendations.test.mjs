import {test} from 'node:test';
import assert from 'node:assert/strict';
import {moduleUrl} from './profile-loader.mjs';
const {footballRecommendations,footballSourceStale,readyFootballAnalysis}=await import(moduleUrl('lib/football-recommendations.ts'));
const now=Date.parse('2026-09-28T12:00:00Z');
const game={id:'9001',league:'eng.1',season:2026,start:'2026-09-28T19:00:00Z',timeConfirmed:true,home:{id:'359',name:'阿森納',englishName:'Arsenal'},away:{id:'363',name:'切爾西',englishName:'Chelsea'},homeScore:null,awayScore:null,state:'scheduled',statusName:'STATUS_SCHEDULED',statusLabel:'未開賽',neutral:false,venue:'Test stadium',sourceUrl:'https://www.espn.com/'};
const analysis={status:'ready',reason:'',version:'fixture',capturedAt:new Date(now-30000).toISOString(),probabilities:{home:.52,draw:.26,away:.22,over25:.62,under25:.38,btts:.59},scores:[{home:2,away:1,probability:.12},{home:1,away:0,probability:.1},{home:1,away:1,probability:.09}],notes:[]};
const report={game,analysis};
const options={games:[game],reports:{[game.id]:report},league:'eng.1',day:'2026-09-29',now};
test('recommendations preserve the exact card probabilities and score snapshot',()=>{
 const before=JSON.stringify(options),[row]=footballRecommendations(options);
 assert.equal(row.analysis,analysis);assert.equal(row.analysis.scores,analysis.scores);
 assert.deepEqual(row.result,{label:'主勝',probability:.52});assert.deepEqual(row.total,{label:'大 2.5 球',probability:.62});assert.deepEqual(row.btts,{label:'是',probability:.59});
 assert.equal(JSON.stringify(options),before);
});
test('draws can lead the recommendation without renormalizing away the draw',()=>{
 const next={...analysis,probabilities:{home:.28,draw:.43,away:.29,over25:.35,under25:.65,btts:.32}};
 const [row]=footballRecommendations({...options,reports:{[game.id]:{game,analysis:next}}});
 assert.deepEqual(row.result,{label:'和局',probability:.43});assert.deepEqual(row.total,{label:'小 2.5 球',probability:.65});assert.equal(row.btts.label,'否');assert.ok(Math.abs(row.btts.probability-.68)<1e-12);
});
test('away recommendations use the higher probability and exact ties do not pick an arbitrary side',()=>{
 const away={...analysis,probabilities:{...analysis.probabilities,home:.22,away:.52}};
 assert.equal(footballRecommendations({...options,reports:{[game.id]:{game,analysis:away}}})[0].result.label,'客勝');
 const tied={...analysis,probabilities:{home:.4,draw:.2,away:.4,over25:.5,under25:.5,btts:.5}};
 const [row]=footballRecommendations({...options,reports:{[game.id]:{game,analysis:tied}}});
 assert.equal(row.result,null);assert.equal(row.total,null);assert.equal(row.btts,null);
});
test('kickoff, non-scheduled matches and unconfirmed times withdraw recommendations',()=>{
 assert.equal(footballRecommendations({...options,now:Date.parse(game.start)}).length,0);
 for(const patch of [{state:'live'},{state:'final'},{state:'other'},{timeConfirmed:false}]){
  const next={...game,...patch};assert.equal(readyFootballAnalysis(next,{game:next,analysis},now),null);
 }
});
test('a report for another fixture, team assignment or rescheduled match cannot be reused',()=>{
 for(const patch of [{id:'9002'},{league:'esp.1'},{season:2025},{start:'2026-09-28T20:00:00Z'},{home:game.away,away:game.home},{neutral:true},{timeConfirmed:false},{state:'live'}]){
  assert.equal(readyFootballAnalysis(game,{game:{...game,...patch},analysis},now),null,JSON.stringify(patch));
 }
});
test('only the selected league and Taiwan date enter the sheet',()=>{
 assert.equal(footballRecommendations({...options,day:'2026-09-28'}).length,0);
 assert.equal(footballRecommendations({...options,league:'esp.1'}).length,0);
 assert.equal(footballRecommendations({...options,games:[]}).length,0);
});
test('source errors, missing reports and stale or invalid analysis timestamps are rejected',()=>{
 assert.equal(footballRecommendations({...options,unavailable:true}).length,0);
 assert.equal(readyFootballAnalysis(game,undefined,now),null);
 assert.equal(readyFootballAnalysis(game,{...report,error:'update failed'},now),null);
 for(const capturedAt of ['invalid',new Date(now-15*60000).toISOString(),new Date(now+61000).toISOString()]){
  assert.equal(readyFootballAnalysis(game,{game,analysis:{...analysis,capturedAt}},now),null);
 }
 assert.equal(readyFootballAnalysis(game,{game,analysis:{...analysis,status:'waiting'}},now),null);
 assert.equal(readyFootballAnalysis(game,{game,analysis:{...analysis,capturedAt:new Date(now+1000).toISOString()}},now)?.status,'ready');
});
test('invalid probability values or totals cannot produce a recommendation',()=>{
 for(const patch of [{home:NaN},{away:Infinity},{draw:-.01},{btts:1.01},{home:.8},{over25:.8}]){
  assert.equal(readyFootballAnalysis(game,{game,analysis:{...analysis,probabilities:{...analysis.probabilities,...patch}}},now),null);
 }
});
test('scoreboard freshness is rechecked when the floating panel opens',()=>{
 assert.equal(footballSourceStale(new Date(now-119999).toISOString(),now),false);
 assert.equal(footballSourceStale(new Date(now-120000).toISOString(),now),true);
 assert.equal(footballSourceStale('invalid',now),true);
 assert.equal(footballSourceStale(new Date(now+61000).toISOString(),now),true);
});
