import {test} from 'node:test';
import assert from 'node:assert/strict';
import {moduleUrl} from './profile-loader.mjs';
const {FootballOpponentXgHistory,opponentCorrectedDistribution}=await import(moduleUrl('lib/football-opponent-xg.ts'));
const DAY=86400000,start=Date.parse('2025-01-01T00:00:00Z');
const g=(i,h='h',a='a')=>({id:String(i),league:'eng.1',start:new Date(start+i*DAY).toISOString(),homeId:h,awayId:a,homeGoals:2,awayGoals:1,homeXg:1.8,awayXg:.7,neutral:false});
const history=()=>{const s=new FootballOpponentXgHistory({decayDays:90,lookbackDays:365});for(let i=0;i<8;i++)s.addDay([g(i)]);return s;};
test('only previous UTC days can influence an observation',()=>{
 const s=history(),cut=start+8*DAY,before=s.features('h','a',cut);
 assert.equal(before.enough,true);s.addDay([{...g(8),homeGoals:15,homeXg:15}]);
 assert.deepEqual(s.features('h','a',cut),before);
 assert.equal(s.features('h','a',start).enough,false);
});
test('missing xG, old history and duplicates cannot satisfy coverage',()=>{
 const s=new FootballOpponentXgHistory({decayDays:180,lookbackDays:730});
 for(let i=0;i<8;i++)s.addDay([{...g(i),homeXg:i<3?null:1.8,awayXg:i<3?null:.7}]);
 assert.equal(s.features('h','a',start+8*DAY).enough,false);
 assert.equal(history().features('h','a',start+200*DAY).enough,false);
 assert.throws(()=>s.addDay([g(7)]),/賽果無效/);
 assert.throws(()=>s.addDay([g(0)]),/日期順序/);
});
test('opponent adjustment respects neutral-team swap and produces consistent markets',()=>{
 const s=history(),f=s.features('h','a',start+8*DAY),p={decayDays:90,lookbackDays:365,blend:.5,coefficients:[.03,-.02,.2,.3,.4,.3],tilts:[.01,-.01,.02]};
 const a=opponentCorrectedDistribution({home:1.6,away:.9},f.values,p,true);
 const b=opponentCorrectedDistribution({home:.9,away:1.6},[f.values[1],f.values[0]],p,true);
 assert.ok(Math.abs(a.probabilities.home-b.probabilities.away)<1e-12);
 assert.ok(Math.abs(a.probabilities.home+a.probabilities.draw+a.probabilities.away-1)<1e-12);
 assert.ok(Math.abs(a.probabilities.over25+a.probabilities.under25-1)<1e-12);
 assert.ok(a.probabilities.btts>=0&&a.probabilities.btts<=1);
 assert.throws(()=>opponentCorrectedDistribution({home:NaN,away:1},f.values,p),/數值無效/);
});
