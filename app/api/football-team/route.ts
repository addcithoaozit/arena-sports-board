import {isFootballLeague} from '@/lib/football';
import {footballTeamProfile} from '@/lib/football-source';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const p=new URL(request.url).searchParams,league=p.get('league')||'',team=p.get('team')||'',headers={'Cache-Control':'private, no-store'};
 if(!isFootballLeague(league)||!/^\d{1,12}$/.test(team))return Response.json({error:'足球聯賽或球隊參數錯誤'},{status:400,headers});
 try{return Response.json(await footballTeamProfile(league,team),{headers});}
 catch{return Response.json({error:'球隊資料暫時無法讀取，請稍後重試。'},{status:503,headers});}
}
