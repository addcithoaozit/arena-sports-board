// Server-side only: this archive must never be imported by the client board.
import archive from '../data/football/history-20260927.json';
import type {FootballGame,FootballLeague} from './football';
export const footballArchiveCutoff=archive.cutoff;
export function archivedFootballHistory(league:FootballLeague,homeId:string,awayId:string,before=Date.now()):FootballGame[]{
  const since=before-365*86400000;
  return archive.games.filter(r=>r[1]===league&&(String(r[4])===homeId||String(r[4])===awayId||String(r[5])===homeId||String(r[5])===awayId)&&Date.parse(String(r[3]))>=since&&Date.parse(String(r[3]))<before).map(r=>{
    const team=(id:string)=>({id,name:archive.teams[id as keyof typeof archive.teams]||id,englishName:archive.teams[id as keyof typeof archive.teams]||id});
    return {id:String(r[0]),league,season:Number(r[2]),start:String(r[3]),home:team(String(r[4])),away:team(String(r[5])),homeScore:Number(r[6]),awayScore:Number(r[7]),neutral:!!r[8],state:'final',statusName:'STATUS_FULL_TIME',statusLabel:'完場',timeConfirmed:true,venue:'',sourceUrl:`https://www.espn.com/soccer/match/_/gameId/${r[0]}`};
  });
}

