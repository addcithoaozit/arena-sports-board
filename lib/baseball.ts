export type Kind = 'pitcher' | 'batter-team' | 'pitcher-team';
export type StatRow = { id:string; name:string; teamId:number|null; attempts:number; ev:number|null; maxEv:number|null; hardHit:number|null; barrel:number|null; barrelPa:number|null; sweetSpot:number|null };
export type Snapshot = { rows:StatRow[]; fetchedAt:string; source:string; year:number; kind:Kind };
export const teamIds:Record<string,number>={LAA:108,AZ:109,ARI:109,BAL:110,BOS:111,CHC:112,CIN:113,CLE:114,COL:115,DET:116,HOU:117,KC:118,KCR:118,LAD:119,WSH:120,WSN:120,NYM:121,ATH:133,OAK:133,PIT:134,SD:135,SDP:135,SEA:136,SF:137,SFG:137,STL:138,TB:139,TBR:139,TEX:140,TOR:141,MIN:142,PHI:143,ATL:144,CWS:145,CHW:145,MIA:146,NYY:147,MIL:158};
export function parseCsv(text:string):string[][] {
  const rows:string[][]=[];let row:string[]=[],field='',quoted=false;
  text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++) {const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(field);field='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(field);if(row.some(Boolean))rows.push(row);row=[];field='';}else field+=c;}
  if(quoted)throw new Error('CSV 引號格式錯誤');
  row.push(field);if(row.some(Boolean))rows.push(row);return rows;
}
export function parseStats(text:string,kind:Kind):StatRow[]{
  const [headers,...rows]=parseCsv(text);const identity=kind==='pitcher'?'player_id':'team_id';
  if(!headers||![identity,'attempts','avg_hit_speed','ev95percent','brl_percent','brl_pa'].every(h=>headers.includes(h)))throw new Error('資料欄位格式改變');
  const at=(row:string[],key:string)=>row[headers.indexOf(key)]?.trim();
  const num=(row:string[],key:string)=>{const x=at(row,key);return x&&Number.isFinite(Number(x))?Number(x):null;};
  const rate=(row:string[],key:string)=>{const x=num(row,key);return x!==null&&x>=0&&x<=100?x:null;};
  const result=rows.map(row=>({id:at(row,identity)||'',name:at(row,kind==='pitcher'?'last_name, first_name':'team')||'',teamId:kind==='pitcher'?null:teamIds[at(row,'team_id')||'']??null,attempts:num(row,'attempts')??0,ev:num(row,'avg_hit_speed'),maxEv:num(row,'max_hit_speed'),hardHit:rate(row,'ev95percent'),barrel:rate(row,'brl_percent'),barrelPa:rate(row,'brl_pa'),sweetSpot:rate(row,'anglesweetspotpercent')})).filter(r=>r.id&&r.name&&r.attempts>0);
  if(!result.length)throw new Error('來源沒有有效資料');return result;
}
export type TeamSide={id:number;name:string;wins:number|null;losses:number|null;pitcherId:number|null;pitcherName:string;pitcherEra?:number|null;pitcherWhip?:number|null};
export type Match={id:number;date:string;season:number;gameType:string;state:string;status:string;startTimeTBD:boolean;doubleHeader?:string;gameNumber?:number;away:TeamSide;home:TeamSide};
export type Schedule={games:Match[];fetchedAt:string;source:string};
export function doubleheaderLabel(g:Pick<Match,'doubleHeader'|'gameNumber'>):'G1'|'G2'|null {
  if(g.doubleHeader!=='Y'&&g.doubleHeader!=='S')return null;
  return g.gameNumber===1?'G1':g.gameNumber===2?'G2':null;
}
export function taipeiDay(time:number|string=Date.now()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(time));}
export function shiftDay(date:string,days:number){return new Date(Date.parse(date+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);}
export function log5(aw:number,al:number,hw:number,hl:number):number|null {
  if([aw,al,hw,hl].some(x=>!Number.isInteger(x)||x<0)||aw+al<20||hw+hl<20)return null;
  // Ten notional wins and ten losses shrink small samples toward .500.
  const a=(aw+10)/(aw+al+20),h=(hw+10)/(hw+hl+20);
  return (h-h*a)/(h+a-2*h*a);
}
export function isMlbPostseason(gameType:string){return ['F','D','L','W'].includes(gameType);}
export function isMlbAnalysisGame(gameType:string){return gameType==='R'||isMlbPostseason(gameType);}
export function isPregame(g:Match,now:number){return isMlbAnalysisGame(g.gameType)&&g.state==='Preview'&&!g.startTimeTBD&&['Scheduled','Pre-Game','Warmup'].includes(g.status)&&Date.parse(g.date)>now;}
// A TBD start is not evidence that the game has started. Quotes may be viewed,
// but isPregame continues to block predictions until the start is confirmed.
export function canShowPregameMarkets(g:Match,now:number){return isPregame(g,now)||(isMlbAnalysisGame(g.gameType)&&g.state==='Preview'&&g.startTimeTBD&&['Scheduled','Pre-Game','Warmup'].includes(g.status));}
export function matchStartLabel(g:Match){
 const date=new Date(g.date);
 if(!Number.isFinite(date.getTime()))return '開賽時間待確認';
 const day=date.toLocaleDateString('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit'});
 if(g.startTimeTBD)return `${day} ${g.doubleHeader==='Y'&&g.gameNumber===2?'G1 結束後，開賽時間待定':'開賽時間待定'}（台灣）`;
 return date.toLocaleString('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})+'（台灣）';
}
export function fresh(stamp:string|undefined,now:number,ttl:number){if(!stamp)return false;const age=now-Date.parse(stamp);return Number.isFinite(age)&&age>=-60000&&age<=ttl;}
export function baseProbability(g:Match){const {away:a,home:h}=g;return [a.wins,a.losses,h.wins,h.losses].some(v=>v===null)?null:log5(a.wins!,a.losses!,h.wins!,h.losses!);}
export type Leg={gameId:number;side:'away'|'home'};
export function suggest(matches:Match[],count:number):Leg[]{
  if(![3,4,5].includes(count))return [];
  const used=new Set<number>(),legs:Leg[]=[];
  const ranked=matches.map(g=>({g,p:baseProbability(g)})).filter(x=>x.p!==null).sort((a,b)=>Math.max(b.p!,1-b.p!)-Math.max(a.p!,1-a.p!)||a.g.id-b.g.id);
  for(const {g,p} of ranked){if(p===.5||used.has(g.home.id)||used.has(g.away.id))continue;used.add(g.home.id);used.add(g.away.id);legs.push({gameId:g.id,side:p!>.5?'home':'away'});if(legs.length===count)break;}
  return legs;
}
