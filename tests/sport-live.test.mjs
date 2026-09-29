import {test} from 'node:test';
import assert from 'node:assert/strict';
import {scheduleLiveUntil} from '../lib/sport-live.ts';
const now=Date.parse('2026-09-29T20:00:00Z'),day='2026-09-30';
const game={state:'live',timeConfirmed:true,start:new Date(now-3600000).toISOString(),home:{league:'WNBA'},away:{league:'WNBA'}};
const board={day,fetchedAt:new Date(now-1000).toISOString(),games:[game]};
test('live badge follows actual game state and source freshness',()=>{
 assert.equal(scheduleLiveUntil(board,'WNBA',day,now),now+119000);
 for(const state of ['scheduled','final','other'])assert.equal(scheduleLiveUntil({...board,games:[{...game,state}]},'WNBA',day,now),0);
 for(const patch of [{games:[]},{day:'2026-09-29'},{stale:true},{error:'offline'},{fetchedAt:new Date(now-120000).toISOString()}])assert.equal(scheduleLiveUntil({...board,...patch},'WNBA',day,now),0);
 assert.equal(scheduleLiveUntil(board,'NBA',day,now),0);
 assert.equal(scheduleLiveUntil({...board,games:[{...game,start:new Date(now+60000).toISOString()}]},'WNBA',day,now),0);
 const football={...board,league:'eng.1',games:[{...game,league:'eng.1'}]};
 assert.ok(scheduleLiveUntil(football,'eng.1',day,now)>now);assert.equal(scheduleLiveUntil(football,'esp.1',day,now),0);
});
