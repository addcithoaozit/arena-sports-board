'use client';
import {type FootballLeague} from '@/lib/football';
import {footballMarketAudit,footballMarketRuntime as audit,selectFootballMarketModel} from '@/lib/football-market-model';
const number=(n:number)=>n.toFixed(5);
const names:{code:FootballLeague;name:string}[]=[{code:'ger.1',name:'德甲'},{code:'ita.1',name:'義甲'}];
export default function FootballMarketValidation({league}:{league:FootballLeague}){
 const entry=footballMarketAudit(league);
 return <details className="football-method" open><summary>德甲、義甲：第二輪比分模型驗收</summary>
  <p>新增較早年份賽果後，共使用 {audit.historyGames.toLocaleString()} 場兩聯賽歷史資料。依聯賽近一年主客平均進球調整比分分布，加入近期戰績與球隊相對強度；義甲另校準大小球、雙方進球與和局的比分分布。本版本不依賴 xG。</p>
  <div className="football-audit-scroll"><table><caption>基礎 → 第二輪候選 Log loss，越低越好</caption><thead><tr><th>聯賽／狀態</th><th>2012–2013 獨立測試</th><th>2019–2020 驗收</th><th>2025 驗收</th><th>2026 驗收</th></tr></thead><tbody>{names.map(l=>{const e=footballMarketAudit(l.code)!;return <tr key={l.code}><th>{l.name}<small>{selectFootballMarketModel(l.code)?'已通過・觀察中':'未啟用或已到期'}</small></th>{(['holdout','audit2019','audit2025','audit2026'] as const).map(k=><td key={k}>{number(e.metrics[k].baseline.logLoss)} → {number(e.metrics[k].candidate.logLoss)}<small>{e.sampleSizes[k]} 場</small></td>)}</tr>;})}</tbody></table></div>
  <p>2004暖身、2005–2009訓練、2010–2011比較各96組設定並固定唯一候選，才開啟此前未使用的2012–2013獨立測試。2019–2020、2025及2026已被前版檢視，另列驗收，不當成新的未見測試。</p>
  <p>門檻維持不變：各驗證期間勝和負 Log loss 改善、Brier 不變差，大小2.5球與雙方進球 Brier 增幅不得超過0.002；最低訓練／選參數／獨立測試／每期驗收場數為180／80／160／60。</p>
  {entry&&<><h3>{names.find(l=>l.code===league)?.name}：第二輪完整指標</h3><div className="football-audit-scroll"><table><caption>基礎 → 候選（較低較好）</caption><thead><tr><th>指標</th><th>獨立測試</th><th>2019–2020</th><th>2025</th><th>2026</th></tr></thead><tbody>{([['brier','勝和負 Brier'],['over25Brier','大小2.5球 Brier'],['bttsBrier','雙方進球 Brier']] as const).map(([key,label])=><tr key={key}><th>{label}</th>{(['holdout','audit2019','audit2025','audit2026'] as const).map(k=><td key={k}>{number(entry.metrics[k].baseline[key])} → {number(entry.metrics[k].candidate[key])}</td>)}</tr>)}<tr><th>Log loss 變化95%區間</th>{(['holdout','audit2019','audit2025','audit2026'] as const).map(k=><td key={k}>{entry.metrics[k].logLossChangeCI95.map(number).join(' ～ ')}</td>)}</tr></tbody></table></div><p>訓練 {entry.sampleSizes.training} 場、選參數 {entry.sampleSizes.selection} 場。{entry.reasons.join('；')}</p></>}
  <p>義甲2026大小球誤差改善幅度很小；區間跨零時，改善仍有不確定性。通過驗收不等於保證未來表現。每隊仍需至少5場且最近賽果120天內，聯賽近一年至少180場；來源失敗或資料不足時保留既有分析。有效至 {audit.expiresAt.slice(0,10)}。</p>
 </details>;
}
