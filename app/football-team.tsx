'use client';

import {useState} from 'react';
import type {FootballTeam} from '@/lib/football';

export default function FootballTeamIdentity({team,side}:{team:FootballTeam;side:'home'|'away'}){
  const [failedSource,setFailedSource]=useState<string|null>(null);
  // Match the same ESPN soccer team ID used by the fixture, including UEFA clubs.
  const source=/^\d+$/.test(team.id)?`https://a.espncdn.com/i/teamlogos/soccer/500/${team.id}.png`:null;
  return <div className="football-team">
    <small>{side==='home'?'主隊':'客隊'}</small>
    <div className="football-team-identity">
      {source&&failedSource!==source&&<img src={source} alt="" width={44} height={44} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="football-team-logo" onError={()=>setFailedSource(source)}/>}
      <h3 title={team.englishName}>{team.name}</h3>
    </div>
  </div>;
}
