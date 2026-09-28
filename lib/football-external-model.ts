import runtime from '../data/football/external-calibration-runtime.json';
import type {FootballLeague} from './football';
export type ExternalFootballParameters={decayDays:number;venueWeight:number;blend:number;homeIntercept:number;awayIntercept:number;goalAttack:number;goalDefense:number;xgAttack:number;xgDefense:number;elo:number;rho:number;usesXg:boolean};
export const footballExternalRuntime=runtime;
export function footballExternalAudit(league:FootballLeague){return (runtime.leagues as Partial<Record<FootballLeague,typeof runtime.leagues[keyof typeof runtime.leagues]>>)[league];}
export function selectExternalFootballModel(league:FootballLeague,now=Date.now()){
 const entry=footballExternalAudit(league);
 return entry?.enabled&&now>=Date.parse(runtime.createdAt)&&now<Date.parse(runtime.expiresAt)?entry.parameters as ExternalFootballParameters:null;
}
export function externalFootballRates(input:number[],baseline:number[],p:ExternalFootballParameters){
 const [hs,hc,as,ac,hx,hxa,ax,axa,diff,neutral]=input,clamp=(n:number)=>Math.max(.15,Math.min(5,n)),ih=neutral?(p.homeIntercept+p.awayIntercept)/2:p.homeIntercept,ia=neutral?(p.homeIntercept+p.awayIntercept)/2:p.awayIntercept;
 const home=clamp(Math.exp(ih+p.goalAttack*Math.log(hs+.1)+p.goalDefense*Math.log(ac+.1)+p.xgAttack*Math.log(hx+.1)+p.xgDefense*Math.log(axa+.1)+p.elo*diff));
 const away=clamp(Math.exp(ia+p.goalAttack*Math.log(as+.1)+p.goalDefense*Math.log(hc+.1)+p.xgAttack*Math.log(ax+.1)+p.xgDefense*Math.log(hxa+.1)-p.elo*diff));
 return {home:p.blend*home+(1-p.blend)*clamp((baseline[0]+baseline[3])/2),away:p.blend*away+(1-p.blend)*clamp((baseline[2]+baseline[1])/2),rho:p.rho*p.blend};
}
