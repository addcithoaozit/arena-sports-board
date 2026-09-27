import {footballDay,isFootballLeague,validFootballDay} from '@/lib/football';
import {footballGameAnalysis,footballSchedule,nextFootballDay} from '@/lib/football-source';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  const p=new URL(request.url).searchParams,league=p.get('league')||'eng.1',day=p.get('date')||footballDay(),kind=p.get('kind')||'schedule';
  const headers={'Cache-Control':'private, no-store'};
  if(!isFootballLeague(league)||!validFootballDay(day)||Math.abs(Date.parse(day)-Date.parse(footballDay()))>370*86400000||!['schedule','analysis','next'].includes(kind))return Response.json({error:'足球聯賽或日期參數錯誤'},{status:400,headers});
  try{
    if(kind==='next')return Response.json(await nextFootballDay(league,day),{headers});
    if(kind==='analysis'){
      const id=p.get('game')||'';if(!/^\d{1,12}$/.test(id))return Response.json({error:'無效賽事編號'},{status:400,headers});
      const result=await footballGameAnalysis(league,day,id);return result?Response.json(result,{headers}):Response.json({error:'本日找不到此賽事，請更新賽程'},{status:404,headers});
    }
    const {calendar,...data}=await footballSchedule(league,day);return Response.json(data,{headers});
  }catch{return Response.json({error:'足球資料暫時無法更新，請稍後重試。'},{status:502,headers});}
}
