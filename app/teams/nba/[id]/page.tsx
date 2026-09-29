import {notFound} from 'next/navigation';
import {nbaTeam,validNbaDay} from '@/lib/nba';
import NbaTeamProfile from '@/app/nba-team-profile';
export const dynamic='force-dynamic';
export const metadata={title:'NBA 球隊數據｜YJ體育分析'};
export default async function NbaTeamPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{date?:string}>}){
 const {id}=await params,{date}=await searchParams;if(!nbaTeam(id))notFound();
 return <NbaTeamProfile key={id} id={id} returnDay={typeof date==='string'&&validNbaDay(date)?date:undefined}/>;
}
