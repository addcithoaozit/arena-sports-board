'use client';
import {useState} from 'react';
import {FOOTBALL_LEAGUES,type FootballLeague} from '@/lib/football';
import FootballValidation from '../football-validation';
export default function FootballModelAdmin(){
 const [league,setLeague]=useState<FootballLeague>('eng.1');
 return <section className="panel space-y-4 p-5" aria-label="足球模型與回測管理">
  <h2 className="text-lg font-bold">足球模型與回測管理</h2>
  <label className="flex flex-wrap items-center gap-3 text-sm">查看聯賽<select className="rounded-lg border border-white/20 bg-[#101d2c] px-3 py-2 text-slate-100" value={league} onChange={e=>setLeague(e.target.value as FootballLeague)}>{FOOTBALL_LEAGUES.map(l=><option key={l.code} value={l.code}>{l.fullName}</option>)}</select></label>
  <FootballValidation league={league}/>
  <details className="football-method"><summary>分析方式與資料範圍</summary><p>使用最近一年同項賽事、最多20場正式90分鐘賽果，每隊至少5場。基礎模型採90天時間衰減，主客場樣本足夠時使用60%場地權重；中立場不採場地加權。</p><p>通過歷史驗收的西甲使用180天衰減、訓練得到的進攻防守係數與低比分修正；其餘聯賽保留基礎模型。各市場機率由同一比分分布計算，2.5球為固定分析基準。</p><p>分析含90分鐘補時，不含加時及互射十二碼。排除延期、缺比分與衝突賽果。尚未納入先發、傷停、實際xG、對手強度與賠率；抓取時間不代表供應商更新時間。</p></details>
 </section>;
}
