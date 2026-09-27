import {isSiteAdmin} from '@/app/admin-access';
import {getRawDb} from '@/db';
import {footballLiveAudit} from '@/lib/football-ledger';
import validation from '@/data/football/calibration-runtime.json';
import externalValidation from '@/data/football/external-calibration-runtime.json';
import marketValidation from '@/data/football/market-calibration-runtime.json';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(){
 if(!await isSiteAdmin())return Response.json({error:'僅限管理員'},{status:403,headers});
 const live=await footballLiveAudit(getRawDb()).catch(()=>({available:false,error:'賽前快照統計暫時無法讀取'}));
 return Response.json({validation,externalValidation,marketValidation,live},{headers});
}
