import {adminIdentity} from '../../admin-access';
import LeagueWorkspace from './workspace';
import {redirect} from 'next/navigation';
import {frontSelection,leaguePageHref} from '@/lib/sport-navigation';
export const dynamic='force-dynamic';
export default async function AdminLeagues({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const params=await searchParams;
 if(params.league==='NPB')redirect(leaguePageHref('NPB',frontSelection(new URLSearchParams({view:typeof params.view==='string'?params.view:''}).toString()).view));
 if(!await adminIdentity())return <main className="mx-auto max-w-3xl space-y-4 px-5 py-10"><h1 className="text-2xl font-bold">僅限管理者存取</h1><p>目前登入的帳號沒有後台權限。</p><a href="/login" className="underline">使用管理員帳號登入</a><p><a href="/" className="underline">返回前台</a></p></main>;
 return <LeagueWorkspace/>;
}
