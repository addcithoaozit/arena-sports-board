import {requestOrigin} from '@/lib/request-origin';
import {GET as sourceGET} from '../baseball/route';
import {assembleAnalysis,type AnalysisReport} from '@/lib/pregame-analysis';
import {isPregame,type Match} from '@/lib/baseball';
import {getRawDb} from '@/db';
export const dynamic='force-dynamic';
const pending=new Map<number,Promise<AnalysisReport>>(),reports=new Map<number,{until:number;data:AnalysisReport}>();
const rosters=new Map<number,{until:number;value:any}>();
export async function loadSource(kind:string){const r=await sourceGET(new Request('https://arena.internal/api/baseball?kind='+kind));if(!r.ok)throw new Error('來源不可用');return r.json();}
async function roster(id:number){
 const cached=rosters.get(id);if(cached&&cached.until>Date.now())return cached.value;
 const source=`https://statsapi.mlb.com/api/v1/teams/${id}/roster?rosterType=40Man&hydrate=person`;
 const r=await fetch(source,{signal:AbortSignal.timeout(8000)});if(!r.ok)throw new Error('球員名單未取得');const data=await r.json();if(!Array.isArray(data.roster)||!data.roster.length)throw new Error('球員名單格式不符');
 const value={source,fetchedAt:new Date().toISOString(),players:data.roster.map((p:any)=>({id:p.person.id,name:p.person.fullName,bats:p.person.batSide?.code,throws:p.person.pitchHand?.code,position:p.position?.abbreviation}))};
 if(rosters.size>=30)rosters.delete(rosters.keys().next().value!);rosters.set(id,{until:Date.now()+3600000,value});return value;
}
async function build(id:number){
 const schedule=await loadSource('schedule'),g:Match|undefined=schedule.games.find((g:Match)=>g.id===id);
 if(!g||!isPregame(g,Date.now()))throw new Error('本場已開賽、賽事類型不支援或不在近期賽程');
 const tasks:[string,()=>Promise<any>][]=['lineups','bullpen','fg-injuries','fg-bat-left','fg-bat-right','fg-pit-left','fg-pit-right','runs','super007','covers-odds','fg-park'].map(k=>[k,()=>loadSource(k)]);
 for(const s of [g.away,g.home]){tasks.push(['roster-'+s.id,()=>roster(s.id)]);if(s.pitcherId)tasks.push(['pitcher-'+s.pitcherId,()=>loadSource('pitcher-history&pitcherId='+s.pitcherId)]);}
 const input:Record<string,any>={};
 tasks.push(['retrosheet',()=>loadSource('retrosheet&awayId='+g.away.id+'&homeId='+g.home.id+'&before='+new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(g.date)))]);
 await Promise.all(tasks.map(async([key,run])=>{try{input[key]=await run();}catch{input[key]={error:true};}}));
 const cutoff=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(g.date));
 for(const side of ['away','home'] as const){const id=g[side].pitcherId;if(id){try{input['statcast-'+side]=await loadSource('statcast-pitcher&pitcherId='+id+'&before='+cutoff);}catch{input['statcast-'+side]=null;}}}
 const report=assembleAnalysis(g,input);
 if(!isPregame(g,Date.now()))throw new Error('資料收集期間已到開賽時間，停止賽前分析');
 return report;
}
export async function POST(request:Request){
 const origin=request.headers.get('origin');if(origin&&origin!==requestOrigin(request))return Response.json({error:'來源不符'},{status:403});
 try{
  const body=await request.json(),id=body?.gameId;if(!Number.isInteger(id)||id<=0)return Response.json({error:'無效賽事'},{status:400});
  const c=reports.get(id);let report:AnalysisReport;
  if(c&&c.until>Date.now()&&isPregame(c.data.game,Date.now()))report=c.data;
  else {let task=pending.get(id);if(!task){task=build(id).finally(()=>pending.delete(id));pending.set(id,task);}report=await task;if(reports.size>=40)reports.delete(reports.keys().next().value!);reports.set(id,{until:Date.now()+60000,data:report});}
  let storage:AnalysisReport['storage']={saved:false,reason:'已到開賽時間'};
  if(isPregame(report.game,Date.now())){
   try{const db=getRawDb(),slot=Math.floor(Date.parse(report.capturedAt)/300000);await db.prepare('INSERT INTO analysis_snapshots (id,game_id,start_time,captured_at,version,payload) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET start_time=excluded.start_time,captured_at=excluded.captured_at,version=excluded.version,payload=excluded.payload WHERE excluded.captured_at>analysis_snapshots.captured_at').bind(`${id}:${slot}`,id,report.game.date,report.capturedAt,report.version,JSON.stringify(report)).run();storage={saved:true};}
   catch{storage={saved:false,reason:'分析已完成，但雲端紀錄儲存失敗，稍後重試'};}
  }
  return Response.json({...report,storage},{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'本場分析暫不可用；可能已開賽或來源更新失敗'},{status:503});}
}
