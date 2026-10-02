import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
import {primaryEvidence,refresh} from '../scripts/football-fotmob/refresh_espn.mjs';
const {attachCupXgEvidence,cupXgEvidence}=await import(moduleUrl('lib/football-cup-xg-source.ts'));
const seed=JSON.parse(readFileSync('data/football/cup-xg-history.json'));
const now=Date.parse(seed.sourceUpdatedAt)+1000;
const game={id:'test',league:'uefa.nations',home:{id:'478'},away:{id:'162'},start:new Date(now+86400000).toISOString()};
test('verified source data has unique IDs, real xG and explicit venue evidence',()=>{
 assert.ok(seed.rows.length>2000);
 assert.equal(new Set(seed.rows.map(r=>r[0])).size,seed.rows.length);
 for(const r of seed.rows){assert.ok(r[7]>=0&&r[8]>=0);assert.equal(typeof r[9],'boolean');assert.match(r[10],/^fotmob:\d+$/);assert.ok(r[11]);assert.ok(Date.parse(r[2])<Date.parse(seed.builtAt));}
});
test('cup source evidence never changes the active model or probabilities',()=>{
 const base={status:'ready',version:'existing',probabilities:{home:.5,draw:.2,away:.3},expected:{home:1.7,away:1},notes:[]};
 const result=attachCupXgEvidence(game,base,now);const {xgEvidence,...preserved}=result;
 assert.deepEqual(preserved,base);assert.equal(xgEvidence.modelApplied,false);assert.equal(xgEvidence.stale,false);assert.ok(xgEvidence.home.games>0);assert.ok(xgEvidence.away.games>0);
});
test('history excludes match day and future results, stale and missing sources are explicit',()=>{
 const earliest=Math.min(...seed.rows.map(r=>Date.parse(r[2])));
 const old=cupXgEvidence({...game,start:new Date(earliest+3600000).toISOString()},earliest+3600000);
 assert.equal(old.home.games,0);assert.equal(old.home.for,null);assert.equal(old.away.against,null);
 assert.equal(cupXgEvidence(game,now+49*3600000).stale,true);
 assert.equal(cupXgEvidence({...game,league:'eng.1'},now),null);
 assert.equal(cupXgEvidence({...game,league:'uefa.champions',home:{id:'unknown'}},now),null);
});
test('primary refresh fails before replacing files after an HTTP denial',async()=>{
 const before=readFileSync('data/football/cup-xg-history.json','utf8');
 await assert.rejects(refresh(async()=>({ok:false,status:403}),now),/HTTP 403/);
 assert.equal(readFileSync('data/football/cup-xg-history.json','utf8'),before);
 assert.throws(()=>primaryEvidence({events:Array(1000).fill({})},'uefa.champions'),/incomplete/);
});
