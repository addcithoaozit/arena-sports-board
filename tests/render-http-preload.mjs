// Isolated HTTP smoke fixture. Never set YJ_RENDER_HTTP_TEST on a real service.
import pg from 'pg';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
if(process.env.YJ_RENDER_HTTP_TEST!=='1')throw Error('Test-only fixture');
const database=new PGlite({parsers:{20:Number,114:s=>s,3802:s=>s}});
await database.exec('BEGIN;'+await readFile(new URL('../db/render-schema.sql',import.meta.url),'utf8')+'COMMIT;SET search_path TO yj_platform_v1,pg_catalog;');
const expires=Date.now()+3600000;
for(const [id,name] of [['tz:1','render-test-admin'],['tz:2','pending-test-user']])await database.query('INSERT INTO tz_bindings(member_id,source_user_id,username,device_id,encrypted_token,expires_at,verified_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',[id,id,name,'test-device','test-ciphertext',expires,Date.now()]);
await database.query('INSERT INTO account_access VALUES ($1,1,NULL,$2)',['tz:1',Date.now()]);
await database.query('INSERT INTO arena_sessions VALUES ($1,$2,$3)',[createHash('sha256').update('f'.repeat(64)).digest('hex'),'tz:1',expires]);
// An approved non-admin account is needed only for the football admin gate smoke.
if(process.env.YJ_FOOTBALL_ADMIN_SMOKE==='1'){
 await database.query('INSERT INTO tz_bindings(member_id,source_user_id,username,device_id,encrypted_token,expires_at,verified_at) VALUES ($1,$2,$3,$4,$5,$6,$7)',['tz:3','tz:3','football-test-member','test-device','test-ciphertext',expires,Date.now()]);
 await database.query('INSERT INTO account_access VALUES ($1,1,NULL,$2)',['tz:3',Date.now()]);
 await database.query('INSERT INTO arena_sessions VALUES ($1,$2,$3)',[createHash('sha256').update('e'.repeat(64)).digest('hex'),'tz:3',expires]);
}
class TestPool{
 async query(sql,values=[]){
  if(sql.startsWith('-- Additive')){await database.exec(sql);return {rows:[],rowCount:0};}
  const result=await database.query(sql,values);return {...result,rowCount:result.affectedRows};
 }
 async connect(){return {query:this.query.bind(this),release(){}};}
 async end(){}
}
pg.Pool=TestPool;
