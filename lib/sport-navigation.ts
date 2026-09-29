export const BASEBALL_LEAGUES=[{code:'MLB',name:'美國職棒'},{code:'NPB',name:'日本職棒'}] as const;
export type FrontLeague='MLB'|'NPB'|'FOOTBALL'|'NBA'|'WNBA';
export const FRONT_VIEWS=['analysis','overview','teams','standings','live'] as const;
export function frontSelection(search:string){
 const p=new URLSearchParams(search),league=p.get('league'),view=p.get('view');
 return {league:(['MLB','NPB','FOOTBALL','NBA','WNBA'].includes(league||'')?league:'MLB') as FrontLeague,view:FRONT_VIEWS.includes(view as typeof FRONT_VIEWS[number])?view!:'analysis'};
}
export function leaguePageHref(league:string,view='analysis'){
 return `${['MLB','NPB','FOOTBALL','NBA','WNBA'].includes(league)?'/':'/admin/leagues'}?${new URLSearchParams({league,view})}`;
}
