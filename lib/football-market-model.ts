import runtime from '../data/football/market-calibration-runtime.json';
import type {FootballLeague} from './football';
import type {MarketParameters} from './football-market-core';
export const footballMarketRuntime=runtime;
export function footballMarketAudit(league:FootballLeague){return (runtime.leagues as Partial<Record<FootballLeague,typeof runtime.leagues['ger.1']>>)[league];}
export function selectFootballMarketModel(league:FootballLeague,now=Date.now()):MarketParameters|null{
 const e=footballMarketAudit(league);return e?.enabled&&now>=Date.parse(runtime.createdAt)&&now<Date.parse(runtime.expiresAt)?e.parameters:null;
}
