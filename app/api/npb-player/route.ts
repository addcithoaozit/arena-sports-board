import {npbPlayerId,parseNpbPlayer,type NpbPlayerData} from '@/lib/npb-player-profile';
import {npbCatalogPlayer} from '@/lib/international-player-photos';
export const dynamic='force-dynamic';
const cache=new Map<string,{until:number;data:NpbPlayerData}>(),pending=new Map<string,Promise<NpbPlayerData>>();
async function getPlayer(id:string){
 const hit=cache.get(id);if(hit&&hit.until>Date.now())return hit.data;
 if(pending.has(id))return pending.get(id)!;
 const task=(async()=>{
  try{
   const response=await fetch(`https://baseball.yahoo.co.jp/npb/player/${id}/top`,{headers:{'User-Agent':'YJBaseballStats/1.0'},redirect:'error',signal:AbortSignal.timeout(20000),cache:'no-store'});
   if(!response.ok)throw Error('日職資料暫時無法取得');
   const html=await response.text();if(html.length>5000000)throw Error('資料超出上限');
   const data=parseNpbPlayer(html,id),catalog=npbCatalogPlayer(data.player.name,data.player.teamCode);
   if(catalog?.id===id)data.player.photoUrls=[...new Set([...catalog.photoUrls,...data.player.photoUrls])];
   if(cache.size>=100)cache.delete(cache.keys().next().value!);
   cache.set(id,{until:Date.now()+5*60000,data});return data;
  }catch(error){
   if(hit&&Date.now()-Date.parse(hit.data.fetchedAt)<86400000)return {...hit.data,stale:true};
   throw error;
  }
 })().finally(()=>pending.delete(id));pending.set(id,task);return task;
}
export async function GET(request:Request){
 const id=new URL(request.url).searchParams.get('id');
 if(!npbPlayerId(id))return Response.json({error:'無效的日職球員編號'},{status:400});
 try{return Response.json(await getPlayer(id!),{headers:{'Cache-Control':'no-store'}});}
 catch{return Response.json({error:'球員資料暫時無法取得，請稍後重試。'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
