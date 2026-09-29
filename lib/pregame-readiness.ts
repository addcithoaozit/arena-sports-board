import {baseProbability, fresh, isPregame, type Match, type Snapshot, type StatRow} from './baseball';
import type {AnalysisReport} from './pregame-analysis';

export function marketContextStatus(game:Match,report:AnalysisReport|undefined,now:number){
  if(!report||!fresh(report.capturedAt,now,300000)||report.game.id!==game.id||report.game.date!==game.date||report.game.season!==game.season||
    (['away','home'] as const).some(side=>report.game[side].id!==game[side].id||report.game[side].pitcherId!==game[side].pitcherId))return {blocked:'',notice:''};
  const conflicts=report.issues.filter(issue=>issue.includes('衝突')||issue.includes('先發投手來源不一致'));
  const resolution=report.context?.lineupResolution;
  return {
    blocked:conflicts.length?`${conflicts.join('；')}，暫停本場推薦`:'',
    notice:resolution?.authority==='MLB'&&resolution.secondaryLineupExcluded&&Array.isArray(resolution.conflicts)
      ?`${resolution.conflicts.join('；')}。已排除該打線來源，使用官方賽程與球隊本季資料作基本試算。`:'',
  };
}

type StatSource={data:Snapshot|null;error:string};
type WinnerSources={pitchers:StatSource;batting:StatSource;pitching:StatSource};
export function winnerReadiness(game:Match, scheduleOK:boolean, now:number, sources:WinnerSources){
  // The existing winner calculation uses season records. Statcast completeness
  // describes the supporting data; it must not pretend to be an input to log5.
  let blocked='';
  if(!scheduleOK)blocked='賽程資料尚未取得或已過期';
  else if(!isPregame(game,now))blocked='已到開賽時間、賽事狀態不符或賽事類型不支援';
  else if(baseProbability(game)===null)blocked='戰績不足 20 場或資料缺漏';
  else {
    const missing=(['away','home'] as const).filter(side=>!game[side].pitcherId);
    if(missing.length)blocked=missing.map(side=>`${side==='away'?'客隊':'主隊'}先發投手尚未公布`).join('；');
  }
  const warnings:string[]=[];
  const check=(label:string,source:StatSource,find:(row:StatRow)=>boolean)=>{
    if(source.error||!fresh(source.data?.fetchedAt,now,25*60000)){warnings.push(`${label}資料未取得或已過期`);return;}
    if(source.data?.year!==game.season){warnings.push(`${label}資料球季不一致`);return;}
    const matches=source.data.rows.filter(find);
    if(matches.length!==1){warnings.push(`${label}${matches.length?'資料重複，待核對':'尚無本季進階資料'}`);return;}
    const row=matches[0];
    if(!Number.isFinite(row.attempts)||row.attempts<50){warnings.push(`${label}有效擊球樣本 ${Number.isFinite(row.attempts)?row.attempts:0} 筆，未滿 50 筆`);return;}
    const fields=[['優質擊球率',row.barrelPa],['強勁擊球率',row.hardHit]] as const;
    const missing=fields.filter(([,value])=>value===null||!Number.isFinite(value)).map(([label])=>label);
    if(missing.length)warnings.push(`${label}缺少${missing.join('、')}`);
  };
  for(const side of ['away','home'] as const){
    const team=game[side],label=side==='away'?'客隊':'主隊';
    check(`${label}團隊打擊`,sources.batting,row=>row.teamId===team.id);
    check(`${label}團隊投球`,sources.pitching,row=>row.teamId===team.id);
    if(team.pitcherId)check(`${label} ${team.pitcherName} `,sources.pitchers,row=>row.id===String(team.pitcherId));
  }
  return {blocked,warnings,advancedReady:warnings.length===0};
}
