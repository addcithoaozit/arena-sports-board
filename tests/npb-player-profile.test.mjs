import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const {parseNpbPlayer,npbSeasonStats,npbPlayerId}=await import(moduleUrl('lib/npb-player-profile.ts'));
const {withPlayerPhotos,npbCatalogPlayer}=await import(moduleUrl('lib/international-player-photos.ts'));
const fixture=id=>readFileSync(`tests/fixtures/npb-players/${id}.html`,'utf8');
const parse=(id,html=fixture(id))=>parseNpbPlayer(html,id,'2026-09-28T12:00:00Z');
test('batter profile includes real identity, metric units, first-team totals and career colspan alignment',()=>{
 const p=parse('2104697'),g=p.groups.hitting;
 assert.equal(p.player.name,'井坪 陽生');assert.equal(p.player.teamCode,'t');assert.equal(p.player.defaultGroup,'hitting');
 assert.deepEqual(p.player.bio.find(([k])=>k==='身高'),['身高','177 公分']);
 assert.equal(g.season.gamesPlayed,'2');assert.equal(g.season.avg,'.000');assert.equal(g.career.avg,'.150');assert.equal(g.career.gamesPlayed,'8');assert.equal(g.career.ops,'.300');
 assert.equal(g.history.length,2);assert.equal(npbSeasonStats(p,'hitting',2025).avg,'.167');assert.equal(npbSeasonStats(p,'hitting',2023),null);
 assert.equal(g.games.length,6);assert.equal(g.games[0].competition,'二軍例行賽');assert.equal(g.games[0].date,'2026-09-25');assert.equal(g.games[0].team,'福岡軟銀鷹');
 assert.equal(p.groups.pitching.season,null);
});
test('pitcher profile preserves baseball innings, separate hitting stats and mixed competition labels',()=>{
 const p=parse('2106233'),g=p.groups.pitching;
 assert.equal(p.player.defaultGroup,'pitching');assert.equal(g.season.inningsPitched,'17.2');assert.equal(g.season.strikeOuts,'21');assert.equal(g.season.whip,'1.42');
 assert.equal(g.career.inningsPitched,'29');assert.equal(g.career.era,'4.66');assert.equal(g.career.whip,'1.48');assert.equal(g.career.gamesPlayed,'24');
 assert.equal(npbSeasonStats(p,'pitching',2024).inningsPitched,'3.1');
 assert.equal(g.games[0].stat.inningsPitched,'7.1');assert.equal(g.games[1].competition,'二軍交流賽');
 assert.equal(p.groups.hitting.season.atBats,'1');assert.ok(p.groups.hitting.games.some(g=>g.competition==='一軍交流賽'));
});
test('missing first-team summary cannot silently use farm or exhibition figures',()=>{
 const html=fixture('2104697').replace(/<table\b[\s\S]*?<\/table>/,'');
 assert.equal(parse('2104697',html).groups.hitting.season,null);
});
test('source identity, year and numeric fields fail closed',()=>{
 assert.throws(()=>parseNpbPlayer(fixture('2104697'),'2106233'),/識別不符/);
 assert.throws(()=>parse('2104697',fixture('2104697').replace(/2026\/9/g,'2027/9')),/年度/);
 assert.throws(()=>parse('2104697',fixture('2104697').replace(/<time\b[\s\S]*?<\/time>/g,'')),/年度/);
 for(const id of [null,'../2106233','https://example.com','1','2106233?x=1'])assert.equal(npbPlayerId(id),false);
 const p=parse('2106233');assert.equal(p.groups.hitting.history.find(g=>g.season===2024).stat.avg,null);
});
test('traded-season rowspan keeps every team and uses only the published total',()=>{
 let html=fixture('2104697');
 const header='<tr><th>年度</th><th>チーム名</th><th>打率</th></tr>';
 const rows='<tr><td rowspan="3">2025</td><td>阪神</td><td>.100</td></tr><tr><td>中日</td><td>.300</td></tr><tr><td>合計</td><td>.220</td></tr>';
 html=html.replace(/<table\b[^>]*id="year_b"[\s\S]*?<\/table>/,`<table id="year_b" class="bb-playerStatsTable">${header}${rows}</table>`);
 const p=parse('2104697',html);assert.equal(p.groups.hitting.history.length,3);assert.equal(npbSeasonStats(p,'hitting',2025).avg,'.220');
 p.groups.hitting.history.pop();assert.equal(npbSeasonStats(p,'hitting',2025),null);
});
test('NPB roster profile links use verified same-team identities and retain existing photos',()=>{
 const data={bat:{rows:[['井坪 陽生'],['石黒 佑弥']]},pit:{rows:[['石黒 佑弥']]}};
 const p=withPlayerPhotos(data,'NPB','t',2026);assert.equal(p.playerLinks['井坪 陽生'],'/players/international/npb/2104697');assert.equal(p.playerLinks['石黒 佑弥'],'/players/international/npb/2106233');assert.match(p.photos['井坪 陽生'],/2104697\.jpg$/);
 assert.equal(npbCatalogPlayer('井坪 陽生','g'),null);assert.equal(withPlayerPhotos(data,'NPB','t',2025),data);
 assert.equal(npbCatalogPlayer('伊藤 将司','t').id,'2000052');assert.equal(npbCatalogPlayer('糸原 健斗','t').id,'1600117');
});
test('player API rejects invalid ids, coalesces fetches and returns verified profile data',async()=>{
 const {GET}=await import(moduleUrl('app/api/npb-player/route.ts'));const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async url=>{calls++;assert.equal(url,'https://baseball.yahoo.co.jp/npb/player/2106233/top');return new Response(fixture('2106233'));};
 try{
  assert.equal((await GET(new Request('https://app.test/api/npb-player?id=../x'))).status,400);assert.equal(calls,0);
  const results=await Promise.all([1,2].map(()=>GET(new Request('https://app.test/api/npb-player?id=2106233'))));assert.equal(calls,1);
  for(const result of results){assert.equal(result.status,200);const p=await result.json();assert.equal(p.player.name,'石黒 佑弥');assert.match(p.player.photoUrls[0],/2106233\.jpg$/);assert.equal(p.groups.pitching.career.era,'4.66');}
 }finally{globalThis.fetch=original;}
});
