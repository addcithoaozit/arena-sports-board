// Run after npm run build. Uses an isolated in-memory PostgreSQL fixture.
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
const origin='http://127.0.0.1:3028',cookie='__Host-arena_tz='+'f'.repeat(64);
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3028'],{env:{...process.env,YJ_RENDER_HTTP_TEST:'1',YJ_BACKGROUND_REFRESH:'0',DATABASE_URL:'postgresql://local-test/fixture',TZ_BINDING_KEY:Buffer.alloc(32).toString('base64'),PLATFORM_ADMIN_USERNAME:'render-test-admin',APP_ORIGIN:origin,NODE_OPTIONS:'--import ./tests/render-http-preload.mjs'},stdio:['ignore','pipe','pipe']});
let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);
try{
 let ready=false;for(let i=0;i<80;i++){if(child.exitCode!==null)throw Error(output);try{if((await fetch(origin+'/api/health')).ok){ready=true;break;}}catch{}await delay(250);}
 assert.ok(ready,'server ready');
 for(const [path,auth,expected] of [['/api/football',false,401],['/api/football?kind=validation',false,401],['/api/football?kind=validation',true,200],['/api/football?league=invalid',true,400],['/api/football?date=2026-02-30',true,400],['/api/football?kind=analysis&game=abc',true,400],['/?league=FOOTBALL',true,200]]){
  const r=await fetch(origin+path,{headers:auth?{cookie}:{}});assert.equal(r.status,expected,path);
  if(path.includes('kind=validation')&&auth){const d=await r.json();assert.equal(d.validation.historyGames,11033);assert.equal(d.live.available,true);assert.equal(Number(d.live.counts.snapshots),0);}
  if(path.startsWith('/?'))assert.match(await r.text(),/足球/);
 }
 console.log('Football HTTP smoke passed: authentication, invalid input and rendered navigation.');
}catch(e){console.error(output);throw e;}
finally{child.kill('SIGTERM');}
