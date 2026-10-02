import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const fixture=JSON.parse(readFileSync('tests/fixtures/football-national-recent-form.json'));
const nations=JSON.parse(readFileSync('tests/fixtures/football-nations.json'));
const {parseFootballEvents,parseFootballTeamHistory,analyzeFootball,footballForm,isFootballFormCompetition}=await import(moduleUrl('lib/football.ts'));
const {footballRecommendations}=await import(moduleUrl('lib/football-recommendations.ts'));
const league='uefa.nations',now=Date.parse(fixture.capturedAt),allSources=[...fixture.sources,...nations.sources];
const data=path=>allSources.find(s=>s.paths.includes(path))?.data;
const games=parseFootballEvents(data('uefa.nations/scoreboard?dates=20260928&limit=100'),league).filter(g=>['401861076','401861082'].includes(g.id));
const history=fixture.sources.flatMap(s=>parseFootballTeamHistory(s.data,s.data.team.id,league,true));
const competitive=history.filter(g=>g.league!=='fifa.friendly');
const includesTeam=(g,id)=>g.home.id===id||g.away.id===id;

test('Armenia-Montenegro and Latvia-Cyprus use real recent national results only where needed',()=>{
 assert.equal(games.length,2);
 for(const game of games){
  const original=analyzeFootball(game,competitive,now,competitive),a=analyzeFootball(game,history,now,history);
  assert.equal(original.status,'waiting');assert.equal(original.awayForm.games,4);
  assert.equal(a.status,'ready');assert.equal(a.version,'football-national-recent-v1');assert.equal(a.calibration.version,a.version);assert.equal(a.calibration.status,'baseline');
  assert.deepEqual(a.homeForm,original.homeForm);assert.equal(a.awayForm.games,9);assert.equal(a.awayForm.friendlyGames,5);
  assert.equal(a.scores.length,3);assert.ok(Math.abs(a.probabilities.home+a.probabilities.draw+a.probabilities.away-1)<1e-9);
  assert.ok(Object.values(a.probabilities).every(p=>p>=0&&p<=1));
  const [pick]=footballRecommendations({games:[game],reports:{[game.id]:{game,analysis:a}},league,day:'2026-09-29',now});
  assert.equal(pick.analysis,a);assert.equal(pick.analysis.probabilities,a.probabilities);assert.equal(pick.analysis.scores,a.scores);
 }
});
test('senior national friendlies require explicit national parsing and cannot enter club analysis',()=>{
 assert.equal(isFootballFormCompetition('fifa.friendly',league),false);assert.equal(isFootballFormCompetition('fifa.friendly',league,true),true);
 for(const target of ['eng.1','uefa.champions',undefined])assert.equal(isFootballFormCompetition('fifa.friendly',target,true),false);
 for(const slug of ['club.friendly','fifa.friendly_u21','fifa.friendly.w','uefa.euro_u21','fifa.wwc','eng.1'])assert.equal(isFootballFormCompetition(slug,league,true),false);
 const source=data('all/teams/6775/schedule?season=2026&limit=100');
 assert.equal(parseFootballTeamHistory(source,'6775',league).length,4);assert.equal(parseFootballTeamHistory(source,'6775',league,true).length,9);
 assert.throws(()=>parseFootballTeamHistory(source,'445',league,true),/身分不符/);
 const noLeague=structuredClone(source);noLeague.events=noLeague.events.map(e=>({...e,league:undefined}));assert.equal(parseFootballTeamHistory(noLeague,'6775',league,true).length,0);
});
test('international friendlies have lower influence than Nations results of the same age',()=>{
 const seed=history.find(g=>g.home.id==='6775'),start=new Date(now-20*86400000).toISOString();
 const rows=[{...seed,id:'90001',league,start,homeScore:0,awayScore:0},{...seed,id:'90002',league:'fifa.friendly',start,homeScore:10,awayScore:0}];
 const f=footballForm('6775','home',rows,now,true,{decayDays:90,venueWeight:.6,competition:league,otherCompetitionWeight:.35,friendlyWeight:.2});
 assert.ok(Math.abs(f.scored-10/6)<1e-9);assert.equal(f.friendlyGames,1);
});
test('future, old, incomplete, extra-time, youth and club scores cannot fill sparse national form',()=>{
 const game=games[0],a=analyzeFootball(game,history,now,history),seed=history.find(g=>g.league==='fifa.friendly'&&includesTeam(g,game.away.id));
 const invalid=[{start:new Date(now+60000).toISOString()},{start:new Date(now-366*86400000).toISOString()},{state:'live'},{statusName:'STATUS_FINAL_AET'},{statusName:'STATUS_FINAL_PEN'},{awayScore:null},{league:'club.friendly'},{league:'fifa.friendly_u21'},{league:'fifa.wwc'}].map((patch,i)=>({...seed,id:'999900'+i,homeScore:20,awayScore:0,...patch}));
 assert.deepEqual(analyzeFootball(game,history,now,[...history,...history,...invalid]),a);
 const awayRows=[...new Map(history.filter(g=>includesTeam(g,game.away.id)).map(g=>[g.id,g])).values()];
 const keep=new Set(awayRows.slice(0,4).map(g=>g.id)),short=history.filter(g=>!includesTeam(g,game.away.id)||keep.has(g.id));
 const insufficient=analyzeFootball(game,short,now,short);assert.equal(insufficient.status,'waiting');assert.equal(insufficient.probabilities,undefined);
 const stale=history.map(g=>({...g,start:new Date(now-130*86400000).toISOString()}));
 const expired=analyzeFootball(game,stale,now,stale);assert.equal(expired.status,'waiting');assert.equal(expired.probabilities,undefined);
 assert.equal(analyzeFootball({...game,state:'live'},history,now,history).status,'closed');
});
test('adequate competitive national analysis remains identical even when recent friendlies are present',()=>{
 const game=parseFootballEvents(data('uefa.nations/scoreboard?dates=20260928&limit=100'),league).find(g=>g.id==='401861081');
 const full=nations.sources.filter(s=>s.data.team).flatMap(s=>parseFootballTeamHistory(s.data,s.data.team.id,league,true));
 const official=full.filter(g=>g.league!=='fifa.friendly');
 assert.deepEqual(analyzeFootball(game,full,now,full),analyzeFootball(game,official,now,official));
});
test('source pipeline requires opponent context and withdraws forecasts when current history fails',async()=>{
 const {footballGameAnalysis}=await import(moduleUrl('lib/football-source.ts'));
 const originalFetch=globalThis.fetch,originalNow=Date.now;let clock=now,fail=false;
 Date.now=()=>clock;globalThis.fetch=async url=>{
  const path=String(url).replace(fixture.source,'');const payload=data(path);assert.ok(payload,`unexpected request ${path}`);
  if(fail&&/all\/teams\/(6775|445)\/schedule\?season=2026/.test(path))return Response.json({...payload,team:{id:'999999'}});
  return Response.json(payload);
 };
 try{
  for(const game of games){const r=await footballGameAnalysis(league,'2026-09-29',game.id);assert.equal(r.analysis.status,'waiting');assert.equal(r.analysis.awayForm.friendlyGames,5);assert.equal(r.analysis.version,'football-national-opponent-v2');assert.equal(r.analysis.probabilities,undefined);assert.match(r.analysis.reason,/對手強度/);}
  fail=true;clock+=61*60000;
  for(const game of games){const r=await footballGameAnalysis(league,'2026-09-29',game.id);assert.equal(r.analysis.status,'waiting');assert.equal(r.analysis.probabilities,undefined);assert.match(r.analysis.reason,/本年國家隊/);}
 }finally{globalThis.fetch=originalFetch;Date.now=originalNow;}
});

