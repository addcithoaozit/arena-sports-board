import {parseInternational,sourceLinks} from '@/lib/international';
import {getInternationalPregame} from '@/lib/international-feed';
import {baseballBackgroundStatus} from '@/server/baseball-background-state.mjs';
import {npbProfileLinks} from '@/lib/international-player-photos';
export const dynamic='force-dynamic';
type Entry={data:any;until:number};
const memory=new Map<string,Entry>();
const lastGood=new Map<string,any>();
export async function GET(request:Request){
 const u=new URL(request.url),kind=u.searchParams.get('kind')||'sources',year=new Date().getUTCFullYear();
 const respond=(data:any)=>Response.json({...data,...(kind==='npb-starters'?{playerLinks:npbProfileLinks(year)}:{})},{headers:{'Cache-Control':'no-store'}});
 if(kind==='sources')return Response.json({sources:sourceLinks},{headers:{'Cache-Control':'no-store'}});
 if(/^(npb|kbo|cpbl)-pregame$/.test(kind)){
  const date=u.searchParams.get('date')||undefined;
  if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date))return Response.json({error:'無效的賽事日期'},{status:400});
  const data=await getInternationalPregame(kind.split('-')[0].toUpperCase(),date),background=baseballBackgroundStatus();
  return Response.json({...data,automaticBackgroundSync:background.enabled,background,scope:background.enabled?'伺服器運行期間背景更新；休眠與重啟仍會中斷。歷史欄位保留原時間。':data.scope},{headers:{'Cache-Control':'no-store'}});
 }
 if(kind==='cpbl-schedule'){
  const key=`cpbl-schedule-${year}`,cached=memory.get(key);if(cached&&cached.until>Date.now())return Response.json(cached.data);
  const teams=['台鋼','味全','統一','富邦','樂天','中信'];
  const results=await Promise.all(teams.map(async team=>{try{
   const source=`https://tw.sports.yahoo.com/cpbl/teams/${encodeURIComponent(team)}/`;
   const r=await fetch(source,{headers:{'User-Agent':'ArenaSportsBoard/1.0','Accept':'text/html'},signal:AbortSignal.timeout(15000)});if(!r.ok)throw new Error();
   return parseInternational(await r.text(),kind,year);
  }catch{return null;}}));
  const games=new Map<string,any>();for(const result of results)for(const game of result?.games||[])games.set(game.id,game);
  const failed=teams.filter((_,i)=>!results[i]);const checkedAt=new Date().toISOString();
  const data={kind,status:games.size?(failed.length?'stale':'ready'):'unavailable',games:[...games.values()].sort((a,b)=>a.label.localeCompare(b.label)),tables:[],fetchedAt:games.size?checkedAt:null,checkedAt,error:failed.length?`${failed.join('、')}賽程讀取失敗；目前結果可能不完整`:null,scope:'Yahoo 中職例行賽；台灣時間，非逐球即時更新'};
  memory.set(key,{data,until:Date.now()+(failed.length?60000:300000)});return Response.json(data,{headers:{'Cache-Control':'no-store'}});
 }
 let source='';
 if(/^(npb|kbo)-(bat|pit)$/.test(kind)){const [league,stats]=kind.split('-');source=`https://www.fangraphs.com/leaders/international/${league}?stats=${stats}&season=${year}&season1=${year}&qual=0&pageitems=2000&pagenum=1`;}
 else if(kind==='npb-starters')source='https://npb.jp/announcement/starter/';
 else if(kind==='cpbl-standings')source=`https://tw.sports.yahoo.com/cpbl/standings/?season=${year}`;
 else if(kind==='cpbl-game'){
  try{const link=new URL(u.searchParams.get('url')||'');if(link.origin!=='https://tw.sports.yahoo.com'||!/^\/cpbl\/[^/]+-\d{9}\/$/.test(link.pathname)||link.search||link.hash)throw new Error();source=link.href;}catch{return Response.json({error:'無效的中職場次'},{status:400});}
 }
 else if(kind==='npb-roster')source='https://npb.jp/announcement/roster/';
 else if(kind==='kbo-schedule')source='https://eng.koreabaseball.com/Schedule/DailySchedule.aspx';
 else if(kind==='npb-standings')source='https://baseball.yahoo.co.jp/npb/standings/';
 else if(kind==='kbo-standings')source='https://www.koreabaseball.com/Record/TeamRank/TeamRankDaily.aspx';
 else if(kind==='npb-schedule')source='https://baseball.yahoo.co.jp/npb/';
 else if(kind==='npb-preview'&&/^\d{6,12}$/.test(u.searchParams.get('id')||''))source=`https://baseball.yahoo.co.jp/npb/game/${u.searchParams.get('id')}/top`;
 else if(kind==='npb-game'&&/^\d{6,12}$/.test(u.searchParams.get('id')||''))source=`https://baseball.yahoo.co.jp/npb/game/${u.searchParams.get('id')}/stats`;
 else return Response.json({error:'不支援的來源或比賽編號'},{status:400});
 const key=source,current=memory.get(key);
 if(current&&current.until>Date.now())return respond(current.data);
 const result=await (async()=>{
  const checkedAt=new Date().toISOString();
  try{
   const r=await fetch(source,{headers:{'User-Agent':'ArenaSportsBoard/1.0','Accept':'text/html'},redirect:'manual',signal:AbortSignal.timeout(15000)});
   if(!r.ok)throw new Error(`來源回覆 HTTP ${r.status}${r.status===403?'：拒絕此伺服器讀取':r.status===429?'：請求頻率受限':''}`);
   const html=await r.text();if(html.length>12000000)throw new Error('資料超出讀取上限');
   const result=parseInternational(html,kind,year);
   const data={...result,status:'ready',source,checkedAt,fetchedAt:checkedAt,error:null,kind};
   lastGood.set(key,data);return data;
  }catch(e){const old=lastGood.get(key);return {...old,tables:old?.tables||[],games:old?.games||[],status:old?'stale':'unavailable',source,kind,checkedAt,fetchedAt:old?.fetchedAt||null,error:e instanceof Error?e.message:'來源連線失敗'};}
 })().then(data=>{if(memory.size>80){const first=memory.keys().next().value!;memory.delete(first);lastGood.delete(first);}memory.set(key,{data,until:Date.now()+(data.status==='ready'?600000:300000)});return data;});
 return respond(result);
}
