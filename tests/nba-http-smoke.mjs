// Build first. Exercise real Next routes and member auth against in-memory DB.
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
const origin='http://127.0.0.1:3030',cookie='__Host-arena_tz='+'e'.repeat(64);
for(const failure of [false,true]){
 const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3030'],{env:{...process.env,YJ_RENDER_HTTP_TEST:'1',YJ_FOOTBALL_ADMIN_SMOKE:'1',YJ_BACKGROUND_REFRESH:'0',DATABASE_URL:'postgresql://local-test/fixture',TZ_BINDING_KEY:Buffer.alloc(32).toString('base64'),PLATFORM_ADMIN_USERNAME:'render-test-admin',APP_ORIGIN:origin,NBA_TEST_HISTORY_FAILURE:failure?'1':'0',NODE_OPTIONS:'--import ./tests/nba-http-preload.mjs'},stdio:['ignore','pipe','pipe']});
 let output='';child.stdout.on('data',x=>output+=x);child.stderr.on('data',x=>output+=x);
 const request=path=>fetch(origin+path,{headers:{cookie}});
 try{
  let ready=false;for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error(output);try{if((await fetch(origin+'/api/health')).ok){ready=true;break;}}catch{}await delay(250);}assert.ok(ready,'server ready');
  assert.equal((await fetch(origin+'/api/nba')).status,401);assert.equal((await fetch(origin+'/teams/nba/2',{redirect:'manual'})).status,307);
  const board=await request('/api/nba?date=2026-10-09');assert.equal(board.status,200,await board.clone().text());assert.match(board.headers.get('cache-control'),/no-store/);assert.equal((await board.json()).games.length,6);
  assert.equal((await request('/api/nba?date=2026-02-31')).status,400);assert.equal((await request('/api/nba?kind=analysis&game=bad')).status,400);
  assert.equal((await request('/api/nba?date=2026-10-09&kind=analysis&game=99999')).status,404);
  const analysis=await request('/api/nba?date=2026-10-09&kind=analysis&game=401898392');assert.equal(analysis.status,failure?502:200,await analysis.clone().text());const a=await analysis.json();
  if(!failure){assert.equal(a.analysis.status,'ready');assert.equal(a.analysis.homeForm.games,20);assert.equal(a.analysis.awayForm.games,20);assert.equal(a.analysis.probabilities.home+a.analysis.probabilities.away,1);}else assert.equal(a.analysis,undefined);
  const team=await request('/api/nba?kind=team&team=2');assert.equal(team.status,failure?502:200);if(!failure){const p=await team.json();assert.equal(p.results.length,89);assert.equal(p.upcoming[0].phase,1);}
  assert.equal((await request('/api/nba?kind=team&team=999')).status,404);
  assert.equal((await fetch(origin+'/players/nba/1628369',{redirect:'manual'})).status,307);
  assert.equal((await fetch(origin+'/api/nba?kind=player&player=1628369')).status,401);
  assert.equal((await request('/api/nba?kind=player&player=bad')).status,400);
  assert.equal((await request('/api/nba?kind=player&player=999')).status,404);
  assert.equal((await request('/api/nba?kind=team-season&team=2&season=2099&phase=2')).status,400);
  assert.equal((await request('/api/nba?kind=team-season&team=2&season=2026&phase=8')).status,400);
  const seasonData=await (await request('/api/nba?kind=team-season&team=2&season=2026&phase=2')).json();assert.equal(seasonData.games.filter(g=>g.state==='final').length,82);
  const official=await (await request('/api/nba?kind=team-official&team=2')).json();assert.equal(official.roster.length,21);assert.equal(official.rosterSeason,'2026');assert.equal(official.season,'2025-26');assert.equal(official.fantasyNews,undefined);
  const player=await (await request('/api/nba?kind=player&player=1628369')).json();assert.equal(player.name,'Jayson Tatum');assert.equal(player.games.length,5);assert.equal(player.stats.season,'2025-26');assert.equal(player.cmsBio,undefined);
  assert.equal((await request('/players/nba/1628369')).status,200);

  const profile=await request('/teams/nba/2');assert.equal(profile.status,200);assert.ok((await profile.text()).includes('波士頓塞爾提克'));
  const page=await request('/?league=NBA');assert.equal(page.status,200);assert.ok((await page.text()).includes('NBA・WNBA'));
  assert.deepEqual(await (await request('/api/nba?kind=next&date=2026-09-29')).json(),{day:'2026-10-09'});
  const playoff=await (await request('/api/nba?date=2026-05-04')).json();assert.equal(playoff.games.length,2);assert.ok(playoff.games.every(g=>g.phase===3&&g.state==='final'));
  assert.equal((await fetch(origin+'/api/wnba')).status,401);
  assert.equal((await fetch(origin+'/teams/wnba/16',{redirect:'manual'})).status,307);
  assert.equal((await request('/api/wnba?kind=team&team=999')).status,404);
  assert.equal((await request('/api/wnba?date=2026-02-31')).status,400);
  const wb=await (await request('/api/wnba?date=2026-10-01')).json();assert.equal(wb.games.length,2);assert.ok(wb.games.every(g=>g.home.league==='WNBA'&&g.phase===3));
  const wr=await request('/api/wnba?date=2026-10-01&kind=analysis&game=401918019');assert.equal(wr.status,failure?502:200);if(!failure){const report=await wr.json();assert.equal(report.analysis.status,'ready');assert.equal(report.analysis.model,'wnba-recent-results-v1');}
  assert.equal((await request('/api/wnba?date=2026-10-01&kind=analysis&game=401898392')).status,404);
  assert.equal((await request('/api/wnba?kind=team-season&team=16&season=2027&phase=2')).status,400);
  const wt=await (await request('/api/wnba?kind=team-season&team=16&season=2026&phase=2')).json();assert.equal(wt.games.length,44);
  const roster=await (await request('/api/wnba?kind=team-official&team=16')).json();assert.equal(roster.roster.length,14);
  const wp=await request('/teams/wnba/16');assert.equal(wp.status,200);assert.ok((await wp.text()).includes('華盛頓神秘人'));
  console.log(`WNBA HTTP passed: member auth, Taiwan dates, playoffs, own-league analysis, team records, roster, failure isolation.`);
  console.log(`NBA HTTP passed: member access, navigation, schedule, playoffs, next date, profiles; history ${failure?'unavailable (no forecast)':'available (real-data forecast)'}.`);
 }catch(e){console.error(output);throw e;}finally{child.kill('SIGTERM');if(child.exitCode===null)await new Promise(resolve=>child.once('exit',resolve));}
}
