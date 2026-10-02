// Refresh primary identity/venue evidence. Publish files only after every feed succeeds.
import {readFileSync, writeFileSync, renameSync, mkdirSync} from 'node:fs';
import {moduleUrl} from '../../tests/profile-loader.mjs';
const {parseFootballEvents}=await import(moduleUrl('lib/football.ts'));
const leagues=['uefa.champions','uefa.nations','uefa.euro','uefa.euroq','fifa.world','fifa.worldq.uefa','fifa.friendly'];
const senior=new Set(JSON.parse(readFileSync('data/football/national-history.json')).refreshTeams);
export function primaryEvidence(data,league){
 if(!Array.isArray(data?.events)||data.events.length>=1000)throw Error('Primary fixture feed incomplete');
 const events=new Map(data.events.map(e=>[String(e.id),e]));
 return parseFootballEvents(data,league).filter(g=>league==='uefa.champions'||senior.has(g.home.id)||senior.has(g.away.id)).map(g=>{
  const event=events.get(g.id),raw=event?.competitions?.[0],home=raw?.competitors?.find(t=>t.homeAway==='home'),away=raw?.competitors?.find(t=>t.homeAway==='away');
  return {id:g.id,league:g.league,start:g.start,state:g.state,statusName:g.statusName,
   home:{id:g.home.id,englishName:g.home.englishName},away:{id:g.away.id,englishName:g.away.englishName},
   homeScore:g.homeScore,awayScore:g.awayScore,neutral:g.neutral,neutralVerified:typeof raw?.neutralSite==='boolean',
   venueCountry:raw?.venue?.address?.country||'',venueId:String(raw?.venue?.id||''),homeVenueId:String(home?.team?.venue?.id||''),awayVenueId:String(away?.team?.venue?.id||''),stage:event?.season?.slug||'',roundLabel:raw?.altGameNote||''};
 });
}
export async function refresh(request=fetch,now=Date.now()){
 const year=new Date(now).getUTCFullYear(),prepared=[];
 for(const y of [year-1,year]){
  const games=new Map();
  for(const league of leagues){
   const response=await request(`https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/scoreboard?dates=${y}&limit=1000`,{signal:AbortSignal.timeout(25000)});
   if(!response.ok)throw Error(`Primary source HTTP ${response.status}: ${league}`);
   const body=await response.text();if(body.length>12000000)throw Error('Primary response too large');
   const rows=primaryEvidence(JSON.parse(body),league);
   for(const g of rows){
    if(g.start.slice(0,4)!==String(y))throw Error('Primary fixture year mismatch');
    const old=games.get(g.id);if(old&&JSON.stringify(old)!==JSON.stringify(g))throw Error('Primary fixture identity conflict');games.set(g.id,g);
   }
  }
  const rows=[...games.values()].sort((a,b)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id));
  if(!rows.length)throw Error('Primary year unexpectedly empty');
  const teams=Object.fromEntries(rows.flatMap(g=>[g.home,g.away]).map(t=>[t.id,t.englishName]));
  prepared.push([`data/football/cup-fixtures/${y}.json`,JSON.stringify({schemaVersion:1,refreshedAt:new Date(now).toISOString(),teams,games:rows})+'\n']);
 }
 mkdirSync('data/football/cup-fixtures',{recursive:true});
 for(const [path,body] of prepared)writeFileSync(path+'.tmp',body);
 for(const [path] of prepared)renameSync(path+'.tmp',path);
 console.log(JSON.stringify({refreshedYears:[year-1,year],feeds:leagues.length*2}));
}
if(process.argv[1]?.endsWith('/refresh_espn.mjs'))await refresh();
