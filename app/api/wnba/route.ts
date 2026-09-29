import {parseWeights} from '@/lib/basketball-efficiency';
import {wnbaRoster} from '@/lib/wnba-roster';
import {wnbaDay,wnbaSeason,wnbaTeam,validWnbaDay} from '@/lib/wnba';
import {wnbaGameAnalysis,wnbaSchedule,wnbaTeamProfile,wnbaTeamSeasonProfile,nextWnbaDay} from '@/lib/wnba-source';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const p=new URL(request.url).searchParams,kind=p.get('kind')||'schedule',day=p.get('date')||wnbaDay();
 const headers={'Cache-Control':'private, no-store'};
 if(!['schedule','analysis','next','team','team-season','team-official'].includes(kind)||!validWnbaDay(day)||Math.abs(Date.parse(day)-Date.parse(wnbaDay()))>370*86400000)return Response.json({error:'WNBA 查詢參數錯誤'},{status:400,headers});
 try{
  if(kind==='team-official'||kind==='team-season'){
   const id=p.get('team')||'';if(!wnbaTeam(id))return Response.json({error:'球隊不存在'},{status:404,headers});
   if(kind==='team-official')return Response.json(await wnbaRoster(id),{headers});
   const season=Number(p.get('season')),phase=Number(p.get('phase'));
   if(!Number.isInteger(season)||season<1997||season>wnbaSeason(wnbaDay())||![1,2,3].includes(phase))return Response.json({error:'球季查詢錯誤'},{status:400,headers});
   return Response.json(await wnbaTeamSeasonProfile(id,season,phase),{headers});
  }
  if(kind==='team'){const id=p.get('team')||'';if(!wnbaTeam(id))return Response.json({error:'球隊不存在'},{status:404,headers});return Response.json(await wnbaTeamProfile(id),{headers});}
  if(kind==='next')return Response.json(await nextWnbaDay(day),{headers});
  if(kind==='analysis'){
   const id=p.get('game')||'';if(!/^\d{1,12}$/.test(id))return Response.json({error:'賽事編號錯誤'},{status:400,headers});
   let weights;try{weights=parseWeights(p.get('weights'));}catch{return Response.json({error:'分析權重錯誤'},{status:400,headers});}
   const result=await wnbaGameAnalysis(day,id,weights);return result?Response.json(result,{headers}):Response.json({error:'本日查無此賽事'},{status:404,headers});
  }
  return Response.json(await wnbaSchedule(day),{headers});
 }catch{return Response.json({error:'WNBA 資料暫時無法更新，請稍後重試。'},{status:502,headers});}
}
