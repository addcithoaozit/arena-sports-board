// Run after npm run build. Uses an isolated in-memory PostgreSQL fixture.
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
const origin='http://127.0.0.1:3028',cookie='__Host-arena_tz='+'f'.repeat(64);
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3028'],{env:{...process.env,YJ_RENDER_HTTP_TEST:'1',YJ_FOOTBALL_ADMIN_SMOKE:'1',YJ_BACKGROUND_REFRESH:'0',DATABASE_URL:'postgresql://local-test/fixture',TZ_BINDING_KEY:Buffer.alloc(32).toString('base64'),PLATFORM_ADMIN_USERNAME:'render-test-admin',APP_ORIGIN:origin,NODE_OPTIONS:'--import ./tests/render-http-preload.mjs'},stdio:['ignore','pipe','pipe']});
let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);
try{
 let ready=false;for(let i=0;i<80;i++){if(child.exitCode!==null)throw Error(output);try{if((await fetch(origin+'/api/health')).ok){ready=true;break;}}catch{}await delay(250);}
 assert.ok(ready,'server ready');
 for(const [path,auth,expected] of [['/api/football',false,401],['/api/football?kind=validation',false,401],['/api/football?kind=validation',true,400],['/api/admin/football-validation',false,401],['/api/admin/football-validation',true,200],['/admin',true,200],['/api/football?league=invalid',true,400],['/api/football?date=2026-02-30',true,400],['/api/football?kind=analysis&game=abc',true,400],['/?league=FOOTBALL',true,200]]){
  const r=await fetch(origin+path,{headers:auth?{cookie}:{}});assert.equal(r.status,expected,path);
  if(path==='/api/admin/football-validation'&&auth){const d=await r.json();assert.equal(d.validation.historyGames,11033);assert.equal(d.live.available,true);assert.equal(Number(d.live.counts.snapshots),0);}
  if(path.startsWith('/?')){const html=await r.text();assert.match(html,/足球/);assert.doesNotMatch(html,/回測、模型不足與上線後驗證|分析方式與資料範圍/);}
  if(path==='/admin'){const html=await r.text();assert.match(html,/足球模型與回測管理/);assert.match(html,/回測、模型不足與上線後驗證/);assert.match(html,/分析方式與資料範圍/);assert.match(html,/查看聯賽/);}
 }
 const memberHeaders={cookie:'__Host-arena_tz='+'e'.repeat(64)};
 assert.equal((await fetch(origin+'/api/session',{headers:memberHeaders})).status,200);
 assert.equal((await fetch(origin+'/api/admin/football-validation',{headers:memberHeaders})).status,403);
 const memberFront=await fetch(origin+'/?league=FOOTBALL',{headers:memberHeaders});assert.equal(memberFront.status,200);assert.doesNotMatch(await memberFront.text(),/回測、模型不足與上線後驗證|分析方式與資料範圍/);
 const memberAdmin=await fetch(origin+'/admin',{headers:memberHeaders});assert.doesNotMatch(await memberAdmin.text(),/足球模型與回測管理/);
 console.log('Football HTTP smoke passed: front-end removal, admin controls, admin-only API, approved-member denial and authentication.');
}catch(e){console.error(output);throw e;}
finally{child.kill('SIGTERM');}
