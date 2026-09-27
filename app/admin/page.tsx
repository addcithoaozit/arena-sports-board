import '../football.css';
import { ArrowLeft, LogOut, ShieldCheck } from 'lucide-react';
import BackgroundRefresh from './background-refresh';
import { adminIdentity } from '../admin-access';
import SessionAccount from '../session-account';
import AdminTools from './tools';
import SectionBoundary from './section-boundary';
import TurnstileSettings from './turnstile-settings';
import Accounts from './accounts';
import ResearchPanel from './research-panel';
import CpblMarketStatus from './cpbl-market-status';
import PregameImports from './pregame-imports';
import InternationalMarketStatus from './international-market-status';
import InternationalData from './international-data';
import TwtoolsReference from './twtools-reference';
import InternationalValidation from './international-validation';
import FootballModelAdmin from './football-model';
export const dynamic = 'force-dynamic';
export default async function AdminPage() {
  const identity=await adminIdentity();
  if (!identity) return <main className="mx-auto max-w-3xl space-y-4 px-5 py-10"><h1 className="text-2xl font-bold">僅限管理者存取</h1><p>目前登入的帳號沒有後台權限。</p><a className="underline" href="/login">使用管理員帳號登入</a><p><a href="/" className="underline">返回前台</a></p></main>;
  return <main className="arena-shell min-h-screen text-slate-100">
    <header className="border-b border-white/8 bg-[#081522]/95"><div className="mx-auto flex min-h-16 max-w-[1440px] flex-wrap items-center gap-3 px-5 py-3"><a href="/" className="header-action"><ArrowLeft className="size-4"/>返回賽事</a><div className="flex items-center gap-2 font-black"><ShieldCheck className="size-5 text-[#ffd538]"/>YJ體育分析・管理後台</div><div className="ml-auto"><SessionAccount/></div></div></header>
    <div className="mx-auto max-w-[1440px] space-y-5 px-5 py-8"><div className="admin-title"><div><p className="league-eyebrow">系統管理</p><h1>帳號與資料管理</h1></div><span>管理員</span></div><section className="panel p-5"><h2 className="text-lg font-bold">三聯盟賽事與分析</h2><p className="mt-1 text-sm text-slate-400">CPBL、NPB、KBO 暫移至後台管理。</p><nav className="mt-3 flex flex-wrap gap-3" aria-label="後台聯盟入口">{[['CPBL','中華職棒'],['NPB','日本職棒'],['KBO','韓國職棒']].map(([code,name])=><a key={code} className="header-action" href={`/admin/leagues?league=${code}`}>{code} {name}</a>)}</nav></section><SectionBoundary><BackgroundRefresh/></SectionBoundary><SectionBoundary><TurnstileSettings/></SectionBoundary><Accounts/><SectionBoundary><CpblMarketStatus/></SectionBoundary><SectionBoundary><InternationalMarketStatus league="NPB"/></SectionBoundary><SectionBoundary><InternationalMarketStatus league="KBO"/></SectionBoundary><SectionBoundary><InternationalValidation/></SectionBoundary><SectionBoundary><FootballModelAdmin/></SectionBoundary><SectionBoundary><PregameImports/></SectionBoundary><SectionBoundary><TwtoolsReference/></SectionBoundary><SectionBoundary><InternationalData/></SectionBoundary><SectionBoundary><ResearchPanel/></SectionBoundary><AdminTools/></div>
  </main>;
}
