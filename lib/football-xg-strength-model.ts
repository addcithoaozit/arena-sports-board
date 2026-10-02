import runtime from '../data/football/xg-strength-runtime.json';
import {externalFootballRates} from './football-external-model';
import {marketFootballDistribution} from './football-market-core';
export const footballXgStrengthRuntime=runtime;
export function footballXgStrengthAudit(league:string){return (runtime.leagues as Partial<Record<string,(typeof runtime.leagues)[keyof typeof runtime.leagues]>>)[league];}
export function selectFootballXgStrengthModel(league:string,now=Date.now()){
 const entry=footballXgStrengthAudit(league);
 return entry?.enabled&&now>=Date.parse(runtime.createdAt)&&now<Date.parse(runtime.expiresAt)?entry.parameters:null;
}
export function xgStrengthDistribution(input:number[],baseline:number[],p:typeof runtime.leagues['esp.1']['parameters']){
 const rates=externalFootballRates(input,baseline,p);
 return marketFootballDistribution({...rates,overTilt:p.overTilt*p.blend,bttsTilt:p.bttsTilt*p.blend,drawTilt:p.drawTilt*p.blend});
}
