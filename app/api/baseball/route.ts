import {GET as super007GET} from '../super007/route';
import {parseStandings} from '@/lib/standings';
import validation from '@/data/model-validation.json';
import historicalOdds from '@/data/historical-odds.json';
import {env} from "@/server/runtime";
import {statcastHistorySummary,statcastHistoryRecords,historicalPitcher} from '@/lib/statcast-history';
import {retrosheetSummary,retrosheetMatch,retrosheetRecords} from '@/lib/retrosheet';
import {parkFactorsUrl,parseParkFactors} from '@/lib/park-factors';
import {coversFetch} from '@/lib/covers-fetch';
import {COVERS_ODDS_URL,parseCoversOdds} from '@/lib/covers-odds';
import {coversTeams,coversUrl,parseCoversHistory} from '@/lib/covers';
import {fangraphsUrl,parseFanGraphs,type FanGraphsKind} from '@/lib/fangraphs';
import {getPitcherHistory} from '@/lib/pitcher-history';
import {parsePitcherRates,type PitcherRates} from '@/lib/pitcher-era';
import {parseLiveGame,mergeLiveGame} from '@/lib/live-game';
import {parseLineups,parseBullpen} from '@/lib/rotowire';
import { validateCollectorSnapshot } from '@/lib/pinnacle';
import { parseRuns } from '@/lib/markets';
import { parseStats, shiftDay, taipeiDay, isMlbPostseason, type Kind } from '@/lib/baseball';
import {parseMlbSchedule,withMlbSeasonRecords} from '@/lib/mlb-schedule';
export const dynamic='force-dynamic';
const cache=new Map<string,{data:unknown;expires:number}>();
const pending=new Map<string,Promise<unknown>>();
async function cached(key:string,ttl:number,fetcher:()=>Promise<unknown>){
  const current=cache.get(key);if(current&&current.expires>Date.now())return current.data;
  // Live requests must not inherit unfinished I/O from a canceled Worker request.
  if(key.startsWith('scores:')||key.startsWith('game:')||key.startsWith('schedule:')||key.startsWith('pitcher-rates:')){const data=await fetcher();if(cache.size>=80)cache.delete(cache.keys().next().value!);cache.set(key,{data,expires:Date.now()+ttl});return data;}
  if(pending.has(key))return pending.get(key)!;
  const task=fetcher().then(data=>{if(cache.size>=80)cache.delete(cache.keys().next().value!);cache.set(key,{data,expires:Date.now()+ttl});return data;}).finally(()=>pending.delete(key));pending.set(key,task);return task;
}
async function sourceFetch(url:string){const r=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!r.ok)throw new Error(`來源回覆 ${r.status}`);return r;}
async function gameDetail(gamePk:number){
  return cached('game:'+gamePk,10000,async()=>{
    const response=await fetch(`https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`,{signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw new Error('詳細資料暫時無法取得');
    const text=await response.text();if(text.length>8000000)throw new Error('比賽資料超出上限');
    return parseLiveGame(JSON.parse(text),gamePk);
  }) as Promise<ReturnType<typeof parseLiveGame>>;
}
export async function GET(request:Request){
  const url=new URL(request.url),kind=url.searchParams.get('kind')||'',year=new Date().getUTCFullYear();
  try {
    if(kind==='standings'){
      const data=await cached(`standings:${year}`,5*60000,async()=>{
        const today=new Date().toISOString().slice(0,10),start=new Date(Date.now()-30*86400000).toISOString().slice(0,10);
        const [standings,recent]=await Promise.all([sourceFetch(`https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${year}&standingsTypes=regularSeason&hydrate=team`).then(r=>r.json()),sourceFetch(`https://statsapi.mlb.com/api/v1/schedule?sportId=1&gameType=R&startDate=${start}&endDate=${today}`).then(r=>r.json()).catch(()=>null)]);
        return parseStandings(standings,recent,year);
      });return Response.json(data,{headers:{'Cache-Control':'no-store'}});
    }
    if(kind==='model-validation')return Response.json(validation);
    if(kind==='historical-odds'){const offset=Number(url.searchParams.get('offset')||0);if(!Number.isInteger(offset)||offset<0||offset>10000)return Response.json({error:'分頁參數錯誤'},{status:400});return Response.json({summary:historicalOdds.summary,games:historicalOdds.games.slice(offset,offset+100),offset,limit:100});}
    if(['pitcher','batter-team','pitcher-team'].includes(kind)){
      const data=await cached(`${year}:${kind}`,20*60000,async()=>{
        // Include pitchers below leaderboard qualification; readiness reports
        // their actual sample size instead of treating them as unpublished.
        const minimum=kind==='pitcher'?'1':'q';
        const source=`https://baseballsavant.mlb.com/leaderboard/statcast?type=${kind}&year=${year}&position=&team=&min=${minimum}&sort=barrels_per_pa&sortDir=desc`;
        const r=await sourceFetch(source+'&csv=true');const text=await r.text();if(text.length>3000000)throw new Error('資料量超出上限');
        return {rows:parseStats(text,kind as Kind),fetchedAt:new Date().toISOString(),year,kind,source};
      });return Response.json(data,{headers:{'Cache-Control':'no-store'}});
    }
    if(kind.startsWith('fg-')&&['injuries','bat-left','bat-right','pit-left','pit-right'].includes(kind.slice(3))){
      const fgKind=kind.slice(3) as FanGraphsKind;
      const data=await cached(`${year}:${kind}`,3600000,async()=>parseFanGraphs(await (await sourceFetch(fangraphsUrl(fgKind,year))).text(),fgKind,year));
      return Response.json(data,{headers:{'Cache-Control':'no-store'}});
    }
    if(kind==='statcast-history')return Response.json(statcastHistorySummary());
    if(kind==='statcast-records'||kind==='statcast-pitcher'){
      const pitcherId=url.searchParams.has('pitcherId')?Number(url.searchParams.get('pitcherId')):undefined,gameId=url.searchParams.has('gameId')?Number(url.searchParams.get('gameId')):undefined,offset=Number(url.searchParams.get('offset')||0),before=url.searchParams.get('before');
      if(!before||!/^\d{4}-\d{2}-\d{2}$/.test(before)||!Number.isFinite(Date.parse(before))||!Number.isInteger(offset)||offset<0||offset>200000||[pitcherId,gameId].some(v=>v!==undefined&&(!Number.isInteger(v)||v<=0))||kind==='statcast-pitcher'&&!pitcherId)return Response.json({error:'無效逐球查詢'},{status:400});
      return Response.json(kind==='statcast-pitcher'?historicalPitcher(pitcherId!,before):await statcastHistoryRecords({pitcherId,gameId,before,offset},async path=>{const r=await env.ASSETS.fetch(new Request(new URL(path,request.url)));if(!r.ok)throw new Error("歷史資料分檔讀取失敗");return r.json() as Promise<any[]>;}));
    }
    if(kind==='retrosheet'){
      const away=Number(url.searchParams.get('awayId')),home=Number(url.searchParams.get('homeId')),before=url.searchParams.get('before');
      if(away||home||before){if(!coversTeams[away]||!coversTeams[home]||away===home||!before||!/^\d{4}-\d{2}-\d{2}$/.test(before)||!Number.isFinite(Date.parse(before)))return Response.json({error:'無效歷史查詢'},{status:400});return Response.json(retrosheetMatch(away,home,before));}
      return Response.json(retrosheetSummary());
    }
    if(kind==='retrosheet-records'){
      const season=Number(url.searchParams.get('season')),offset=Number(url.searchParams.get('offset')||0);
      if(![2023,2024,2025].includes(season)||!Number.isInteger(offset)||offset<0||offset>3000)return Response.json({error:'無效歷史查詢'},{status:400});
      return Response.json(retrosheetRecords(season,offset));
    }
    if(kind==='fg-park'){
      const data=await cached('fg-park:'+(year-1),24*3600000,async()=>parseParkFactors(await (await sourceFetch(parkFactorsUrl(year-1))).text(),year-1));
      return Response.json(data,{headers:{'Cache-Control':'no-store'}});
    }
    if(kind==='covers-odds'){
      const data=await cached('covers-odds',300000,async()=>parseCoversOdds(await (await coversFetch(COVERS_ODDS_URL)).text()));
      return Response.json(data,{headers:{'Cache-Control':'no-store'}});
    }
    if(kind==='covers-history'){
      const teamId=Number(url.searchParams.get('teamId'));
      if(!coversTeams[teamId])return Response.json({error:'無效的球隊編號'},{status:400});
      const data=await cached(`covers:${year}:${teamId}`,6*3600000,async()=>parseCoversHistory(await (await coversFetch(coversUrl(teamId))).text(),teamId,year));
      return Response.json(data,{headers:{'Cache-Control':'no-store'}});
    }
    if(kind==='lineups'){
      const data=await cached('rotowire-lineups',120000,async()=>{
        const source='https://www.rotowire.com/baseball/daily-lineups.php';
        const games=parseLineups(await (await sourceFetch(source)).text());
        return {games,fetchedAt:new Date().toISOString(),source};
      });return Response.json(data,{headers:{'Cache-Control':'no-store'}});
    }
    if(kind==='bullpen'){
      const data=await cached('rotowire-bullpen',10*60000,async()=>{
        const rows=parseBullpen(await (await sourceFetch('https://www.rotowire.com/baseball/tables/bullpen-usage.php?team=')).json());
        return {rows,fetchedAt:new Date().toISOString(),source:'https://www.rotowire.com/baseball/bullpen-usage.php'};
      });return Response.json(data,{headers:{'Cache-Control':'no-store'}});
    }
    if(kind==='pinnacle'){
      // The collector owns the timestamp. Never refresh stale data by restamping it.
      const r=await sourceFetch('https://arena-odds-service.onrender.com/odds');
      const data=validateCollectorSnapshot(await r.json());
      return Response.json(data,{headers:{'Cache-Control':'no-store'}});
    }
    if(kind==='runs'){
      const data=await cached('runs:'+year,20*60000,async()=>{
        const source=`https://statsapi.mlb.com/api/v1/teams/stats?season=${year}&sportIds=1&group=hitting,pitching&stats=season&gameType=R`;
        const r=await sourceFetch(source),rows=parseRuns(await r.json());
        const league=rows.reduce((n,r)=>n+r.scored,0)/rows.reduce((n,r)=>n+r.batGames,0);
        return {rows,league,year,source,fetchedAt:new Date().toISOString()};
      });return Response.json(data,{headers:{'Cache-Control':'no-store'}});
    }
    if(kind==='pitcher-history'){
      const id=url.searchParams.get('pitcherId')||'';
      if(!/^[1-9][0-9]{0,8}$/.test(id))return Response.json({error:'無效的投手編號'},{status:400});
      return Response.json(await getPitcherHistory(Number(id)),{headers:{'Cache-Control':'no-store'}});
    }
    if(kind==='game'){
      const id=url.searchParams.get('gamePk')||'';
      if(!/^[1-9][0-9]{0,8}$/.test(id))return Response.json({error:'無效的比賽編號'},{status:400});
      return Response.json(await gameDetail(Number(id)),{headers:{'Cache-Control':'no-store'}});
    }
    if(kind==='scores'){
      const requestedDay=url.searchParams.get('date');
      if(requestedDay&&(!/^\d{4}-\d{2}-\d{2}$/.test(requestedDay)||!Number.isFinite(Date.parse(requestedDay))||new Date(requestedDay).toISOString().slice(0,10)!==requestedDay||requestedDay<'2000-01-01'||requestedDay>'2100-12-31'))return Response.json({error:'無效的比分日期'},{status:400});
      const today=taipeiDay(),day=requestedDay||today;
      const data=await cached('scores:'+day,10000,async()=>{
        const source=`https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${shiftDay(day,-2)}&endDate=${shiftDay(day,1)}&hydrate=linescore,team,probablePitcher`;
        const response=await fetch(source,{signal:AbortSignal.timeout(10000)});
        if(!response.ok)throw new Error(`比分來源回覆 ${response.status}`);
        const json=await response.json();
        if(!Array.isArray(json.dates))throw new Error('比分資料格式錯誤');
        const games=json.dates.flatMap((d:any)=>d.games||[]).filter((g:any)=>day===today&&g.status?.abstractGameState==='Live'||taipeiDay(g.gameDate)===day);
        // Return hydrated inning scores immediately. SelectedGame fetches its own play feed.
        return {games,fetchedAt:new Date().toISOString(),date:day};
      });
      return Response.json(data,{headers:{'Cache-Control':'no-store'}});
    }
    if(kind==='super007')return super007GET();
    if(kind==='schedule'){
      const day=taipeiDay();const data=await cached('schedule:'+day,30000,async()=>{
        const source=`https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate=${shiftDay(day,-1)}&endDate=${shiftDay(day,7)}&hydrate=team,probablePitcher`;
        const r=await fetch(source,{signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error(`賽程來源回覆 ${r.status}`);const json=await r.json();if(!Array.isArray(json.dates))throw new Error('賽程格式錯誤');
        let games=parseMlbSchedule(json);
        await Promise.all([...new Set(games.filter(g=>isMlbPostseason(g.gameType)).map(g=>g.season))].map(async season=>{
          try{
            const raw=await cached(`postseason-records:${season}`,5*60000,async()=>{
              const response=await fetch(`https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason&hydrate=team`,{signal:AbortSignal.timeout(8000)});
              if(!response.ok)throw Error('例行賽戰績暫時無法取得');return response.json();
            });
            games=withMlbSeasonRecords(games,raw,season);
          }catch{
            // Keep the fixture and pitchers visible; missing records remain null.
          }
        }));
        await Promise.all([...new Set<number>(games.map((g:any)=>g.season))].map(async season=>{
          const seasonGames=games.filter((g:any)=>g.season===season);
          const ids=[...new Set<number>(seasonGames.flatMap((g:any)=>[g.away.pitcherId,g.home.pitcherId]).filter((id:any)=>Number.isInteger(id)&&id>0))].sort((a,b)=>a-b);
          if(!ids.length)return;
          try{
            const rates=await cached(`pitcher-rates:${season}:${ids.join(',')}`,20*60000,async()=>{
              const query=new URLSearchParams({personIds:ids.join(','),hydrate:`stats(group=[pitching],type=[season],season=${season})`});
              const response=await fetch(`https://statsapi.mlb.com/api/v1/people?${query}`,{signal:AbortSignal.timeout(8000)});
              if(!response.ok)throw new Error('先發投手數據暫時無法取得');
              return parsePitcherRates(await response.json(),season);
            }) as Record<number,PitcherRates>;
            for(const game of seasonGames)for(const side of [game.away,game.home]){
              const stats=side.pitcherId?rates[side.pitcherId]:undefined;
              side.pitcherEra=stats?.era??null;side.pitcherWhip=stats?.whip??null;
            }
          }catch{
            // Missing pitching rates must not suppress the schedule or substitute another pitcher.
          }
        }));
        return {games,fetchedAt:new Date().toISOString(),source};
      });return Response.json(data,{headers:{'Cache-Control':'no-store'}});
    }
    return Response.json({error:'不支援的資料種類'},{status:400});
  }catch(e){return Response.json({error:e instanceof Error?e.message:'來源暫時無法連線'},{status:502,headers:{'Cache-Control':'no-store'}});}
}
