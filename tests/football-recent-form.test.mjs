import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const {analyzeFootball,footballForm,parseFootballEvents,parseFootballTeamHistory,footballDay}=await import(moduleUrl('lib/football.ts'));
const {reconcileFootballHistory}=await import(moduleUrl('lib/football-history.ts'));
const fixture=JSON.parse(readFileSync('tests/fixtures/football-recent-form.json','utf8'));
const data=key=>fixture.sources.find(s=>s.key===key).data;
const now=Date.parse(fixture.capturedAt);
const game=parseFootballEvents(data('ger.1_scoreboard_dates_20261010_limit_100'),'ger.1')[0];
const primary=['ger.1_teams_10388_schedule_season_2026','ger.1_teams_598_schedule_season_2026','ger.1_teams_598_schedule_season_2025'].flatMap(k=>parseFootballEvents(data(k),'ger.1'));
const extra=['all_teams_10388_schedule_season_2026','all_teams_10388_schedule_season_2025'].flatMap(k=>parseFootballTeamHistory(data(k),'10388'));
test('reported Union Berlin vs Elversberg fixture progresses from four results to a complete recent-form prediction',()=>{
 const before=analyzeFootball(game,primary,now);assert.equal(before.status,'waiting');assert.equal(before.awayForm.games,4);
 const merged=reconcileFootballHistory([...primary,...extra],[]).games;
 const a=analyzeFootball(game,merged,now,merged);
 assert.equal(a.status,'ready');assert.equal(a.homeForm.games,20);assert.equal(a.awayForm.games,20);assert.equal(a.awayForm.supplementGames,16);assert.equal(a.homeForm.supplementGames,0);
 assert.equal(a.version,'football-recent-form-v1');assert.equal(a.calibration.status,'baseline');assert.equal(a.calibration.holdoutGames,0);assert.equal(a.scores.length,3);
 assert.ok(Math.abs(a.probabilities.home+a.probabilities.draw+a.probabilities.away-1)<1e-10);
 assert.ok(extra.some(g=>g.league==='ger.2'));assert.ok(extra.every(g=>g.league!=='club.friendly'));
});
test('team fallback rejects wrong identity, missing competition, friendlies and unrelated fixtures',()=>{
 const raw=data('all_teams_10388_schedule_season_2026');assert.throws(()=>parseFootballTeamHistory(raw,'598'));
 const e=raw.events.find(e=>e.league.slug==='ger.1');
 assert.equal(parseFootballTeamHistory({team:{id:'10388'},events:[{...e,league:undefined},{...e,league:{slug:'club.friendly'}},{...e,league:{slug:'eng.w.1'}}]},'10388').length,0);
 assert.equal(parseFootballTeamHistory({...raw,team:{id:'99999'}},'99999').length,0);
});
test('supplement cannot replace missing history with future, target, extra-time or penalty scores',()=>{
 const template=extra.find(g=>g.league==='ger.2');
 const invalid=[{...template,id:'900',start:new Date(now+60000).toISOString()},{...template,id:game.id},{...template,id:'902',statusName:'STATUS_FINAL_AET'},{...template,id:'903',statusName:'STATUS_FINAL_PEN'},{...template,id:'904',state:'scheduled'},{...template,id:'905',awayScore:null},{...template,id:'906',start:'2024-01-01T00:00Z'},{...template,id:'907',league:'club.friendly'}];
 const a=analyzeFootball(game,primary,now,invalid);assert.equal(a.status,'waiting');assert.equal(a.probabilities,undefined);assert.equal(a.awayForm.games,4);
});
test('cross-competition outcomes have less influence than equal-age own-league results',()=>{
 const template=primary.find(g=>g.home.id==='10388'||g.away.id==='10388');
 const make=(id,league,goals)=>({...template,id,league,home:game.away,away:game.home,homeScore:goals,awayScore:1,start:new Date(now-86400000).toISOString()});
 const rows=[make('1','ger.1',1),make('2','ger.2',8)];
 const weighted=footballForm('10388','home',rows,now,false,{decayDays:90,venueWeight:0,competition:'ger.1',otherCompetitionWeight:.35});
 assert.ok(weighted.scored<footballForm('10388','home',rows,now).scored);assert.ok(weighted.scored>1);assert.equal(weighted.supplementGames,1);
});
test('healthy same-league predictions remain exactly unchanged even when other competitions are supplied',()=>{
 const g={...game,league:'esp.1'},rows=Array.from({length:12},(_,i)=>({...g,id:'920'+i,start:new Date(now-(i+1)*86400000).toISOString(),state:'final',statusName:'STATUS_FULL_TIME',homeScore:2,awayScore:1}));
 const a=analyzeFootball(g,rows,now),b=analyzeFootball(g,rows,now,extra);
 assert.equal(a.calibration.status,'applied');assert.deepEqual(a,b);
});
test('conflicting fallback IDs stay quarantined across competitions and archive',()=>{
 const a=extra[0],b={...a,league:'ger.1',homeScore:9};
 const result=reconcileFootballHistory([a,b],[a]);assert.equal(result.conflicts,1);assert.equal(result.games.length,0);
});
test('source automatically fetches both team seasons and recovers a failed league feed with verified all-competition data',async()=>{
 const {footballGameAnalysis}=await import(moduleUrl('lib/football-source.ts'));
 const actualFetch=globalThis.fetch,t=Date.now(),start=new Date(t+86400000).toISOString(),year=new Date(t).getUTCFullYear(),calls=[];
 const event=(id,date,league,final=true)=>({id,date,league:{slug:league},season:{year},competitions:[{date,timeValid:true,neutralSite:false,status:{type:{name:final?'STATUS_FULL_TIME':'STATUS_SCHEDULED',state:final?'post':'pre',completed:final}},competitors:[{homeAway:'home',team:{id:'99111',displayName:'Test home'},score:final?'2':null},{homeAway:'away',team:{id:'99112',displayName:'Test away'},score:final?'1':null}]}]});
 globalThis.fetch=async url=>{
  const u=new URL(String(url));calls.push(u.pathname+u.search);
  if(u.pathname.includes('/scoreboard'))return Response.json({events:[event('919191',start,'ger.1',false)]});
  const team=u.pathname.match(/teams\/(\d+)/)[1];
  if(u.pathname.includes('/ger.1/')&&u.searchParams.get('season')===String(year))throw Error('league feed down');
  const all=u.pathname.includes('/all/'),events=all?Array.from({length:12},(_,i)=>event('700'+i,new Date(t-(i+2)*86400000).toISOString(),'ger.2')):[];
  return Response.json({team:{id:team},events});
 };
 try{
  const result=await footballGameAnalysis('ger.1',footballDay(start),'919191');
  assert.equal(result.analysis.status,'ready');assert.equal(result.analysis.historyMode,'recent-form');
  for(const team of ['99111','99112'])for(const season of [year,year-1])assert.ok(calls.some(p=>p.includes(`/all/teams/${team}/schedule?season=${season}`)));
  assert.equal(result.analysis.homeForm.games,12);assert.equal(result.analysis.awayForm.games,12);
 }finally{globalThis.fetch=actualFetch;}
});
