'use client';
import {useEffect,useState} from 'react';
import {taipeiDay} from '@/lib/baseball';
import {scheduleLiveUntil} from '@/lib/sport-live';
const sources=[['NBA','/api/nba'],['WNBA','/api/wnba'],...['eng.1','esp.1','ita.1','ger.1','fra.1','uefa.champions','uefa.nations'].map(code=>[code,`/api/football?league=${code}`])] as const;
export function useSportLive(){
 const [until,setUntil]=useState<Record<string,number>>({}),[now,setNow]=useState(Date.now);
 useEffect(()=>{
  const controller=new AbortController();let busy=false;
  async function refresh(){
   if(busy||document.hidden||controller.signal.aborted)return;busy=true;
   const day=taipeiDay(Date.now());
   await Promise.allSettled(sources.map(async([code,url])=>{
    let expiry=0;
    try{const r=await fetch(`${url}${url.includes('?')?'&':'?'}date=${day}`,{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(45000)])});if(!r.ok)throw Error();expiry=scheduleLiveUntil(await r.json(),code,day,Date.now());}catch{}
    if(!controller.signal.aborted)setUntil(old=>({...old,[code]:expiry}));
   }));busy=false;
  }
  const resume=()=>{setNow(Date.now());void refresh();};
  void refresh();const poll=setInterval(()=>void refresh(),30000),clock=setInterval(()=>setNow(Date.now()),15000);
  document.addEventListener('visibilitychange',resume);window.addEventListener('arena-refresh-all',resume);
  return()=>{controller.abort();clearInterval(poll);clearInterval(clock);document.removeEventListener('visibilitychange',resume);window.removeEventListener('arena-refresh-all',resume);};
 },[]);
 return {NBA:(until.NBA||0)>now,WNBA:(until.WNBA||0)>now,FOOTBALL:sources.slice(2).some(([code])=>(until[code]||0)>now)};
}
