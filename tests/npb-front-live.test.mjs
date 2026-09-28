import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {addNpbLive} from '../server/baseball-npb-live.mjs';
import {parseNpbPlayText,enrichGamePlayText} from '../server/baseball-play-text.mjs';
import {moduleUrl} from './profile-loader.mjs';
const {internationalTeam}=await import(moduleUrl('lib/international-teams.ts'));
const {internationalTextEvents,currentTextPlay}=await import(moduleUrl('lib/international-play-text.ts'));
const {withNpbLivePhotos}=await import(moduleUrl('lib/international-player-photos.ts'));
const {frontSelection,leaguePageHref}=await import(moduleUrl('lib/sport-navigation.ts'));
const read=name=>readFileSync('tests/fixtures/npb-live/'+name,'utf8');
const game=(id='2021039468')=>({...JSON.parse(read(id+'.json')),warnings:[],source:{url:`https://baseball.yahoo.co.jp/npb/game/${id}/score`,fetchedAt:new Date().toISOString()}});
const page=(g,kind='score')=>({text:read(g.id+'-'+kind+'.html'),url:`https://baseball.yahoo.co.jp/npb/game/${g.id}/${kind}`,fetchedAt:new Date().toISOString()});
test('dated Sportsnavi capture supplies actual batter, pitcher, BSO, occupied bases and chronological pitches',()=>{
 const g=game();addNpbLive(g,page(g));
 assert.equal(g.currentBatter.name,'マッカスカー');assert.equal(g.currentPitcher.name,'山田 陽翔');assert.equal(g.currentPitcher.pitchCount,8);
 assert.deepEqual([g.balls,g.strikes,g.outs],[3,2,1]);assert.deepEqual(g.bases,[true,true,false]);
 assert.deepEqual(g.currentAtBat.pitches.map(p=>p.number),[1,2,3,4,5]);assert.equal(g.currentAtBat.pitches.at(-1).description,'壞球');assert.equal(currentTextPlay(g,false).pitches.length,5);
 assert.equal(currentTextPlay(g,true),null);g.currentAtBat.batterId='wrong';assert.equal(currentTextPlay(g,false),null);
});
test('half-inning ending and final games never expose the previous batter as current',()=>{
 const g=game('2021039469');addNpbLive(g,page(g));assert.equal(g.outs,3);assert.equal(g.currentBatter,null);assert.equal(g.currentAtBat,null);
 const final={...game(),status:'final'};addNpbLive(final,page(final));assert.equal(final.currentBatter,undefined);
});
test('current-state identity guards reject wrong game, date, batting team, inning and contradictory runners',()=>{
 for(const mutate of [p=>p.url+='?index=0110100',p=>p.text=p.text.replace('2026年9月28日','2026年9月27日'),p=>p.text=p.text.replace('team376','team8'),p=>p.text=p.text.replace('1回表','2回表'),p=>p.text=p.text.replace('class="b110"','class="b100"')]){
  const g=game(),p=page(g);mutate(p);assert.throws(()=>addNpbLive(g,p));assert.equal(g.currentBatter,undefined);
 }
});
test('real reverse-ordered text renders after frontend name normalization and keeps stable event IDs',()=>{
 const g=game('2021039469'),p=page(g,'text');g.playText=parseNpbPlayText(p.text,g,p);
 const old=g.playText.records;assert.equal(old.length,8);assert.deepEqual(old.filter(r=>r.half==='bottom').map(r=>r.sequence),[1,2,3]);
 g.away.name=internationalTeam(g.away.name,'NPB');g.home.name=internationalTeam(g.home.name,'NPB');assert.equal(internationalTextEvents(g).length,8);
 const legacy=structuredClone(g);delete legacy.playText.awayId;delete legacy.playText.homeId;assert.equal(internationalTextEvents(legacy).length,8);
 const changed=structuredClone(g);changed.playText.awayId='7';assert.equal(internationalTextEvents(changed).length,0);
 const wrongName=structuredClone(g);wrongName.playText.away='西武獅';assert.equal(internationalTextEvents(wrongName).length,0);
 const removed=p.text.replace(/<li class="bb-liveText__item">[\s\S]*?<\/li>/,'');
 const remaining=parseNpbPlayText(removed,g,p).records;for(const event of remaining)assert.deepEqual(old.find(x=>x.id===event.id),event);
});
test('NPB live and historical batters receive verified real photos only for their own team and season',()=>{
 const g=game();addNpbLive(g,page(g));const p=page(g,'text');g.playText=parseNpbPlayText(p.text,g,p);
 const result=withNpbLivePhotos(g);assert.match(result.currentBatter.photoUrls[0],/376\/2122300.jpg/);assert.ok(result.playText.records.every(p=>p.batter?.photoUrls?.length));
 assert.equal(g.currentBatter.photoUrls,undefined);assert.equal(withNpbLivePhotos({...g,date:'2025-09-28'}).currentBatter.photoUrls,undefined);
 const wrong={...g,away:{...g.away,id:'8'}};assert.equal(withNpbLivePhotos(wrong).currentBatter.photoUrls,undefined);
});
test('prefetched text avoids another network round and failed text leaves score data intact',async()=>{
 const g=game(),p=page(g,'text'),options={store:new Map(),npbTextPages:new Map([[g.id,p]]),fetcher:()=>{throw Error('extra network request')}};
 const result=await enrichGamePlayText(g,options);assert.equal(result.playText.records.length,5);
 const unavailable=await enrichGamePlayText(g,{...options,store:new Map(),npbTextPages:new Map([[g.id,null]])});assert.equal(unavailable.playText.status,'unavailable');assert.deepEqual(unavailable.away,g.away);
});
test('MLB and NPB are frontend baseball views while CPBL and KBO keep admin links',()=>{
 assert.deepEqual(frontSelection('?league=NPB&view=live'),{league:'NPB',view:'live'});
 assert.deepEqual(frontSelection('?league=KBO&view=bad'),{league:'MLB',view:'analysis'});
 assert.equal(leaguePageHref('NPB','teams'),'/?league=NPB&view=teams');assert.equal(leaguePageHref('MLB'),'/?league=MLB&view=analysis');assert.equal(leaguePageHref('KBO','teams'),'/admin/leagues?league=KBO&view=teams');
});
