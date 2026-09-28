import catalog from '@/data/international-player-photos.json';
// NPB handedness markers are not part of a name. English name order and hyphens
// vary between FanGraphs and KBO; never compare names across different teams.
export function playerPhotoKey(name:string){return String(name||'').normalize('NFKC').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/^[\s*＊+＋#＃]+/,'').replace(/[.,'’·・-]/g,' ').trim().toLowerCase().split(/\s+/).filter(Boolean).sort().join('');}
export function withPlayerPhotos(data:any,league:string,code:string,year:number){
 if(year!==catalog.season)return data;
 const team=(catalog.teams as Record<string,Record<string,{url:string;source:string;alternatives?:string[]}>>)[`${league}:${code}`]||{};
 const photos={...(data.photos||{})},photoAlternatives:Record<string,string[]>={},photoSources:Record<string,string>={};
 for(const table of [data.bat,data.pit])for(const row of table?.rows||[]){const entry=team[playerPhotoKey(row[0])];if(!entry)continue;const urls=[entry.url,...entry.alternatives||[],photos[row[0]]].filter(Boolean);photos[row[0]]=urls[0];photoAlternatives[row[0]]=[...new Set(urls)];photoSources[row[0]]=entry.source;}
 return {...data,photos,photoAlternatives,photoSources,photosUpdatedAt:league==='NPB'?catalog.npbCheckedAt:catalog.checkedAt};
}

const npbCodes:Record<string,string>={'1':'g','2':'s','3':'db','4':'d','5':'t','6':'c','7':'l','8':'f','9':'m','11':'b','12':'h','376':'e'};
/** Attach the verified photo catalog on the server, scoped by season and team. */
export function withNpbLivePhotos(game:any){
 if(game.league!=='NPB'||Number(game.date?.slice(0,4))!==catalog.season)return game;
 const photo=(person:any,side:'away'|'home')=>{
  if(!person?.name)return person;
  const team=(catalog.teams as Record<string,Record<string,{url:string;alternatives?:string[]}>>)[`NPB:${npbCodes[String(game[side]?.id)]}`];
  const entry=team?.[playerPhotoKey(person.name)];
  return entry?{...person,photoUrls:[...new Set([entry.url,...entry.alternatives||[]])]}:person;
 };
 const result={...game};
 for(const field of ['lineups','batting','pitching'])if(game[field])result[field]=Object.fromEntries((['away','home'] as const).map(side=>[side,(game[field][side]||[]).map((p:any)=>photo(p,side))]));
 if(game.half==='top'||game.half==='bottom'){
  result.currentBatter=photo(game.currentBatter,game.half==='top'?'away':'home');
  result.currentPitcher=photo(game.currentPitcher,game.half==='top'?'home':'away');
 }
 if(game.playText?.records)result.playText={...game.playText,records:game.playText.records.map((p:any)=>({...p,batter:photo(p.batter,p.half==='top'?'away':'home')}))};
 return result;
}
