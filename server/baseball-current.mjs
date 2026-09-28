import {npbGameStart,recoverNpbPregameState} from './baseball-npb-start.mjs';
import {recoverKboPregameState} from './baseball-pregame-state.mjs';
import {collectLeague as collectBase,fetchPublic,dayInTaipei,npbScheduleIds,parseNpb,validateGame} from './baseball-live-providers.mjs';
import {addNpbLive} from './baseball-npb-live.mjs';
import {addNpbContext} from './baseball-npb-context.mjs';
import {enrichLeaguePlayText} from './baseball-play-text.mjs';
import {collectCpblCurrent} from './cpbl-current.mjs';
export {dayInTaipei} from './baseball-live-providers.mjs';
/** Match the exact opaque game ID from the dated schedule, not team-name guesses. */
export async function collectLeague(league,options={}){
 const deadline=AbortSignal.timeout(35000),original=options.fetcher||fetch;
 options={...options,fetcher:(url,init={})=>original(url,{...init,signal:init.signal?AbortSignal.any([deadline,init.signal]):deadline})};
 if(league==='CPBL')return enrichLeaguePlayText(await collectCpblCurrent(options),options);
 if(league!=='NPB'){
  const result=await collectBase(league,options);
  if(league==='KBO')result.games.forEach(recoverKboPregameState);
  return enrichLeaguePlayText(result,options);
 }
 const date=options.date||dayInTaipei(),fetcher=options.fetcher||fetch;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw new Error('Invalid date');
 const schedule=await fetchPublic('https://baseball.yahoo.co.jp/npb/schedule/?date='+date,fetcher);
 const ids=npbScheduleIds(schedule.text),games=[],errors=[],npbTextPages=new Map();
 if(!ids.length)throw new Error('No recognizable first-team schedule; not proof of no games');
 const anchors=[...schedule.text.matchAll(/<a\b[^>]*href=["'][^"']*\/npb\/game\/(\d+)\/(?:index|score)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)];
 await Promise.all(ids.map(async id=>{
  try{
   const card=anchors.find(m=>m[1]===id&&/bb-score__homeLogo/.test(m[2]));
   if(!card)throw new Error('Exact schedule identity card missing');
   const root='https://baseball.yahoo.co.jp/npb/game/'+id;
   const requests=await Promise.allSettled([fetchPublic(root+'/top',fetcher),fetchPublic(root+'/stats',fetcher),fetchPublic(root+'/score',fetcher),fetchPublic(root+'/text',fetcher)]);
   const top=requests[0].status==='fulfilled'?requests[0].value:null,stats=requests[1].status==='fulfilled'?requests[1].value:null,score=requests[2].status==='fulfilled'?requests[2].value:null;
   npbTextPages.set(id,requests[3].status==='fulfilled'?requests[3].value:null);
   let page=score||top;if(!page)throw Error('NPB game pages unavailable');
   if(!stats)errors.push(id+':stats unavailable');
   let g;
   try{g=parseNpb(page.text+'\n'+card[0],stats?.text||'',id,page);if(score)addNpbLive(g,score);}
   catch(e){if(!top||page===top)throw e;errors.push(id+':live '+e.message);page=top;g=parseNpb(top.text+'\n'+card[0],stats?.text||'',id,top);}
   g.startTime=npbGameStart(top?.text||page.text,id,g.date,g.startTime);
   recoverNpbPregameState(g);
   if(g.date!==date)throw new Error('Requested date differs from game date: '+g.date);
   try{if(top)addNpbContext(g,top);}catch(e){errors.push(id+':starters '+e.message);}
   g.source.supportingSources=[{url:schedule.url,fetchedAt:schedule.fetchedAt},...(stats?[{url:stats.url,fetchedAt:stats.fetchedAt}]:[])];
   validateGame(g);g.warnings=[...new Set(g.warnings)];
   games.push(g);
  }catch(e){errors.push(id+': '+e.message);}
 }));
 return enrichLeaguePlayText({schemaVersion:1,league,date,collectedAt:new Date().toISOString(),games,errors,status:errors.length?'partial':'ok',liveLatencyVerified:false},{...options,npbTextPages});
}
