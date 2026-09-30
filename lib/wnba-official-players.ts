import snapshot from '../data/wnba-player-identities.json';
export type WnbaOfficialPlayer={id:number;name:string;slug:string;teamSlug:string;height:string;weight:string;school:string;country:string;draftYear:string;season:number;points:number|null;rebounds:number|null;assists:number|null};
const clean=(v:unknown)=>typeof v==='string'&&!['-','N/A'].includes(v.trim())?v.trim():'';
export const wnbaNameKey=(v:string)=>v.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function parseWnbaOfficialPlayers(data:any):WnbaOfficialPlayer[]{
 const p=data?.props?.pageProps,season=Number(p?.defaultSeason);
 if(!Number.isInteger(season)||season<1997||!Array.isArray(p.currentPlayersData)||p.currentPlayersData.length<100)throw Error('WNBA 官網球員格式不符');
 const seen=new Set<number>();const num=(v:any)=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
 return p.currentPlayersData.map((r:any)=>{
  if(!Array.isArray(r)||r.length<25||!Number.isSafeInteger(r[0])||r[0]<=0||seen.has(r[0])||!clean(r[1])||!clean(r[2])||!/^[-a-z0-9]+$/.test(r[3]))throw Error('WNBA 官網球員身分不符');seen.add(r[0]);
  const seasonStats=r[24]==='Season'&&String(r[20])===String(p.defaultSeason);
  return {id:r[0],name:`${r[2]} ${r[1]}`,slug:r[3],teamSlug:clean(r[5]),height:clean(r[11]),weight:clean(r[12]),school:clean(r[13]),country:clean(r[14]),draftYear:r[15]?String(r[15]):'',season,points:seasonStats?num(r[21]):null,rebounds:seasonStats?num(r[22]):null,assists:seasonStats?num(r[23]):null};
 });
}
let cache:{players:WnbaOfficialPlayer[];until:number}|undefined,pending:Promise<WnbaOfficialPlayer[]>|undefined;
export async function wnbaOfficialPlayers(){
 if(cache&&cache.until>Date.now())return cache.players;if(pending)return pending;
 pending=(async()=>{
  const r=await fetch('https://www.wnba.com/players',{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('WNBA 官網無法更新');
  const html=await r.text();if(html.length>6000000)throw Error('WNBA 官網資料過大');
  const json=html.match(/<script\b[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/)?.[1];if(!json)throw Error('WNBA 官網資料缺漏');
  const players=parseWnbaOfficialPlayers(JSON.parse(json));cache={players,until:Date.now()+15*60000};return players;
 })().finally(()=>{pending=undefined;});return pending;
}
const slugs:Record<string,string>={'20':'dream','19':'sky','18':'sun','3':'wings','129689':'valkyries','5':'fever','17':'aces','6':'sparks','8':'lynx','9':'liberty','11':'mercury','132052':'fire','14':'storm','131935':'tempo','16':'mystics'};
export function enrichWnbaPlayer<T extends {id:number;name:string;height:string;weight:string;school:string;photo:string;href:string}>(player:T,teamId:string,season:number,official:WnbaOfficialPlayer[]){
 const matches=official.filter(p=>wnbaNameKey(p.name)===wnbaNameKey(player.name));
 const saved=(snapshot.players as Record<string,any>)[String(player.id)];
 const validSaved=saved&&wnbaNameKey(saved.name)===wnbaNameKey(player.name)?saved:null;
 const p=matches.length===1?matches[0]:matches.length===0?validSaved:null;
 if(!p)return {...player,photoFallback:'',country:'',draftYear:'',averages:null};
 // A saved mapping is only a fallback for stable identity/bio fields, never current stats or team assignment.
 if(validSaved&&p.id!==validSaved.id)return {...player,photoFallback:'',country:'',draftYear:'',averages:null};
 const sameSeason=matches.length===1&&p.season===season&&p.teamSlug===slugs[teamId];
 return {...player,officialId:p.id,photo:validSaved?.photoOverride||`https://cdn.wnba.com/headshots/wnba/latest/1040x760/${p.id}.png`,photoFallback:player.photo,href:`https://www.wnba.com/player/${p.id}/${p.slug}`,height:player.height||p.height,weight:player.weight||p.weight,school:player.school||p.school,country:p.country,draftYear:p.draftYear,averages:sameSeason&&[p.points,p.rebounds,p.assists].some(v=>v!==null)?{season,points:p.points,rebounds:p.rebounds,assists:p.assists}:null};
}
