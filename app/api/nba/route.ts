import {officialTeamProfile,officialPlayerProfile} from '@/lib/nba-official';
import {nbaDay,nbaSeason,nbaTeam,validNbaDay} from '@/lib/nba';
import {nbaGameAnalysis,nbaSchedule,nbaTeamProfile,nbaTeamSeasonProfile,nextNbaDay} from '@/lib/nba-source';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const p=new URL(request.url).searchParams,kind=p.get('kind')||'schedule',day=p.get('date')||nbaDay();
 const headers={'Cache-Control':'private, no-store'};
 if(!['schedule','analysis','next','team','team-season','team-official','player'].includes(kind)||!validNbaDay(day)||Math.abs(Date.parse(day)-Date.parse(nbaDay()))>370*86400000)return Response.json({error:'NBA 查詢參數錯誤'},{status:400,headers});
 try{
  if(kind==='player'){
   const id=p.get('player')||'';if(!/^\d{1,10}$/.test(id)||Number(id)<=0)return Response.json({error:'球員編號錯誤'},{status:400,headers});
   const player=await officialPlayerProfile(Number(id));return player?Response.json(player,{headers}):Response.json({error:'查無此球員'},{status:404,headers});
  }
  if(kind==='team-official'||kind==='team-season'){
   const id=p.get('team')||'';if(!nbaTeam(id))return Response.json({error:'球隊不存在'},{status:404,headers});
   if(kind==='team-official')return Response.json(await officialTeamProfile(id),{headers});
   const season=Number(p.get('season')),phase=Number(p.get('phase'));
   if(!Number.isInteger(season)||season<2001||season>nbaSeason(nbaDay())||![1,2,3].includes(phase))return Response.json({error:'球季查詢錯誤'},{status:400,headers});
   return Response.json(await nbaTeamSeasonProfile(id,season,phase),{headers});
  }
  if(kind==='team'){const id=p.get('team')||'';if(!nbaTeam(id))return Response.json({error:'球隊不存在'},{status:404,headers});return Response.json(await nbaTeamProfile(id),{headers});}
  if(kind==='next')return Response.json(await nextNbaDay(day),{headers});
  if(kind==='analysis'){
   const id=p.get('game')||'';if(!/^\d{1,12}$/.test(id))return Response.json({error:'賽事編號錯誤'},{status:400,headers});
   const result=await nbaGameAnalysis(day,id);return result?Response.json(result,{headers}):Response.json({error:'本日查無此賽事'},{status:404,headers});
  }
  return Response.json(await nbaSchedule(day),{headers});
 }catch{return Response.json({error:'NBA 資料暫時無法更新，請稍後重試。'},{status:502,headers});}
}
