import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const n=await import(moduleUrl('lib/nba.ts')),m=await import(moduleUrl('lib/nba-analysis.ts'));
const read=name=>JSON.parse(readFileSync(`tests/fixtures/nba/${name}.json`,'utf8'));
const now=Date.parse('2026-09-29T16:00:00Z'),game=n.parseNbaEvents(read('future'))[0];
const history=['2','5'].flatMap(t=>[2026,2027].flatMap(y=>[2,3].flatMap(p=>n.parseNbaEvents(read(`team-${t}-${y}-${p}`),t))));
test('real NBA source parses scheduled, regular and playoff feeds with correct team identities and Taiwan days',()=>{
 assert.equal(n.NBA_TEAMS.length,30);assert.equal(new Set(n.NBA_TEAMS.map(t=>t.id)).size,30);
 assert.equal(game.home.name,'克里夫蘭騎士');assert.equal(game.away.name,'波士頓塞爾提克');assert.equal(game.phase,1);assert.equal(game.homeScore,null);assert.equal(n.nbaDay(game.start),'2026-10-09');
 const final=n.parseNbaEvents(read('historical'))[0];assert.equal(final.phase,3);assert.equal(final.homeScore,116);assert.equal(final.awayScore,94);assert.equal(final.quarters.length,4);assert.equal(final.statusLabel,'已完賽');
 assert.equal(n.parseNbaEvents(read('team-2-2026-2'),'2').length,82);assert.equal(n.parseNbaEvents(read('team-2-2026-3'),'2').length,7);
});
test('wrong leagues, swapped feed identity, Summer League and unknown opponents cannot become NBA analysis',()=>{
 const wrong=read('future');wrong.leagues=[{id:'46',slug:'wnba'}];assert.throws(()=>n.parseNbaEvents(wrong));
 assert.throws(()=>n.parseNbaEvents(read('team-2-2026-2'),'5'));
 for(const edit of [r=>r.events[0].uid='s:40~l:99~e:401898392',r=>r.events[0].season.type=4,r=>r.events[0].competitions[0].competitors[0].team.id='999']){const r=read('future');r.events=r.events.slice(0,1);edit(r);assert.deepEqual(n.parseNbaEvents(r),[]);}
});
test('postponed, cancelled, TBD and already started fixtures never offer a pregame estimate',()=>{
 for(const name of ['STATUS_POSTPONED','STATUS_CANCELED','STATUS_SUSPENDED','STATUS_TIME_TBD']){const raw=read('future');raw.events[0].status.type.name=name;raw.events[0].competitions[0].status.type.name=name;assert.equal(m.nbaEligible(n.parseNbaEvents(raw)[0],now),false);}
 const raw=read('future');raw.events[0].competitions[0].timeValid=false;assert.equal(m.nbaEligible(n.parseNbaEvents(raw)[0],now),false);
 const conflicting=read('future');conflicting.events[0].status.type.name='STATUS_POSTPONED';assert.equal(m.nbaEligible(n.parseNbaEvents(conflicting)[0],now),false);
 assert.equal(m.analyzeNba(game,history,Date.parse(game.start)).status,'waiting');assert.equal(m.nbaEligible({...game,start:new Date(now+31*86400000).toISOString()},now),false);
});
test('overtime and halftime render Chinese labels with separate quarter scores',()=>{
 const raw=read('historical');raw.events[0].status.period=5;raw.events[0].competitions[0].status.period=5;raw.events[0].competitions[0].competitors.forEach(c=>c.linescores.push({period:5,value:10}));const g=n.parseNbaEvents(raw)[0];assert.equal(g.statusLabel,'已完賽・延長1');assert.equal(g.quarters[4].home,10);
 raw.events[0].status.type={name:'STATUS_HALFTIME',state:'in',completed:false};raw.events[0].competitions[0].status.type=raw.events[0].status.type;assert.equal(n.parseNbaEvents(raw)[0].statusLabel,'中場休息');
});
test('history deduplicates cross-team games, quarantines contradictory scores and excludes preseason/future/malformed scores',()=>{
 const h=n.nbaHistory(history,'2',now);assert.equal(h.length,89);assert.equal(h[0].phase,3);
 const first=h[0],conflict={...first,homeScore:first.homeScore+1};assert.ok(!n.nbaHistory([...history,conflict],'2',now).some(g=>g.id===first.id));
 const invalid=[{...first,id:'99901',phase:1},{...first,id:'99902',start:new Date(now+1000).toISOString()},{...first,id:'99903',homeScore:null},{...first,id:'99904',awayScore:first.homeScore}];assert.deepEqual(n.nbaHistory(invalid,'2',now),[]);
 assert.equal(n.nbaForm(h,'2',5).games,5);assert.equal(n.nbaForm([],'2').pointsFor,null);
});
test('actual recent results produce finite consistent estimates; preseason and offseason reduce confidence',()=>{
 const a=m.analyzeNba(game,history,now);assert.equal(a.status,'ready');assert.equal(a.homeForm.games,20);assert.equal(a.awayForm.games,20);
 assert.equal(a.probabilities.home+a.probabilities.away,1);assert.ok(a.expected.home>70&&a.expected.home<160);assert.ok(Math.abs(a.expected.home+a.expected.away-a.expected.total)<.001);
 const pick=m.nbaPick(game,a);assert.equal(pick.team.id,a.probabilities.home>a.probabilities.away?game.home.id:game.away.id);assert.ok(pick.probability>.5);
 const regular=m.analyzeNba({...game,phase:2},history,now);assert.ok(Math.abs(a.probabilities.home-.5)<Math.abs(regular.probabilities.home-.5));
 assert.equal(m.analyzeNba(game,[],now).status,'waiting');assert.equal(m.analyzeNba(game,history.filter(g=>g.home.id!=='2'&&g.away.id!=='2'),now).status,'waiting');
 const future={...history[0],id:'88888',state:'final',start:new Date(now+1000).toISOString(),homeScore:200,awayScore:50};assert.deepEqual(m.analyzeNba(game,[...history,future],now),a);
});
test('stale, changed, started or failed boards withdraw exactly the same recommendation used by both surfaces',()=>{
 const report={game,analysis:m.analyzeNba(game,history,now),sourceFetchedAt:new Date(now).toISOString()};assert.ok(m.readyNbaAnalysis(game,report,now));
 for(const [g,r,t,unavailable] of [[game,report,now,true],[{...game,state:'live'},report,now,false],[{...game,start:new Date(now+100000).toISOString()},report,now,false],[game,report,now+600001,false],[game,{...report,sourceFetchedAt:'bad'},now,false],[game,report,Date.parse(game.start),false]])assert.equal(m.readyNbaAnalysis(g,r,t,unavailable),null);
 const bad=structuredClone(report);bad.analysis.probabilities.home=1.2;assert.equal(m.readyNbaAnalysis(game,bad,now),null);
 assert.ok(m.nbaSourceStale(new Date(now-120001).toISOString(),now));
 const tie={...report.analysis,probabilities:{home:.5,away:.5}};assert.equal(m.nbaPick(game,tie),null);
});
test('NBA has its own frontend URL and valid team links without changing baseball/admin routing',async()=>{
 const {frontSelection,leaguePageHref}=await import(moduleUrl('lib/sport-navigation.ts'));
 assert.deepEqual(frontSelection('?league=NBA&view=teams'),{league:'NBA',view:'teams'});assert.equal(leaguePageHref('NBA'),'/?league=NBA&view=analysis');assert.equal(leaguePageHref('KBO'),'/admin/leagues?league=KBO&view=analysis');
 assert.equal(n.nbaTeamHref('2','2026-10-09'),'/teams/nba/2?date=2026-10-09');assert.equal(n.validNbaDay('2026-02-31'),false);assert.equal(n.nbaSeason('2026-10-01'),2027);assert.equal(n.nbaSeason('2026-06-01'),2026);
});
