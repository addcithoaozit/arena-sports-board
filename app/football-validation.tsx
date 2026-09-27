'use client';
import {useEffect,useState} from 'react';
import {FOOTBALL_LEAGUES,type FootballLeague} from '@/lib/football';
import {footballCalibrationRuntime as audit,selectFootballCalibration} from '@/lib/football-calibration';

type Live={available:boolean;error?:string;counts?:{snapshots:number;games:number};groups?:{league:string;version:string;n:number;logLoss:number;brier:number;accuracy:number}[]};
const decimal=(n:number)=>n.toFixed(4),pct=(n:number)=>(n*100).toFixed(1)+'%';
export default function FootballValidation({league}:{league:FootballLeague}){
  const [open,setOpen]=useState(false),[live,setLive]=useState<Live|null>(null),[reload,setReload]=useState(0);
  useEffect(()=>{
    if(!open)return;const controller=new AbortController();setLive(null);
    fetch('/api/admin/football-validation',{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)])}).then(async r=>{if(!r.ok)throw Error('統計暫時無法讀取');return r.json();}).then(d=>{if(!controller.signal.aborted)setLive(d.live);}).catch(()=>{if(!controller.signal.aborted)setLive({available:false,error:'統計暫時無法讀取，請重試。'});});
    return()=>controller.abort();
  },[open,reload]);
  const entry=audit.leagues[league],status=selectFootballCalibration(league).summary;
  return <details className="football-method football-validation" open={open} onToggle={e=>setOpen(e.currentTarget.open)}>
    <summary>回測、模型不足與上線後驗證</summary>
    {open&&<div>
      <p>歷史賽果 {audit.historyGames.toLocaleString()} 場・2022年起可回測 {audit.replayedGames.toLocaleString()} 場・資料截至 {audit.auditThrough.slice(0,10)}。</p>
      <p>按時間分開：2021暖身，2022–23訓練，2024選參數，2025保留測試，2026近期驗收。每場只使用開賽前3小時之前的歷史賽果，沒有用未來比分訓練。</p>
      <div className="football-audit-scroll"><table><caption>機率誤差 Log loss（越低越好）；箭頭表示基礎 → 候選</caption><thead><tr><th>聯賽／狀態</th><th>2025 測試</th><th>2026 近期</th></tr></thead><tbody>{FOOTBALL_LEAGUES.map(l=>{const x=audit.leagues[l.code],s=selectFootballCalibration(l.code).summary;return <tr key={l.code}><th>{l.name}<small>{s.label}</small></th><td>{decimal(x.metrics.holdout.baseline.logLoss)} → {decimal(x.metrics.holdout.candidate.logLoss)}<small>{x.sampleSizes.holdout} 場</small></td><td>{decimal(x.metrics.recent.baseline.logLoss)} → {decimal(x.metrics.recent.candidate.logLoss)}<small>{x.sampleSizes.recent} 場</small></td></tr>;})}</tbody></table></div>
      <h3>{FOOTBALL_LEAGUES.find(l=>l.code===league)?.name}：{status.label}</h3>
      {!!status.reasons.length&&<p>保留基礎模型的原因：{status.reasons.join('；')}。</p>}
      <p>更新條件：三個驗證期間的Log loss均改善、測試與近期Brier不變差、大小球及雙方進球Brier增加不超過0.002，並達到最低樣本數。歐冠訓練126場、選參數67場，低於180／80場門檻。</p>
      <div className="football-audit-scroll"><table><caption>所選聯賽完整指標（基礎 → 候選，未通過者不會套用）</caption><thead><tr><th>指標</th><th>2025</th><th>2026至截點</th></tr></thead><tbody>{([['brier','勝和負 Brier'],['over25Brier','大小2.5球 Brier'],['bttsBrier','雙方進球 Brier'],['accuracy','最高機率命中率']] as const).map(([key,label])=><tr key={key}><th>{label}</th>{(['holdout','recent'] as const).map(split=><td key={split}>{key==='accuracy'?pct(entry.metrics[split].baseline[key]):decimal(entry.metrics[split].baseline[key])} → {key==='accuracy'?pct(entry.metrics[split].candidate[key]):decimal(entry.metrics[split].candidate[key])}</td>)}</tr>)}<tr><th>Log loss變化 95%區間</th>{(['holdout','recent'] as const).map(split=><td key={split}>{entry.metrics[split].logLossChangeCI95.map(decimal).join(' ～ ')}</td>)}</tr></tbody></table></div>
      <p>Log loss與Brier評估機率品質，越低越好；命中率越高越好。以週為單位重抽樣1,000次估計區間，跨越零表示改善仍有不確定性。西甲2025機率誤差下降，但命中率由54.3%降至52.4%，不能宣稱全面更準。</p>
      <h3>已知不足</h3>
      <ul><li>只使用比分近況，未建模對手強度、先發、傷停、xG或實際盤口；不能據此推算獲利。</li><li>同賽事不足10場或近況過舊時，自動補抓球隊其他正式賽事並降權；補充後仍少於5場則不產生機率。跨賽事版本尚未獨立驗收，不列為已校準，也不混入上表的同賽事回測。</li><li>歷史資料是事後下載的賽果，可能含供應商修正，並非當時保存的即時快照。前瞻驗證另行統計。</li><li>沒有即時自動改寫參數。新模型仍需重新訓練、保留測試與驗收；校準有效至 {audit.expiresAt.slice(0,10)}，到期回到基礎模型。已看過的測試期不能反覆調到通過，下一版須保留新的未見資料。</li></ul>
      <h3>上線後賽前快照</h3>
      {!live?<p role="status">正在讀取…</p>:!live.available?<p role="alert">{live.error}</p>:<><p>已保存 {Number(live.counts?.snapshots||0)} 筆預測，涵蓋 {Number(live.counts?.games||0)} 場比賽。</p>{!live.groups?.length?<p>目前沒有已配對完場賽果，尚不能評估上線後表現。</p>:<div className="football-audit-scroll"><table><thead><tr><th>聯賽／版本</th><th>場數</th><th>Log loss</th><th>Brier</th><th>命中率</th></tr></thead><tbody>{live.groups.map(g=><tr key={g.league+g.version}><th>{FOOTBALL_LEAGUES.find(l=>l.code===g.league)?.name||g.league}<small>{g.version}</small></th><td>{g.n}</td><td>{decimal(g.logLoss)}</td><td>{decimal(g.brier)}</td><td>{pct(g.accuracy)}</td></tr>)}</tbody></table></div>}</>}
      <p>只有實際被查看並成功保存的賽前分析會入帳；每版本保留開賽前最後一筆，開賽後不能覆寫。查看已完場日期的賽程時更新賽果，統計最多最近5,000筆已配對快照。這不是所有賽事，也不是實際下注成績。</p>
      <button type="button" onClick={()=>setReload(n=>n+1)}>更新快照統計</button>
    </div>}
  </details>;
}
