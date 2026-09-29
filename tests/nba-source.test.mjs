import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const read=name=>JSON.parse(readFileSync(`tests/fixtures/nba/${name}.json`,'utf8'));
const RealDate=Date,now=Date.parse('2026-09-29T16:00:00Z'),native=fetch;
let serial=0;
async function setup(run,override){
 const paths=[];globalThis.Date=class extends RealDate{constructor(...a){super(...(a.length?a:[now]));}static now(){return now;}};
 globalThis.fetch=async input=>{const u=new URL(input);paths.push(u.pathname+u.search);const fault=override?.(u);if(fault)return fault;
  if(u.pathname.endsWith('/summary'))return Response.json(JSON.parse(readFileSync('tests/fixtures/basketball-efficiency/nba-boxes.json','utf8'))[u.searchParams.get('event')]);
  const team=u.pathname.match(/teams\/(\d+)\/schedule/);if(team)return Response.json(read(Number(u.searchParams.get('seasontype'))===1?'current':`team-${team[1]}-${u.searchParams.get('season')}-${u.searchParams.get('seasontype')}`));
  const day=u.searchParams.get('dates');if(day==='20261008')return Response.json(read('future'));
  const empty=read('today');empty.leagues[0].calendar=['2026-10-08T07:00Z'];return Response.json(empty);
 };
 try{await run(await import(moduleUrl('lib/nba-source.ts')+'#test'+serial++),paths);}finally{globalThis.Date=RealDate;globalThis.fetch=native;}
}
test('schedule spans source days, returns Taiwan day and avoids duplicate fixtures',async()=>setup(async s=>{const b=await s.nbaSchedule('2026-10-09');assert.equal(b.games.length,6);assert.ok(b.games.every(g=>new RealDate(new RealDate(g.start).getTime()+8*3600000).toISOString().startsWith('2026-10-09')));assert.equal(b.source,'ESPN');}));
test('offseason next-date search reads next-season calendar and resolves the actual Taiwan date',async()=>setup(async(s,paths)=>{assert.deepEqual(await s.nextNbaDay('2026-09-29'),{day:'2026-10-09'});assert.ok(paths.some(p=>p.includes('dates=20261029')));}));
test('analysis requests regular and postseason in both years; cache shares public requests',async()=>setup(async(s,paths)=>{
 const result=await s.nbaGameAnalysis('2026-10-09','401898392');assert.equal(result.analysis.status,'ready');assert.equal(result.game.home.id,'5');const count=paths.length;
 await s.nbaGameAnalysis('2026-10-09','401898392');assert.equal(paths.length,count);
 for(const t of ['2','5'])for(const y of [2026,2027])for(const p of [2,3])assert.ok(paths.some(x=>x.includes(`/teams/${t}/schedule?season=${y}&seasontype=${p}`)));
 assert.equal(await s.nbaGameAnalysis('2026-10-09','999999'),null);
}));
test('current postseason failure cannot be hidden by older successful history',async()=>setup(async s=>{await assert.rejects(s.nbaGameAnalysis('2026-10-09','401898392'));},u=>u.pathname.includes('/teams/5/')&&u.searchParams.get('season')==='2027'&&u.searchParams.get('seasontype')==='3'?new Response('',{status:503}):null));
test('incomplete final scores cannot silently remove the latest game and leave an older forecast',async()=>setup(async s=>{await assert.rejects(s.nbaGameAnalysis('2026-10-09','401898392'));},u=>{if(!u.pathname.includes('/teams/5/')||u.searchParams.get('season')!=='2026'||u.searchParams.get('seasontype')!=='3')return null;const d=read('team-5-2026-3');delete d.events.at(-1).competitions[0].competitors[0].score;return Response.json(d);}));
test('wrong season or wrong team history fails closed',async()=>{for(const mode of ['team','season'])await setup(async s=>{await assert.rejects(s.nbaGameAnalysis('2026-10-09','401898392'));},u=>{if(!u.pathname.includes('/teams/5/'))return null;const wrong=read('team-5-2026-2');if(mode==='team')wrong.team.id='2';else wrong.requestedSeason.year=2025;return Response.json(wrong);});});
test('NBA team profiles expose recent formal games plus real upcoming preseason fixtures',async()=>setup(async s=>{const p=await s.nbaTeamProfile('2');assert.equal(p.team.name,'波士頓塞爾提克');assert.equal(p.results.length,89);assert.equal(p.upcoming[0].phase,1);assert.ok(p.upcoming.every(g=>Date.parse(g.start)>now));}));
