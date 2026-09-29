// Run after npm run build. Exercises the real authenticated Next.js API locally.
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
const origin='http://127.0.0.1:3029',cookie='__Host-arena_tz='+'f'.repeat(64);
for(const failStandings of [false,true]){
 const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3029'],{env:{...process.env,YJ_RENDER_HTTP_TEST:'1',YJ_BACKGROUND_REFRESH:'0',DATABASE_URL:'postgresql://local-test/fixture',TZ_BINDING_KEY:Buffer.alloc(32).toString('base64'),PLATFORM_ADMIN_USERNAME:'render-test-admin',APP_ORIGIN:origin,MLB_TEST_STANDINGS_FAILURE:failStandings?'1':'0',NODE_OPTIONS:'--import ./tests/mlb-postseason-http-preload.mjs'},stdio:['ignore','pipe','pipe']});
 let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);
 try{
  let ready=false;for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error(output);try{if((await fetch(origin+'/api/health')).ok){ready=true;break;}}catch{}await delay(250);}
  assert.ok(ready,'server ready');
  assert.equal((await fetch(origin+'/api/baseball?kind=schedule')).status,401);
  const response=await fetch(origin+'/api/baseball?kind=schedule',{headers:{cookie}});assert.equal(response.status,200,await response.clone().text());
  const schedule=await response.json(),games=schedule.games.filter(g=>['849845','849849','849851','849843'].includes(String(g.id)));
  assert.equal(games.length,4);
  for(const g of games){
   assert.equal(g.gameType,'F');assert.equal(g.state,'Preview');assert.equal(g.status,'Scheduled');
   for(const team of [g.away,g.home]){assert.ok(team.pitcherId);assert.ok(team.pitcherEra>=0);assert.ok(team.pitcherWhip>=0);if(failStandings){assert.equal(team.wins,null);assert.equal(team.losses,null);}else assert.ok(team.wins+team.losses>=160);}
   const r=await fetch(origin+'/api/analysis',{method:'POST',headers:{cookie,origin,'content-type':'application/json'},body:JSON.stringify({gameId:g.id})});
   assert.equal(r.status,200,await r.clone().text());const report=await r.json();
   assert.equal(report.game.id,g.id);assert.ok(!report.issues.some(issue=>/已開賽|非可分析/.test(issue)));
   if(failStandings)assert.equal(report.trialWin.homeWin,null);else assert.ok(report.trialWin.homeWin>0&&report.trialWin.homeWin<1);
   assert.equal(report.candidate.modelApplied,false);
  }
  console.log(`Postseason HTTP: four fixtures and analyses passed; standings ${failStandings?'unavailable (no invented records)':'available'}.`);
 }catch(error){console.error(output);throw error;}
 finally{child.kill('SIGTERM');await new Promise(resolve=>child.once('exit',resolve));}
}
