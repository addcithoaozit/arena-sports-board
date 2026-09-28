import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const f=JSON.parse(readFileSync('tests/fixtures/football-nations.json'));
const {FOOTBALL_LEAGUES,isFootballLeague,parseFootballEvents,parseFootballTeamHistory,analyzeFootball,footballDay,isFootballFormCompetition}=await import(moduleUrl('lib/football.ts'));
const {footballRecommendations}=await import(moduleUrl('lib/football-recommendations.ts'));
const {selectFootballCalibration}=await import(moduleUrl('lib/football-calibration.ts'));
const {selectExternalFootballModel}=await import(moduleUrl('lib/football-external-model.ts'));
const {selectFootballMarketModel}=await import(moduleUrl('lib/football-market-model.ts'));
const league='uefa.nations',now=Date.parse(f.capturedAt),data=path=>f.sources.find(s=>s.paths.includes(path))?.data;
const raw=data('uefa.nations/scoreboard?dates=20260928&limit=100');
const game=parseFootballEvents(raw,league).find(g=>g.id==='401861081');
const history=f.sources.filter(s=>s.data.team).flatMap(s=>parseFootballTeamHistory(s.data,s.data.team.id,league));

test('Nations League shares the league registry and all 54 participating teams have Chinese names',()=>{
 assert.ok(isFootballLeague(league));assert.equal(FOOTBALL_LEAGUES.find(l=>l.code===league).fullName,'歐洲足總國家聯賽');
 for(const [id,name]of Object.entries(f.teams)){
  const e=structuredClone(raw.events[0]);e.competitions[0].competitors=[{homeAway:'home',team:{id,displayName:name}},{homeAway:'away',team:{id:'999999',displayName:'Opponent'}}];
  const g=parseFootballEvents({events:[e]},league)[0];assert.notEqual(g.home.name,name,name);assert.equal(g.home.id,id);
 }
 assert.equal(Object.keys(f.teams).length,54);assert.equal(game.home.name,'比利時');assert.equal(game.away.name,'法國');assert.equal(footballDay(game.start),'2026-09-29');
});
test('national history includes senior competitive matches and rejects other team families',()=>{
 for(const slug of ['uefa.nations','uefa.euro','uefa.euroq','fifa.world','fifa.worldq.uefa'])assert.equal(isFootballFormCompetition(slug,league),true);
 for(const slug of ['eng.1','uefa.champions','fifa.friendly','club.friendly','uefa.euro_u21','fifa.wwc','uefa.womens.nations'])assert.equal(isFootballFormCompetition(slug,league),false);
 assert.equal(isFootballFormCompetition('fifa.world','eng.1'),false);
 const source=data('all/teams/459/schedule?season=2026&limit=100');
 assert.throws(()=>parseFootballTeamHistory(source,'478',league),/身分不符/);
 assert.ok(history.some(g=>g.league==='fifa.world'));assert.ok(history.some(g=>g.league==='fifa.worldq.uefa'));assert.ok(history.every(g=>g.league!=='fifa.friendly'));
 assert.equal(parseFootballTeamHistory(source,'459').length,0);
 const e=source.events[0];assert.equal(parseFootballTeamHistory({team:{id:'459'},events:[{...e,league:undefined}]},'459',league).length,0);
});
test('real Belgium-France fixture gets complete recent-form probabilities with no club calibration',()=>{
 const base=analyzeFootball(game,history,now),a=analyzeFootball(game,history,now,history);
 assert.equal(base.status,'waiting');assert.equal(a.status,'ready');assert.equal(a.version,'football-national-form-v1');assert.equal(a.historyMode,'recent-form');assert.equal(a.calibration.status,'baseline');
 assert.equal(a.homeForm.games,10);assert.equal(a.awayForm.games,13);assert.equal(a.homeForm.supplementGames,9);assert.equal(a.awayForm.supplementGames,12);assert.equal(a.scores.length,3);
 assert.ok(Math.abs(a.probabilities.home+a.probabilities.draw+a.probabilities.away-1)<1e-9);
 assert.equal(selectFootballCalibration(league,now).parameters,null);assert.equal(selectExternalFootballModel(league,now),null);assert.equal(selectFootballMarketModel(league,now),null);assert.match(selectFootballCalibration(league,now).summary.label,/待驗證/);
});
test('future scores, friendlies, club matches, extra time and penalties cannot change the prediction',()=>{
 const seed=history.find(g=>g.home.id==='459'&&g.state==='final'),a=analyzeFootball(game,history,now,history);
 const bad=[{league:'eng.1'},{league:'fifa.friendly'},{league:'uefa.euro_u21'},{start:new Date(now+60000).toISOString()},{statusName:'STATUS_FINAL_AET'},{statusName:'STATUS_FINAL_PEN'},{awayScore:null},{start:'2024-01-01T00:00:00Z'}].map((patch,i)=>({...seed,id:'999900'+i,homeScore:20,awayScore:0,...patch}));
 assert.deepEqual(analyzeFootball(game,history,now,[...history,...bad]),a);
 assert.equal(analyzeFootball({...game,state:'live'},history,now,history).status,'closed');
 assert.equal(analyzeFootball({...game,timeConfirmed:false},history,now,history).status,'waiting');
});
test('Nations recommendations reuse the exact card probabilities and selected Taiwan day',()=>{
 const analysis=analyzeFootball(game,history,now,history),options={games:[game],reports:{[game.id]:{game,analysis}},league,day:footballDay(game.start),now};
 const [r]=footballRecommendations(options);assert.equal(r.analysis,analysis);assert.equal(r.analysis.probabilities,analysis.probabilities);assert.equal(r.analysis.scores,analysis.scores);
 assert.equal(r.result.label,'客勝');assert.equal(r.result.probability,analysis.probabilities.away);assert.equal(r.total.label,'小 2.5 球');
 assert.equal(footballRecommendations({...options,league:'eng.1'}).length,0);assert.equal(footballRecommendations({...options,day:'2026-09-28'}).length,0);assert.equal(footballRecommendations({...options,now:Date.parse(game.start)}).length,0);
});
test('full source pipeline preserves Taiwan dates and withdraws predictions if current national history fails',async()=>{
 const {footballSchedule,footballGameAnalysis}=await import(moduleUrl('lib/football-source.ts'));
 const originalFetch=globalThis.fetch,originalNow=Date.now;let clock=now,failCurrent=false;const calls=[];
 Date.now=()=>clock;
 globalThis.fetch=async url=>{
  const path=String(url).replace(f.source,'');calls.push(path);const payload=data(path);assert.ok(payload,`unexpected source ${path}`);
  if(failCurrent&&path==='all/teams/478/schedule?season=2026&limit=100')return Response.json({...payload,team:{id:'459'}});
  return Response.json(payload);
 };
 try{
  const board=await footballSchedule(league,'2026-09-29');assert.equal(board.games.length,8);assert.ok(board.games.every(g=>footballDay(g.start)==='2026-09-29'));assert.ok(board.games.every(g=>g.homeScore===null));
  const result=await footballGameAnalysis(league,'2026-09-29',game.id);assert.equal(result.analysis.status,'ready');assert.equal(result.game.home.name,'比利時');assert.equal(result.analysis.homeForm.games,10);assert.equal(result.analysis.awayForm.games,13);
  for(const team of ['459','478'])for(const year of [2026,2025])assert.ok(calls.includes(`all/teams/${team}/schedule?season=${year}&limit=100`));
  assert.ok(calls.every(p=>!p.includes('understat')));failCurrent=true;clock+=61*60000;
  const failed=await footballGameAnalysis(league,'2026-09-29',game.id);assert.equal(failed.analysis.status,'waiting');assert.equal(failed.analysis.probabilities,undefined);assert.match(failed.analysis.reason,/本年國家隊/);
 }finally{globalThis.fetch=originalFetch;Date.now=originalNow;}
});
