import runtime from '../data/football/calibration-runtime.json';
export type FootballParameters={decayDays:number;venueWeight:number;homeIntercept:number;awayIntercept:number;attack:number;defense:number;rho:number};
export type FootballCalibrationStatus={status:'applied'|'baseline'|'expired';label:string;version:string;reasons:string[];holdoutGames:number;recentGames:number;uncertainty:string};
export const footballCalibrationRuntime=runtime;
export function footballCalibrationAudit(league:string){return (runtime.leagues as Partial<Record<string,typeof runtime.leagues[keyof typeof runtime.leagues]>>)[league];}
export const footballCalibrationReason=(reason:string)=>{
  const labels:Record<string,string>={training_sample_small:'訓練樣本不足',selection_sample_small:'選參數樣本不足',holdout_sample_small:'保留測試樣本不足',recent_sample_small:'近期驗收樣本不足',selection_logloss_not_improved:'2024選參數期的機率誤差未改善',holdout_logloss_not_improved:'2025保留測試的機率誤差未改善',recent_logloss_not_improved:'2026近期驗收的機率誤差未改善',holdout_brier_worse:'2025保留測試Brier誤差上升',recent_brier_worse:'2026近期Brier誤差上升',holdout_bttsBrier_worse:'2025雙方進球預測退步',recent_bttsBrier_worse:'2026雙方進球預測退步',holdout_over25Brier_worse:'2025大小球預測退步',recent_over25Brier_worse:'2026大小球預測退步'};
  return labels[reason]||reason;
};
export function selectFootballCalibration(league:string,now=Date.now()):{parameters:FootballParameters|null;summary:FootballCalibrationStatus}{
  const entry=footballCalibrationAudit(league);
  const eligible=!!entry?.enabled&&now>=Date.parse(runtime.createdAt)&&now<Date.parse(runtime.expiresAt);
  const expired=!!entry?.enabled&&now>=Date.parse(runtime.expiresAt);
  return {parameters:eligible?entry.parameters:null,summary:{status:eligible?'applied':expired?'expired':'baseline',label:eligible?'歷史校準・觀察中':expired?'校準待更新':entry?'基礎模型・候選未通過':'基礎模型・待驗證',version:eligible?runtime.version:league==='uefa.nations'?'football-national-form-v1':'football-form-poisson-v1',reasons:entry?.reasons.map(footballCalibrationReason)||['此賽事尚未完成驗收'],holdoutGames:entry?.sampleSizes.holdout||0,recentGames:entry?.sampleSizes.recent||0,uncertainty:entry?'改善幅度有限，信賴區間仍跨越零；不代表已證明能提升未來命中率。':'此賽事尚未完成獨立校準，賽前快照另行累積與驗證。'}};
}
export function calibratedFootballGoals(home:{scored:number;conceded:number},away:{scored:number;conceded:number},p:FootballParameters,neutral=false){
  const clamp=(n:number)=>Math.max(.15,Math.min(5,n)),ih=neutral?(p.homeIntercept+p.awayIntercept)/2:p.homeIntercept,ia=neutral?(p.homeIntercept+p.awayIntercept)/2:p.awayIntercept;
  return {home:clamp(Math.exp(ih+p.attack*Math.log(home.scored+.1)+p.defense*Math.log(away.conceded+.1))),away:clamp(Math.exp(ia+p.attack*Math.log(away.scored+.1)+p.defense*Math.log(home.conceded+.1)))};
}
