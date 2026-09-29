import {nbaDay,reconcileNbaGames,type NbaGame} from './nba';
export const seasonLabel=(year:number)=>`${year-1}–${String(year).slice(-2)}`;
export function profileResults(games:NbaGame[],id:string,season:number,phase:number,venue:string,limit=0){
 return reconcileNbaGames(games).filter(g=>g.season===season&&g.phase===phase&&g.state==='final'&&Date.parse(g.start)<Date.now()&&(g.home.id===id||g.away.id===id)&&g.homeScore!==null&&g.awayScore!==null&&g.homeScore>0&&g.awayScore>0&&g.homeScore!==g.awayScore&&(venue==='all'||!g.neutral&&g[venue==='home'?'home':'away'].id===id)).sort((a,b)=>Date.parse(b.start)-Date.parse(a.start)).slice(0,limit||undefined);
}
export function profileGroups(games:NbaGame[],id:string,by:'opponent'|'month'){
 const groups=new Map<string,{key:string;name:string;logo:string;wins:number;losses:number;games:number;points:number;against:number}>();
 for(const g of games){const home=g.home.id===id,op=home?g.away:g.home,key=by==='month'?nbaDay(g.start).slice(0,7):op.id,own=(home?g.homeScore:g.awayScore)!,against=(home?g.awayScore:g.homeScore)!;
  const row=groups.get(key)||{key,name:by==='month'?key:op.name,logo:by==='month'?'':op.logo,wins:0,losses:0,games:0,points:0,against:0};row.games++;row.wins+=own>against?1:0;row.losses+=own<against?1:0;row.points+=own;row.against+=against;groups.set(key,row);
 }
 return [...groups.values()].sort((a,b)=>by==='month'?a.key.localeCompare(b.key):b.games-a.games||b.wins/b.games-a.wins/a.games);
}
export const playerHref=(id:number)=>`/players/nba/${id}`;
export const playerPhoto=(id:number)=>`https://cdn.nba.com/headshots/nba/latest/1040x760/${id}.png`;
export function positionZh(position:string){return position.split('-').map(p=>({G:'後衛',F:'前鋒',C:'中鋒',Guard:'後衛',Forward:'前鋒',Center:'中鋒'}[p]||p)).join('／')||'—';}
