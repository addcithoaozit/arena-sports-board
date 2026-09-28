import {notFound} from 'next/navigation';
import {isFootballLeague,validFootballDay} from '@/lib/football';
import FootballTeamProfile from '@/app/football-team-profile';
export const dynamic='force-dynamic';
export const metadata={title:'足球球隊數據｜YJ體育分析'};
export default async function FootballTeamPage({params,searchParams}:{params:Promise<{league:string;id:string}>;searchParams:Promise<{date?:string}>}){
 const {league,id}=await params,{date}=await searchParams;if(!isFootballLeague(league)||!/^\d{1,12}$/.test(id))notFound();
 return <FootballTeamProfile key={`${league}:${id}`} league={league} teamId={id} returnDay={typeof date==='string'&&validFootballDay(date)?date:undefined}/>;
}
