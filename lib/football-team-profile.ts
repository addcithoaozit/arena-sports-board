import {FOOTBALL_LEAGUES,footballTeamName,isFootballFormCompetition,validFootballDay,type FootballGame,type FootballLeague,type FootballTeam} from './football';
import {reconcileFootballHistory} from './football-history';

export type FootballVenue='all'|'home'|'away'|'neutral';
export type FootballTeamProfileData={league:FootballLeague;team:FootballTeam;results:FootballGame<string>[];upcoming:FootballGame<string>[]|null;fetchedAt:string};
export const footballTeamHref=(league:FootballLeague,id:string,day?:string)=>`/teams/football/${encodeURIComponent(league)}/${encodeURIComponent(id)}${day&&validFootballDay(day)?'?date='+day:''}`;
export const footballBoardHref=(league:FootballLeague,day?:string)=>'/?'+new URLSearchParams({league:'FOOTBALL',competition:league,...(day&&validFootballDay(day)?{date:day}:{})});
export function footballCompetitionName(code:string){return FOOTBALL_LEAGUES.find(l=>l.code===code)?.name||({'fifa.friendly':'國際友誼賽','fifa.world':'世界盃','fifa.worldq.uefa':'世界盃歐洲區資格賽','uefa.euro':'歐洲國家盃','uefa.euroq':'歐洲國家盃資格賽','uefa.europa':'歐霸','uefa.europa.conf':'歐協聯','eng.fa':'英格蘭足總盃','eng.league_cup':'英格蘭聯賽盃','esp.copa_del_rey':'西班牙國王盃','ger.dfb_pokal':'德國盃','ita.coppa_italia':'義大利盃','fra.coupe_de_france':'法國盃'} as Record<string,string>)[code]||'其他正式賽事';}
export function footballProfileTeam(raw:any,id:string):FootballTeam{
 if(String(raw?.id)!==id||typeof raw?.displayName!=='string'||!raw.displayName.trim())throw Error('球隊資料身分不符');
 return {id,name:footballTeamName(raw.displayName),englishName:raw.displayName};
}
const involves=(game:FootballGame<string>,id:string)=>game.home.id===id||game.away.id===id;
export const footballVenue=(game:FootballGame<string>,id:string):Exclude<FootballVenue,'all'>=>game.neutral?'neutral':game.home.id===id?'home':'away';
export function footballProfileResults(history:FootballGame<string>[],league:FootballLeague,id:string,now=Date.now()){
 return reconcileFootballHistory(history,[]).games.filter(g=>involves(g,id)&&isFootballFormCompetition(g.league,league,true)&&g.state==='final'&&g.statusName==='STATUS_FULL_TIME'&&g.homeScore!==null&&g.awayScore!==null&&Date.parse(g.start)<now&&Date.parse(g.start)>=now-365*86400000).sort((a,b)=>Date.parse(b.start)-Date.parse(a.start));
}
export function footballProfileUpcoming(history:FootballGame<string>[],league:FootballLeague,id:string,now=Date.now()){
 return reconcileFootballHistory(history,[]).games.filter(g=>g.league===league&&involves(g,id)&&g.state==='scheduled'&&Date.parse(g.start)>now).sort((a,b)=>Date.parse(a.start)-Date.parse(b.start)).slice(0,8);
}
export function selectFootballProfileGames(games:FootballGame<string>[],id:string,venue:FootballVenue='all',limit=10){return games.filter(g=>involves(g,id)&&(venue==='all'||footballVenue(g,id)===venue)).slice(0,limit);}
export function summarizeFootballProfile(games:FootballGame<string>[],id:string){
 let wins=0,draws=0,losses=0,scored=0,conceded=0,cleanSheets=0,btts=0,over25=0;const recent:('勝'|'和'|'負')[]=[];
 for(const g of games){if(!involves(g,id)||g.homeScore===null||g.awayScore===null||g.state!=='final'||g.statusName!=='STATUS_FULL_TIME')continue;
  const own=g.home.id===id?g.homeScore:g.awayScore,against=g.home.id===id?g.awayScore:g.homeScore;
  scored+=own;conceded+=against;if(against===0)cleanSheets++;if(own>0&&against>0)btts++;if(own+against>2)over25++;
  if(own>against){wins++;recent.push('勝');}else if(own<against){losses++;recent.push('負');}else{draws++;recent.push('和');}
 }
 const count=wins+draws+losses,rate=(value:number)=>count?value/count:null;
 return {games:count,wins,draws,losses,scored,conceded,goalDifference:scored-conceded,winRate:rate(wins),scoredPerGame:rate(scored),concededPerGame:rate(conceded),cleanSheetRate:rate(cleanSheets),bttsRate:rate(btts),over25Rate:rate(over25),recent:recent.slice(0,5)};
}
