import {isMlbPostseason,type Match,type TeamSide} from './baseball';
import {parseStandings} from './standings';

export function parseMlbSchedule(raw:any):Match[]{
 if(!Array.isArray(raw?.dates))throw Error('賽程格式錯誤');
 const record=(value:any)=>Number.isInteger(value)&&value>=0?value:null;
 const side=(s:any,postseason:boolean):TeamSide=>({
  id:s.team.id,name:s.team.name,
  // A new postseason round starts at 0–0. It is not a season-strength sample.
  wins:postseason?null:record(s.leagueRecord?.wins),losses:postseason?null:record(s.leagueRecord?.losses),
  pitcherId:s.probablePitcher?.id??null,pitcherName:s.probablePitcher?.fullName||'先發待公布',pitcherEra:null,pitcherWhip:null,
 });
 return raw.dates.flatMap((d:any)=>d.games||[]).filter((g:any)=>g.teams?.away?.team?.id&&g.teams?.home?.team?.id).map((g:any)=>({
  id:g.gamePk,date:g.gameDate,season:Number(g.season),gameType:g.gameType,state:g.status?.abstractGameState,status:g.status?.detailedState,
  startTimeTBD:!!g.status?.startTimeTBD,doubleHeader:g.doubleHeader,gameNumber:g.gameNumber,
  away:side(g.teams.away,isMlbPostseason(g.gameType)),home:side(g.teams.home,isMlbPostseason(g.gameType)),
 }));
}

/** Require the same season's complete official regular-season standings. */
export function mlbRegularSeasonRecords(raw:any,season:number){
 if(!Array.isArray(raw?.records)||!raw.records.length||raw.records.some((group:any)=>group.standingsType!=='regularSeason'||![103,104].includes(group.league?.id)))throw Error('例行賽戰績來源不符');
 const {rows}=parseStandings(raw,null,season);
 return Object.fromEntries(rows.map(({id,wins,losses}:{id:number;wins:number;losses:number})=>[id,{wins,losses}]));
}

export function withMlbSeasonRecords(games:Match[],raw:any,season:number):Match[]{
 const records=mlbRegularSeasonRecords(raw,season);
 return games.map(g=>g.season===season&&isMlbPostseason(g.gameType)?{
  ...g,away:{...g.away,wins:records[g.away.id]?.wins??null,losses:records[g.away.id]?.losses??null},
  home:{...g.home,wins:records[g.home.id]?.wins??null,losses:records[g.home.id]?.losses??null},
 }:g);
}
