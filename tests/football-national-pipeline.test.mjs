import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {moduleUrl} from './profile-loader.mjs';
// Isolate the national source pipeline from unrelated league archives and adapters.
const now=Date.parse('2026-10-02T12:48:00Z');
const f=await import(moduleUrl('lib/football.ts')),s=await import(moduleUrl('lib/football-national-source.ts'));
const pool=await s.loadNationalFootballPool(now),home=pool.games.flatMap(g=>[g.home,g.away]).find(t=>t.id==='478'),away=pool.games.flatMap(g=>[g.home,g.away]).find(t=>t.id==='162');
const match={id:'401861103',league:'uefa.nations',start:'2026-10-02T18:45:00Z',timeConfirmed:true,home,away,homeScore:null,awayScore:null,state:'scheduled',statusName:'STATUS_SCHEDULED',neutral:false};
const event=g=>({id:g.id,date:g.start,league:{slug:g.league},season:{year:2026},competitions:[{date:g.start,timeValid:true,neutralSite:g.neutral,status:{type:{name:g.statusName,state:g.state==='final'?'post':'pre',completed:g.state==='final'}},competitors:[['home',g.home,g.homeScore],['away',g.away,g.awayScore]].map(([homeAway,t,score])=>({homeAway,team:{id:t.id,displayName:t.englishName},score:{value:score}}))}]});
test('source endpoint uses the opponent model and withdraws forecasts when current team history fails',async()=>{
 const originalFetch=globalThis.fetch,originalNow=Date.now;let clock=now,fail=false;
 Date.now=()=>clock;globalThis.fetch=async input=>{
  const url=new URL(String(input));if(url.pathname.endsWith('/scoreboard'))return Response.json({events:url.searchParams.get('dates')==='20261002'?[event(match)]:[]});
  const id=url.pathname.match(/teams\/(\d+)\/schedule/)?.[1];assert.ok(['478','162'].includes(id));
  if(fail&&id==='162')throw Error('offline');return Response.json({team:{id},events:pool.games.filter(g=>g.home.id===id||g.away.id===id).map(event)});
 };
 try{
  const source=readFileSync(process.env.FOOTBALL_SOURCE_PATH||'lib/football-source.ts','utf8').replace(/^import .*;\r?\n/gm,'');
  const imports=[['lib/football.ts','analyzeFootball,footballDay,isFootballNationalCompetition,needsFootballRecentForm,parseFootballEvents,parseFootballTeamHistory,shiftFootballDay'],['lib/football-history.ts','reconcileFootballHistory'],['lib/football-national-model.ts','applyNationalFootballModel,NATIONAL_MODEL_VERSION'],['lib/football-national-source.ts','loadNationalFootballPool'],['lib/football-cup-xg-source.ts','attachCupXgEvidence']].map(([path,names])=>`const {${names}}=await import(${JSON.stringify(moduleUrl(path))});`).join('\n');
  const prefix=imports+'\nconst work={active:0,pending:new Map(),queue:[]};const sourceWork=()=>work;const sportsSourceFetch=(...args)=>fetch(...args);class SportsSourceDenied extends Error{};\n';
  const code=prefix+ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  const {footballGameAnalysis}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  const result=await footballGameAnalysis('uefa.nations','2026-10-03',match.id);
  assert.equal(result.analysis.status,'ready');assert.equal(result.analysis.version,'football-national-opponent-v2');assert.ok(result.analysis.probabilities.home>result.analysis.probabilities.away);assert.equal(result.analysis.xgEvidence.modelApplied,false);assert.ok(result.analysis.xgEvidence.home.games>0);
  fail=true;clock+=61*60000;const failed=await footballGameAnalysis('uefa.nations','2026-10-03',match.id);assert.equal(failed.analysis.status,'waiting');assert.equal(failed.analysis.probabilities,undefined);
 }finally{globalThis.fetch=originalFetch;Date.now=originalNow;}
});
