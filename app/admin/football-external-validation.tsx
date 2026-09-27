'use client';
import {FOOTBALL_LEAGUES,type FootballLeague} from '@/lib/football';
import {footballExternalRuntime as audit,selectExternalFootballModel} from '@/lib/football-external-model';
import {selectFootballMarketModel} from '@/lib/football-market-model';
import {selectFootballCalibration} from '@/lib/football-calibration';
const decimal=(n:number)=>n.toFixed(4);
const reason=(r:string)=>r.replace('audit2025','2025驗收').replace('audit2026','2026驗收').replace('holdout','2019–2020獨立測試').replace('over25Brier_worse','大小2.5球誤差超標').replace('bttsBrier_worse','雙方進球誤差超標').replaceAll('_','：');
export default function FootballExternalValidation({league}:{league:FootballLeague}){
 const x=audit.leagues[league];
 const state=(code:FootballLeague)=>selectFootballMarketModel(code)?'第二輪比分模型已通過（見上方）':selectExternalFootballModel(code)?'新模型通過・觀察中':selectFootballCalibration(code).parameters?'保留原校準模型':'保留基礎模型';
 return <details className="football-method" open><summary>外部資料補強與模型驗收</summary>
  <p>本區為第一輪候選紀錄；德甲與義甲最新狀態請見第二輪驗收。已核對 {audit.historyGames.toLocaleString()} 場賽果：Understat 提供五大聯賽比分與逐場 xG，OpenFootball 補齊2011年起歐冠歷史。ESPN 更新現季資料並交叉核對，兩場已知比分衝突已排除。</p>
  <div className="football-audit-scroll"><table><caption>第一輪候選 Log loss：原模型 → 候選，越低越好</caption><thead><tr><th>聯賽／目前狀態</th><th>2019–2020獨立測試</th><th>2025驗收</th><th>2026驗收</th></tr></thead><tbody>{FOOTBALL_LEAGUES.map(l=>{const e=audit.leagues[l.code];return <tr key={l.code}><th>{l.name}<small>{state(l.code)}</small></th>{(['holdout','audit2025','audit2026'] as const).map(k=><td key={k}>{decimal(e.metrics[k].baseline.logLoss)} → {decimal(e.metrics[k].candidate.logLoss)}<small>{e.sampleSizes[k]} 場</small></td>)}</tr>;})}</tbody></table></div>
  <h3>{FOOTBALL_LEAGUES.find(l=>l.code===league)?.name}：{state(league)}</h3>
  {!!x.reasons.length&&<p>第一輪候選未啟用：{x.reasons.map(reason).join('；')}。</p>}
  <p>訓練 {x.sampleSizes.training} 場、選參數 {x.sampleSizes.selection} 場。五大聯賽採2015–2016訓練，歐冠採2012–2016訓練；2017–2018選參數，2019–2020是此次首次使用的獨立測試。2025及2026曾檢視過，另列近期驗收，不當成新的未見測試。</p>
  <div className="football-audit-scroll"><table><caption>所選聯賽新候選檢查（基礎 → 候選）</caption><thead><tr><th>指標</th><th>獨立測試</th><th>2025</th><th>2026</th></tr></thead><tbody>{([['brier','勝和負 Brier'],['over25Brier','大小2.5球 Brier'],['bttsBrier','雙方進球 Brier']] as const).map(([key,label])=><tr key={key}><th>{label}</th>{(['holdout','audit2025','audit2026'] as const).map(k=><td key={k}>{decimal(x.metrics[k].baseline[key])} → {decimal(x.metrics[k].candidate[key])}</td>)}</tr>)}<tr><th>Log loss變化95%區間</th>{(['holdout','audit2025','audit2026'] as const).map(k=><td key={k}>{x.metrics[k].logLossChangeCI95.map(decimal).join(' ～ ')}</td>)}</tr></tbody></table></div>
  <p>選參數、獨立測試及兩個近期驗收都須改善勝和負 Log loss、Brier 不變差，大小球與雙方進球 Brier 增幅不超過0.002。週區塊重抽樣1,000次估計區間；跨零代表改善仍有不確定性，通過不代表已證明未來更準。</p>
  <p>英超、法甲使用歷史 xG、比分、對手 Elo、時間衰減及場地差異；歐冠使用比分與 Elo，不假設有 xG。每隊至少5場，xG模型另需至少5場且覆蓋80%。只採預測當日前的比賽，資料過舊、球隊未核對或來源失敗時保留原模型。</p>
  <p>目前仍缺確認先發、傷停與實際盤口。歷史賽果可能經供應商修正，並非當時的即時快照。未通過的候選不會反覆調整測試到通過；有效至 {audit.expiresAt.slice(0,10)}，到期保留原有模型。逐場使用情況及資料不足原因可在下方診斷查詢。</p>
 </details>;
}
