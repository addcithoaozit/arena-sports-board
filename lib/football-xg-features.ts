import {footballForm,type FootballGame,type FootballLeague} from './football';
export type ExternalFootballGame={id:string;league:FootballLeague;start:string;homeId:string;awayId:string;homeGoals:number;awayGoals:number;homeXg:number|null;awayXg:number|null;neutral:boolean};
export type ExternalFeatureOptions={decayDays:number;venueWeight:number};
export const externalDayCutoff=(start:string)=>Date.parse(start.slice(0,10)+'T00:00:00Z');
export function externalAsGame(g:ExternalFootballGame):FootballGame{
 const team=(id:string)=>({id,name:id,englishName:id});
 return {id:g.id,league:g.league,start:g.start,season:Number(g.start.slice(0,4)),timeConfirmed:true,home:team(g.homeId),away:team(g.awayId),homeScore:g.homeGoals,awayScore:g.awayGoals,state:'final',statusName:'STATUS_FULL_TIME',statusLabel:'完場',neutral:g.neutral,venue:'',sourceUrl:''};
}
export function externalFootballForm(teamId:string,venue:'home'|'away',rows:ExternalFootballGame[],before:number,neutral:boolean,options:ExternalFeatureOptions){
 const history=[...new Map(rows.filter(g=>Date.parse(g.start)<before&&Date.parse(g.start)>=before-365*86400000&&(g.homeId===teamId||g.awayId===teamId)).map(g=>[g.id,g])).values()].sort((a,b)=>Date.parse(b.start)-Date.parse(a.start)).slice(0,20);
 const goals=footballForm(teamId,venue,history.map(externalAsGame),before,neutral,options);
 const xgRows=history.filter(g=>g.homeXg!==null&&g.awayXg!==null),split=xgRows.filter(g=>!g.neutral&&(venue==='home'?g.homeId:g.awayId)===teamId);
 const mean=(list:ExternalFootballGame[],against:boolean)=>{
  let sum=0,weight=0;
  for(const g of list){const w=Math.exp(-(before-Date.parse(g.start))/(options.decayDays*86400000)),isHome=g.homeId===teamId;sum+=(against?(isHome?g.awayXg!:g.homeXg!):(isHome?g.homeXg!:g.awayXg!))*w;weight+=w;}
  return weight?sum/weight:0;
 };
 const rate=(against:boolean)=>!neutral&&split.length>=3?options.venueWeight*mean(split,against)+(1-options.venueWeight)*mean(xgRows,against):mean(xgRows,against);
 return {...goals,xgGames:xgRows.length,xgFor:rate(false),xgAgainst:rate(true)};
}
export function externalFootballFeatures(game:Pick<ExternalFootballGame,'homeId'|'awayId'|'start'|'neutral'|'league'>,history:ExternalFootballGame[],eloDifference:number,options:ExternalFeatureOptions,before=externalDayCutoff(game.start)){
 const rows=history.filter(g=>g.league===game.league),home=externalFootballForm(game.homeId,'home',rows,before,game.neutral,options),away=externalFootballForm(game.awayId,'away',rows,before,game.neutral,options);
 const enough=home.games>=5&&away.games>=5&&[home,away].every(f=>f.latest&&before-Date.parse(f.latest)<=120*86400000);
 const xgEnough=[home,away].every(f=>f.xgGames>=5&&f.xgGames>=f.games*.8);
 return {home,away,enough,xgEnough,values:[home.scored,home.conceded,away.scored,away.conceded,home.xgFor,home.xgAgainst,away.xgFor,away.xgAgainst,eloDifference/400,Number(game.neutral)]};
}
export class FootballElo{
 private ratings=new Map<string,{rating:number;year:number}>();
 private get(id:string,year:number){const old=this.ratings.get(id);return old?1500+(old.rating-1500)*(.85**Math.max(0,year-old.year)):1500;}
 difference(game:Pick<ExternalFootballGame,'homeId'|'awayId'|'start'|'league'>){const year=Number(game.start.slice(0,4));return this.get(game.league+'|'+game.homeId,year)-this.get(game.league+'|'+game.awayId,year);}
 update(g:ExternalFootballGame){
  const year=Number(g.start.slice(0,4)),hk=g.league+'|'+g.homeId,ak=g.league+'|'+g.awayId,h=this.get(hk,year),a=this.get(ak,year),expected=1/(1+10**(-(h-a+(g.neutral?0:60))/400)),score=g.homeGoals>g.awayGoals?1:g.homeGoals===g.awayGoals?.5:0,change=20*(score-expected);
  this.ratings.set(hk,{rating:h+change,year});this.ratings.set(ak,{rating:a-change,year});
 }
}
