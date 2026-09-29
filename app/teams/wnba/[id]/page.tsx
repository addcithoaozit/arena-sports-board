import {notFound} from 'next/navigation';
import {wnbaTeam,validWnbaDay} from '@/lib/wnba';
import NbaTeamProfile from '@/app/nba-team-profile';
export const dynamic='force-dynamic';
export const metadata={title:'WNBA 球隊數據｜YJ體育分析'};
export default async function NbaTeamPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{date?:string}>}){
 const {id}=await params,{date}=await searchParams;if(!wnbaTeam(id))notFound();
 return <NbaTeamProfile league="WNBA" key={id} id={id} returnDay={typeof date==='string'&&validWnbaDay(date)?date:undefined}/>;
}
