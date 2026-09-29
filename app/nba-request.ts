'use client';
export async function nbaRequest(url:string,signal:AbortSignal){
 const r=await fetch(url,{cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(url.includes('kind=analysis')?90000:55000)])});
 if(r.status===401){window.location.assign('/login');throw Error('請重新登入');}
 const d=await r.json();if(!r.ok)throw Error(d.error||'NBA 資料更新失敗');return d;
}
