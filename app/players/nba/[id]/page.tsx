import {notFound} from 'next/navigation';
import NbaPlayerProfile from '@/app/nba-player-profile';
export const dynamic='force-dynamic';
export const metadata={title:'NBA 球員數據｜YJ體育分析'};
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;if(!/^\d{1,10}$/.test(id)||Number(id)<=0)notFound();return <NbaPlayerProfile key={id} id={Number(id)}/>;}
