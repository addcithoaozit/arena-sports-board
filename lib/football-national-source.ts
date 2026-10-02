import seed from '../data/football/national-history.json';
import {parseFootballTeamHistory,type FootballGame,type FootballTeam} from './football';
import {reconcileFootballHistory} from './football-history';
export type NationalPool={games:FootballGame<string>[];fetchedAt:string};
const HOUR=3600000,teams=seed.teams as Record<string,FootballTeam>;
const seeded:NationalPool={fetchedAt:seed.asOf,games:seed.rows.map(row=>{
  const [id,league,start,home,away,homeScore,awayScore,neutral]=row as [string,string,string,string,string,number,number,boolean];
  return {id,league,start,season:new Date(start).getUTCFullYear(),home:teams[home],away:teams[away],homeScore,awayScore,neutral,state:'final',statusName:'STATUS_FULL_TIME',statusLabel:'完場',timeConfirmed:true,venue:'',sourceUrl:`https://www.espn.com/soccer/match/_/gameId/${id}`};
})};
let cached=seeded,pending:Promise<NationalPool|null>|null=null,retryAt=0;
export const nationalPoolFresh=(pool:NationalPool,now:number)=>Number.isFinite(Date.parse(pool.fetchedAt))&&Date.parse(pool.fetchedAt)<=now+5000&&now-Date.parse(pool.fetchedAt)<48*HOUR;
// Shared public context, bounded to six requests and twelve seconds; no member credentials.
export async function loadNationalFootballPool(now=Date.now(),request:(url:string,init?:RequestInit)=>Promise<Response>=fetch):Promise<NationalPool|null>{
  const age=now-Date.parse(cached.fetchedAt);
  if((age>=0&&age<6*HOUR)||now<retryAt)return nationalPoolFresh(cached,now)?cached:null;
  if(pending)return pending;
  pending=(async()=>{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000),all:FootballGame<string>[][]=[];
    let next=0,failed=false;
    try{
      await Promise.all(Array.from({length:6},async()=>{
        while(next<seed.refreshTeams.length&&!controller.signal.aborted){
          const team=seed.refreshTeams[next++];
          try{
            const response=await request(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/${team}/schedule?season=${new Date(now).getUTCFullYear()}&limit=100`,{cache:'no-store',signal:controller.signal});
            if(!response.ok)throw Error('國家隊來源未完成');
            const text=await response.text();if(text.length>2000000)throw Error('來源資料過大');
            const data=JSON.parse(text);if(data.events?.length>=100)throw Error('國家隊來源超出上限');
            const games=parseFootballTeamHistory(data,team,'uefa.nations',true);if(!games.length)throw Error('國家隊來源沒有賽果');all.push(games);
          }catch{failed=true;}
        }
      }));
      // A partially refreshed opponent network must not be reported as fully fresh.
      if(!failed&&all.length===seed.refreshTeams.length){
        const merged=reconcileFootballHistory(all.flat(),cached.games);
        const games=merged.games.filter(g=>Date.parse(g.start)>=now-730*24*HOUR&&Date.parse(g.start)<now&&g.state==='final'&&g.statusName==='STATUS_FULL_TIME');
        if(games.length>=100)cached={games,fetchedAt:new Date(now).toISOString()};
      }
    }finally{clearTimeout(timer);retryAt=now+10*60000;}
    return nationalPoolFresh(cached,now)?cached:null;
  })().finally(()=>{pending=null;});
  return pending;
}
// Cross-provider identity uses exact normalized senior-country names, never fuzzy matching.
const countryKey=(name:string)=>{
  const key=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z]/g,'');
  return ({turkiye:'turkey',republicofireland:'ireland',czechrepublic:'czechia',bosniaandherzegovina:'bosniaherzegovina'} as Record<string,string>)[key]||key;
};
export function canonicalNationalGame<L extends string>(game:FootballGame<L>):FootballGame<L>|null{
  const resolve=(team:FootballTeam)=>{
    if(teams[team.id])return teams[team.id];
    const matches=Object.values(teams).filter(t=>countryKey(t.englishName)===countryKey(team.englishName));
    return matches.length===1?matches[0]:null;
  };
  const home=resolve(game.home),away=resolve(game.away);return home&&away&&home.id!==away.id?{...game,home,away}:null;
}
export function mergeNationalProviderHistory(current:FootballGame<string>[],pool:NationalPool){
  const key=(g:FootballGame<string>)=>[g.league,g.start,g.home.id,g.away.id].join('|'),known=new Map(pool.games.map(g=>[key(g),g]));
  const converted=current.flatMap(g=>{
    const mapped=canonicalNationalGame(g);if(!mapped)return [];
    const original=known.get(key(mapped));
    // Retain verified tournament neutrality when a provider omits that field.
    return [{...mapped,id:original?.id||mapped.id,neutral:original?.neutral??mapped.neutral}];
  });
  return reconcileFootballHistory(converted,pool.games).games;
}

