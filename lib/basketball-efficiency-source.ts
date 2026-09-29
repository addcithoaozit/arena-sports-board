import {nbaFixtureKey,type NbaGame} from './nba';
import {analyzeEfficiency,efficiencyHistory,parseEfficiencyBox,type BasketballLeague,type EfficiencyBox,type Weights,DEFAULT_WEIGHTS} from './basketball-efficiency';
const cache=new Map<string,{box:EfficiencyBox;expires:number}>(),pending=new Map<string,Promise<EfficiencyBox>>();
let active=0;const queue:(()=>void)[]=[];
async function box(game:NbaGame,league:BasketballLeague){
 const key=`${league}:${nbaFixtureKey(game)}:${game.homeScore}:${game.awayScore}`,hit=cache.get(key);if(hit&&hit.expires>Date.now())return hit.box;if(pending.has(key))return pending.get(key)!;
 if(queue.length>=160)throw Error('效率資料更新忙碌中');
 const task=(async()=>{if(active>=8)await new Promise<void>(r=>queue.push(r));else active++;
  try{const response=await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/${league.toLowerCase()}/summary?event=${game.id}`,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!response.ok)throw Error('效率數據無法取得');
   const reader=response.body?.getReader();if(!reader)throw Error('效率數據內容為空');const parts:Uint8Array[]=[];let size=0;
   try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>6000000){await reader.cancel();throw Error('效率數據過大');}parts.push(r.value);}}finally{reader.releaseLock();}
   const result=parseEfficiencyBox(JSON.parse(Buffer.concat(parts).toString('utf8')),game,league);if(cache.size>=1200)cache.delete(cache.keys().next().value!);cache.set(key,{box:result,expires:Date.now()+24*3600000});return result;
  }finally{const next=queue.shift();if(next)next();else active--;}
 })().finally(()=>pending.delete(key));pending.set(key,task);return task;
}
export async function efficiencyGameAnalysis(game:NbaGame,history:NbaGame[],league:BasketballLeague,weights:Weights=DEFAULT_WEIGHTS){
 const now=Date.now(),home=efficiencyHistory(game,history,game.home.id,league,now),away=efficiencyHistory(game,history,game.away.id,league,now);
 if(home.length<8||away.length<8)return analyzeEfficiency(game,history,[],league,weights,now);
 const unique=[...new Map([...home,...away].map(g=>[g.id,g])).values()],boxes=await Promise.all(unique.map(g=>box(g,league)));
 return analyzeEfficiency(game,history,boxes,league,weights,Date.now());
}
