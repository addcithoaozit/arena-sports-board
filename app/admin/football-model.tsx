'use client';
import {useState} from 'react';
import {FOOTBALL_LEAGUES,type FootballLeague} from '@/lib/football';
import FootballValidation from '../football-validation';
import FootballExternalValidation from './football-external-validation';
import FootballMarketValidation from './football-market-validation';
import FootballDiagnostics from './football-diagnostics';
export default function FootballModelAdmin(){
 const [league,setLeague]=useState<FootballLeague>('eng.1');
 return <section className="panel space-y-4 p-5" aria-label="足球模型與回測管理">
  <h2 className="text-lg font-bold">足球模型與回測管理</h2>
  <label className="flex flex-wrap items-center gap-3 text-sm">查看聯賽<select className="rounded-lg border border-white/20 bg-[#101d2c] px-3 py-2 text-slate-100" value={league} onChange={e=>setLeague(e.target.value as FootballLeague)}>{FOOTBALL_LEAGUES.map(l=><option key={l.code} value={l.code}>{l.fullName}</option>)}</select></label>
  <FootballMarketValidation league={league}/>
  <FootballExternalValidation league={league}/>
  <FootballValidation league={league}/>
  <FootballDiagnostics league={league}/>
  <details className="football-method"><summary>分析方式與資料範圍</summary><p>優先使用最近一年同項賽事、最多20場正式90分鐘賽果，每隊至少5場。同賽事不足10場或最近賽果超過120天時，自動抓取球隊本季與上季其他正式賽事；跨賽事權重0.35，排除加時及十二碼。球會不採友誼賽。國家聯賽正式賽仍不足5場或過舊時，補入近期成年國家隊國際友誼賽，權重0.2；與球會資料分開計算。</p><p>基礎模型採90天衰減與60%場地權重，中立場不採場地加權。英超、法甲與歐冠可使用通過的新外部資料模型，西甲保留原校準模型，德甲與義甲使用通過第二輪驗收的比分模型；補充跨賽事的預測使用獨立版本，尚未完成校準驗收。各市場機率由同一比分分布計算，2.5球為固定分析基準。</p><p>排除延期、缺比分與衝突賽果。新模型加入歷史xG（英超、法甲）與對手強度；尚未納入先發、傷停與賠率。抓取時間不代表供應商更新時間。前台隱藏診斷文字，仍缺有效資料時不會產生機率。</p></details>
 </section>;
}
