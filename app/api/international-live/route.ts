import {getRawDb} from '@/db';
import {isSiteAdmin} from '@/app/admin-access';
import {readSession} from '@/lib/arena-session';
import {dayInTaipei} from '@/server/baseball-current.mjs';
import {getInternationalLive as getFeed} from '@/lib/international-feed';
import {withNpbLivePhotos} from '@/lib/international-player-photos';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request){
 try{
  if(!await isSiteAdmin()&&!await readSession(getRawDb(),request.headers.get('cookie')))
   return Response.json({error:'請重新登入；帳號可能已停用或到期。'},{status:401,headers});
  const url=new URL(request.url);
  const league=(url.searchParams.get('league')||'').toUpperCase();
  if(!['NPB','KBO','CPBL'].includes(league))return Response.json({error:'請指定 NPB、KBO 或 CPBL。'},{status:400,headers});
  const date=url.searchParams.get('date')||dayInTaipei();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return Response.json({error:'日期格式不正確。'},{status:400,headers});
  const value=await getFeed(league,date);
  return Response.json({...value,games:value.games?.map(withNpbLivePhotos)},{status:value.status==='unavailable'?503:200,headers});
 }catch{return Response.json({error:'使用權或資料服務暫時無法使用。'},{status:503,headers});}
}
