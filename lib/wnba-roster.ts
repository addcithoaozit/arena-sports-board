import {wnbaTeam} from './wnba';
const cache=new Map<string,{value:ReturnType<typeof parseWnbaRoster>;until:number}>(),pending=new Map<string,Promise<ReturnType<typeof parseWnbaRoster>>>();
export function parseWnbaRoster(raw:any,id:string){
 const team=wnbaTeam(id);if(!team||String(raw?.team?.id)!==id||!Array.isArray(raw.athletes)||!Number.isInteger(raw.season?.year))throw Error('WNBA 球員名單不符');
 const roster=raw.athletes.map((p:any)=>{if(!/^\d{1,10}$/.test(String(p.id))||!/^s:40~l:59~a:\d+$/.test(p.uid)||!p.displayName)throw Error('WNBA 球員資料不符');return {id:Number(p.id),name:String(p.displayName),number:String(p.jersey||''),position:String(p.position?.abbreviation||''),height:String(p.displayHeight||''),weight:typeof p.weight==='number'?String(p.weight):'',experience:String(p.experience?.years??''),school:String(p.college?.name||''),season:String(raw.season.year),slug:'',photo:`https://a.espncdn.com/i/headshots/wnba/players/full/${p.id}.png`,href:`https://www.espn.com/wnba/player/stats/_/id/${p.id}`};});
 const coach=raw.coach?.[0];
 return {team,season:String(raw.season.year),rosterSeason:String(raw.season.year),roster,background:{coach:coach?[coach.firstName,coach.lastName].filter(Boolean).join(' '):''},recordSummary:String(raw.team.recordSummary||''),sourceLabel:'WNBA',sourceUrl:`https://www.espn.com/wnba/team/_/name/${team.code.toLowerCase()}`};
}
export async function wnbaRoster(id:string){
 if(!wnbaTeam(id))throw Error('球隊不存在');const hit=cache.get(id);if(hit&&hit.until>Date.now())return hit.value;if(pending.has(id))return pending.get(id)!;
 const task=(async()=>{const r=await fetch(`https://site.api.espn.com/apis/site/v2/sports/basketball/wnba/teams/${id}/roster`,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('WNBA 球員資料更新失敗');const text=await r.text();if(text.length>3000000)throw Error('WNBA 球員資料過大');const value=parseWnbaRoster(JSON.parse(text),id);cache.set(id,{value,until:Date.now()+15*60000});return value;})().finally(()=>pending.delete(id));pending.set(id,task);return task;
}
