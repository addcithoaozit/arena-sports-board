import {internationalTeam} from './international-teams';
import {profileCode,profileHref,type ProfileLeague} from './international-profile';

export type NpbPlayerLinks=Record<string,Record<string,string>>;
// Shared with the verified photo catalog; full names remain scoped to one team.
export function playerPhotoKey(name:string){return String(name||'').normalize('NFKC').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/^[\s*＊+＋#＃]+/,'').replace(/[.,'’·・-]/g,' ').trim().toLowerCase().split(/\s+/).filter(Boolean).sort().join('');}
export function internationalTeamHref(league:string,name:string){
 if(!['NPB','CPBL','KBO'].includes(league))return null;
 const code=profileCode(league as ProfileLeague,internationalTeam(name,league));
 return code?profileHref(league as ProfileLeague,code):null;
}
export function npbPlayerHref(links:NpbPlayerLinks|undefined,team:string,name:string){
 const code=profileCode('NPB',internationalTeam(team,'NPB'));
 const id=code?links?.[code]?.[playerPhotoKey(name)]:undefined;
 return id&&/^[1-9]\d{3,8}$/.test(id)?`/players/international/npb/${id}`:null;
}
