/** Only fresh, confirmed live games can light a navigation badge. */
export function scheduleLiveUntil(data:any,league:string,day:string,now:number):number{
 const fetched=Date.parse(data?.fetchedAt);
 if(data?.day!==day||data?.error||data?.stale||!Array.isArray(data?.games)||!Number.isFinite(fetched)||fetched>now||now-fetched>=120000)return 0;
 const basketball=league==='NBA'||league==='WNBA';
 if(!basketball&&data.league!==league)return 0;
 return data.games.some((g:any)=>{
  const start=Date.parse(g?.start);
  const matches=basketball?(g?.home?.league||'NBA')===league&&(g?.away?.league||'NBA')===league:g?.league===league;
  return matches&&g?.state==='live'&&g.timeConfirmed===true&&Number.isFinite(start)&&start<=now&&now-start<18*3600000;
 })?fetched+120000:0;
}
