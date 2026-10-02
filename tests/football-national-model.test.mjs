import {test} from 'node:test';
import assert from 'node:assert/strict';
import {moduleUrl} from './profile-loader.mjs';
const f=await import(moduleUrl('lib/football.ts'));
const m=await import(moduleUrl('lib/football-national-model.ts'));
const s=await import(moduleUrl('lib/football-national-source.ts'));
const now=Date.parse('2026-10-02T12:48:00Z'),pool=await s.loadNationalFootballPool(now);
const fit=m.fitNationalFootball(pool.games,now);
const home={id:'478',name:'法國',englishName:'France'},away={id:'162',name:'義大利',englishName:'Italy'};
const game={id:'401861103',league:'uefa.nations',season:2026,start:'2026-10-02T18:45:00Z',timeConfirmed:true,home,away,homeScore:null,awayScore:null,state:'scheduled',statusName:'STATUS_SCHEDULED',statusLabel:'未開賽',neutral:false,venue:'',sourceUrl:''};
test('pooled opponent model has bounded normalized probabilities without team-name overrides',()=>{
 assert.ok(fit&&fit.games>=600);const base=f.analyzeFootball(game,pool.games,now,pool.games),a=m.applyNationalFootballModel(game,base,pool.games,now);
 assert.equal(a.status,'ready');assert.equal(a.version,m.NATIONAL_MODEL_VERSION);assert.equal(a.calibration.status,'baseline');assert.ok(Math.abs(a.probabilities.home+a.probabilities.draw+a.probabilities.away-1)<1e-10);assert.ok(Math.abs(a.probabilities.over25+a.probabilities.under25-1)<1e-10);
 assert.ok(a.probabilities.home>a.probabilities.away);assert.ok(a.probabilities.home>.5&&a.probabilities.home<.6);
 assert.deepEqual(m.nationalExpectedGoals({...game,home:{...home,name:'另一隊',englishName:'Other'},away:{...away,name:'隨機',englishName:'Other'}},fit,now),a.expected);
});
test('future results, duplicate records and other sports competitions cannot influence the fit',()=>{
 const duplicate=[...pool.games,...pool.games],future={...pool.games[0],id:'future',start:game.start,homeScore:20},club={...pool.games[0],id:'club',league:'eng.1',homeScore:20};
 const again=m.fitNationalFootball([...duplicate,future,club],now);assert.deepEqual(again,fit);
});
test('conflicting results are quarantined, extra time and penalty scores excluded',()=>{
 const first=pool.games[0],conflict={...first,homeScore:first.homeScore+1};
 assert.deepEqual(m.fitNationalFootball([...pool.games,conflict],now),m.fitNationalFootball(pool.games.filter(g=>g.id!==first.id),now));
 for(const statusName of ['STATUS_FINAL_AET','STATUS_FINAL_PEN'])assert.deepEqual(m.fitNationalFootball([...pool.games,{...first,id:statusName,statusName,homeScore:20}],now),fit);
});
test('neutral venue swaps are symmetric and real home effect is learned from the pool',()=>{
 const a=m.nationalExpectedGoals({...game,neutral:true},fit,now),b=m.nationalExpectedGoals({...game,home:away,away:home,neutral:true},fit,now);
 assert.equal(a.home,b.away);assert.equal(a.away,b.home);assert.ok(Number.isFinite(fit.homeEffect));
 assert.equal(f.footballNeutralVenue('fifa.world',{neutralSite:false,venue:{address:{country:'USA'}}},'France','England'),true);
 assert.equal(f.footballNeutralVenue('uefa.euro',{neutralSite:false,venue:{address:{country:'Germany'}}},'Germany','France'),false);
 assert.equal(f.footballNeutralVenue('eng.1',{neutralSite:false,venue:{address:{country:'England'}}},'Arsenal','Chelsea'),false);
});
test('missing opponent network and thin team history never create confident fallback picks',()=>{
 assert.equal(m.fitNationalFootball(pool.games.slice(0,20),now),null);
 assert.equal(m.nationalExpectedGoals({...game,home:{...home,id:'unknown'}},fit,now),null);
 const sparse=structuredClone(fit);sparse.teams[home.id].effectiveGames=2;assert.equal(m.nationalExpectedGoals(game,sparse,now),null);
 const base=f.analyzeFootball(game,pool.games,now,pool.games),result=m.applyNationalFootballModel(game,base,[],now);assert.equal(result.status,'waiting');assert.equal(result.probabilities,undefined);
});
test('closed games cannot be re-predicted and stale context is rejected',()=>{
 const closed={...game,state:'final'},base=f.analyzeFootball(closed,pool.games,now,pool.games);
 assert.deepEqual(m.applyNationalFootballModel(closed,base,pool.games,now),base);
 assert.equal(s.nationalPoolFresh(pool,now+49*3600000),false);assert.equal(s.nationalPoolFresh(pool,now-60000),false);
});
test('source outage preserves a recent snapshot but cannot silently renew stale history',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>{throw Error('offline');};
 try{const recent=await s.loadNationalFootballPool(now+7*3600000);assert.equal(recent.fetchedAt,pool.fetchedAt);assert.equal(await s.loadNationalFootballPool(now+49*3600000),null);}finally{globalThis.fetch=original;}
});
test('BBC country identities resolve exactly to the same model and duplicate fixture scores are not double-counted',()=>{
 const bbc={...game,id:'bbc:fixture',home:{...home,id:'bbc:france'},away:{...away,id:'bbc:italy'}};
 assert.deepEqual(m.nationalExpectedGoals(s.canonicalNationalGame(bbc),fit,now),m.nationalExpectedGoals(game,fit,now));
 assert.equal(s.canonicalNationalGame({...bbc,home:{...bbc.home,englishName:'France U21'}}),null);
 const original=pool.games.find(g=>g.home.id==='478'||g.away.id==='478');
 const mapped={...original,id:'bbc:old',neutral:false,home:{...original.home,id:'bbc:'+original.home.id},away:{...original.away,id:'bbc:'+original.away.id}};
 const merged=s.mergeNationalProviderHistory([mapped],pool);assert.equal(merged.length,pool.games.length);assert.equal(merged.find(g=>g.id===original.id).neutral,original.neutral);
});
