"use client";
import {useEffect,useState} from 'react';
import InternationalBoard from '../../international-board';
import SuperWorkspace,{SuperEntryButton} from '../../super-workspace';
import {useLeagueLive} from '../../use-league-live';
import SessionAccount from '../../session-account';
const leagues=[{code:'CPBL',name:'中華職棒'},{code:'KBO',name:'韓國職棒'}] as const;
type League=typeof leagues[number]['code'];
export default function LeagueWorkspace(){
 const [league,setLeague]=useState<League>('CPBL'),[view,setView]=useState('analysis');const live=useLeagueLive();
 useEffect(()=>{const p=new URLSearchParams(window.location.search),code=p.get('league');if(leagues.some(l=>l.code===code))setLeague(code as League);if(['analysis','overview','teams','standings','live'].includes(p.get('view')||''))setView(p.get('view')!);},[]);
 return <SuperWorkspace league={league}><main className="arena-shell min-h-screen text-slate-100"><header className="border-b border-white/10 bg-[#081522]/95"><div className="mx-auto flex max-w-[1440px] flex-wrap items-center gap-3 px-5 py-4"><a className="header-action" href="/admin">返回管理後台</a><a className="header-action" href="/">返回棒球</a><h1 className="font-bold">後台聯盟賽事與分析</h1><div className="ml-auto flex items-center gap-3"><SuperEntryButton/><SessionAccount/></div></div></header><div className="mx-auto max-w-[1440px] space-y-5 px-4 py-6 lg:px-7"><nav className="league-switcher" aria-label="後台棒球聯盟切換">{leagues.map(l=><button key={l.code} type="button" aria-pressed={league===l.code} onClick={()=>{setLeague(l.code);window.history.replaceState(null,'',`/admin/leagues?league=${l.code}`);}}><b>{l.code}</b><span>{l.name}</span>{live[l.code]&&<i>LIVE</i>}</button>)}</nav><div data-super-league={league}><InternationalBoard key={league} league={league} initialView={view}/></div></div></main></SuperWorkspace>;
}
