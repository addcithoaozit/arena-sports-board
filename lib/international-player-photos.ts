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
