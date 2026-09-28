import {notFound} from 'next/navigation';
import {npbPlayerId} from '@/lib/npb-player-profile';
import NpbPlayerProfile from '@/app/npb-player-profile';
export const metadata={title:'日職球員數據｜YJ體育分析'};
export default async function NpbPlayerPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!npbPlayerId(id))notFound();
 return <NpbPlayerProfile key={id} id={id}/>;
}
