import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const fixture=JSON.parse(readFileSync('tests/fixtures/football-team-profile.json')),national=JSON.parse(readFileSync('tests/fixtures/football-national-recent-form.json'));
const sources=[...fixture.sources,...national.sources],payload=path=>sources.find(s=>s.paths.includes(path))?.data,now=Date.parse(fixture.capturedAt);
const {parseFootballTeamHistory,footballDay}=await import(moduleUrl('lib/football.ts'));
const {footballProfileTeam,footballProfileResults,footballProfileUpcoming,selectFootballProfileGames,summarizeFootballProfile,footballTeamHref,footballBoardHref,footballVenue}=await import(moduleUrl('lib/football-team-profile.ts'));
const history=national.sources.flatMap(s=>parseFootballTeamHistory(s.data,s.data.team.id,'uefa.nations',true));

test('team links and return links retain team identity, competition and Taiwan day',()=>{
 assert.equal(footballTeamHref('uefa.nations','579','2026-09-29'),'/teams/football/uefa.nations/579?date=2026-09-29');
 assert.equal(footballTeamHref('eng.1','359','invalid'),'/teams/football/eng.1/359');
 assert.equal(footballBoardHref('uefa.nations','2026-09-29'),'/?league=FOOTBALL&competition=uefa.nations&date=2026-09-29');
 assert.deepEqual(footballProfileTeam({id:'579',displayName:'Armenia'},'579'),{id:'579',name:'亞美尼亞',englishName:'Armenia'});
 assert.throws(()=>footballProfileTeam({id:'6775',displayName:'Montenegro'},'579'),/身分不符/);
});
test('national profiles show verified recent results and future fixtures on Taiwan dates',()=>{
 const results=footballProfileResults(history,'uefa.nations','6775',now);assert.equal(results.length,9);assert.equal(results.filter(g=>g.league==='fifa.friendly').length,5);
 assert.ok(results.every(g=>g.home.id==='6775'||g.away.id==='6775'));assert.ok(results.every((g,i)=>!i||g.start<=results[i-1].start));
 const data=payload('uefa.nations/teams/579/schedule?season=2026&fixture=true&limit=100');
 const upcoming=footballProfileUpcoming(parseFootballTeamHistory(data,'579','uefa.nations',true),'uefa.nations','579',now);
 assert.equal(upcoming.length,5);assert.equal(upcoming[0].away.name,'蒙特內哥羅');assert.equal(footballDay(upcoming[0].start),'2026-09-29');assert.ok(upcoming.every(g=>g.homeScore===null));
});
test('club profiles remain separate from national matches and exclude club friendlies',()=>{
 const paths=[2026,2025].map(y=>`all/teams/359/schedule?season=${y}&limit=100`);
 const games=paths.flatMap(p=>parseFootballTeamHistory(payload(p),'359','eng.1',true));
 const results=footballProfileResults([...games,...history],'eng.1','359',now);
 assert.ok(results.length>=20);assert.ok(results.every(g=>g.league!=='club.friendly'&&g.league!=='fifa.friendly'));assert.equal(selectFootballProfileGames(results,'359','all',20).length,20);
});
test('summary uses the team perspective, includes draws in win rate and keeps neutral games separate',()=>{
 const seed=history.find(g=>g.home.id==='6775');
 const games=[{...seed,id:'9101',homeScore:3,awayScore:0,neutral:false},{...seed,id:'9102',home:seed.away,away:seed.home,homeScore:2,awayScore:1,neutral:false},{...seed,id:'9103',homeScore:0,awayScore:0,neutral:true}];
 const s=summarizeFootballProfile(games,'6775');
 assert.deepEqual({games:s.games,w:s.wins,d:s.draws,l:s.losses,gf:s.scored,ga:s.conceded,gd:s.goalDifference},{games:3,w:1,d:1,l:1,gf:4,ga:2,gd:2});
 assert.equal(s.winRate,1/3);assert.equal(s.cleanSheetRate,2/3);assert.equal(s.bttsRate,1/3);assert.equal(s.over25Rate,2/3);assert.deepEqual(s.recent,['勝','負','和']);
 for(const venue of ['home','away','neutral'])assert.equal(selectFootballProfileGames(games,'6775',venue,5).length,1);
 assert.equal(footballVenue(games[2],'6775'),'neutral');assert.equal(summarizeFootballProfile([],'6775').winRate,null);
});
test('profile excludes conflicting, future, incomplete, extra-time and older scores',()=>{
 const original=footballProfileResults(history,'uefa.nations','6775',now),seed=original[0];
 const bad=[{start:new Date(now+60000).toISOString()},{start:new Date(now-366*86400000).toISOString()},{state:'live'},{statusName:'STATUS_FINAL_AET'},{statusName:'STATUS_FINAL_PEN'},{homeScore:null},{league:'club.friendly'},{league:'fifa.friendly_u21'}].map((p,i)=>({...seed,id:'900900'+i,...p}));
 assert.deepEqual(footballProfileResults([...history,...history,...bad],'uefa.nations','6775',now),original);
 const conflicted=footballProfileResults([...history,{...seed,homeScore:seed.homeScore+1}],'uefa.nations','6775',now);assert.equal(conflicted.length,original.length-1);assert.ok(!conflicted.some(g=>g.id===seed.id));
});
test('profile API returns actual national and club data, rejects bad parameters and failed current identity',async()=>{
 const {GET}=await import(moduleUrl('app/api/football-team/route.ts'));
 const fetchBefore=globalThis.fetch,nowBefore=Date.now;let clock=now,fail=false,fixtureFailure=false;const calls=[];
 Date.now=()=>clock;globalThis.fetch=async url=>{
  const path=String(url).replace(fixture.source,'');calls.push(path);const data=payload(path);assert.ok(data,`unexpected source ${path}`);
  if(fixtureFailure&&path.includes('fixture=true'))throw Error('fixture source unavailable');
  return Response.json(fail&&path==='all/teams/579/schedule?season=2026&limit=100'?{...data,team:{id:'359',displayName:'Arsenal'}}:data);
 };
 const get=q=>GET(new Request('http://localhost/api/football-team?'+q));
 try{
  for(const q of ['league=bad&team=579','league=uefa.nations&team=../579','league=uefa.nations&team=1%3Bx'])assert.equal((await get(q)).status,400);
  for(const [league,team,name]of [['uefa.nations','579','亞美尼亞'],['uefa.nations','6775','蒙特內哥羅'],['eng.1','359','阿森納']]){
   const response=await get(`league=${league}&team=${team}`),d=await response.json();assert.equal(response.status,200);assert.equal(d.team.name,name);assert.equal(d.team.id,team);assert.ok(d.results.length);assert.ok(d.upcoming.length);assert.match(response.headers.get('Cache-Control'),/private.*no-store/);
  }
  const count=calls.length;await get('league=uefa.nations&team=579');assert.equal(calls.length,count,'public source cache is reused');
  fixtureFailure=true;clock+=61*60000;const partial=await get('league=uefa.nations&team=579');assert.equal(partial.status,200);const partialData=await partial.json();assert.ok(partialData.results.length);assert.equal(partialData.upcoming,null);
  fail=true;clock+=61*60000;assert.equal((await get('league=uefa.nations&team=579')).status,503);
 }finally{globalThis.fetch=fetchBefore;Date.now=nowBefore;}
});
