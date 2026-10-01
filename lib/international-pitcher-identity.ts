import {internationalTeam} from './international-teams';
const compact=(s:string)=>s.normalize('NFKC').replace(/[\s・·.]/g,'').toLowerCase();
// Explicit, team-scoped pairs checked against the NPB announcement and the
// matching Playsport fixture. Do not fuzzy-match surnames across rosters.
export function pitcherIdentity(name:string,league:string,team:string){
 const n=compact(name),t=internationalTeam(team,league);
 if(league==='NPB'&&t==='阪神虎'&&['lucas','eルーカス','ルーカス'].includes(n))return 'npb-t-lucas';
 if(league==='NPB'&&t==='千葉羅德海洋'&&['jackson','aジャクソン','ジャクソン'].includes(n))return 'npb-m-jackson';
 // NPB announcement/season table uses ルケーシー; Sportsnavi uses J・ルケーシー.
 if(league==='NPB'&&t==='千葉羅德海洋'&&['ルケーシー','jルケーシー'].includes(n))return 'npb-m-lucchesi';
 // NPB season row ロング and the announced starter S・ロング are
 // the same Chiba pitcher; retain team scope and reject other initials.
 if(league==='NPB'&&t==='千葉羅德海洋'&&['ロング','sロング'].includes(n))return 'npb-m-long';
 return n;
}
