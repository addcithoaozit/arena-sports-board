export const FOOTBALL_LEAGUES = [
  {code:'eng.1',name:'英超',fullName:'英格蘭超級聯賽'},
  {code:'esp.1',name:'西甲',fullName:'西班牙甲級聯賽'},
  {code:'ita.1',name:'義甲',fullName:'義大利甲級聯賽'},
  {code:'ger.1',name:'德甲',fullName:'德國甲級聯賽'},
  {code:'fra.1',name:'法甲',fullName:'法國甲級聯賽'},
  {code:'uefa.champions',name:'歐冠',fullName:'歐洲冠軍聯賽'},
] as const;
export type FootballLeague = typeof FOOTBALL_LEAGUES[number]['code'];
export type FootballTeam = {id:string;name:string;englishName:string};
export type FootballGame = {
  id:string;league:FootballLeague;season:number;start:string;timeConfirmed:boolean;
  home:FootballTeam;away:FootballTeam;homeScore:number|null;awayScore:number|null;
  state:'scheduled'|'live'|'final'|'other';statusName:string;statusLabel:string;
  neutral:boolean;venue:string;sourceUrl:string;
};
export type FootballForm = {games:number;venueGames:number;scored:number;conceded:number;recent:string[];latest:string|null};
export type FootballAnalysis = {
  status:'ready'|'waiting'|'closed';reason:string;version:string;capturedAt:string;
  homeForm?:FootballForm;awayForm?:FootballForm;
  expected?:{home:number;away:number};probabilities?:{home:number;draw:number;away:number;over25:number;under25:number;btts:number};
  scores?:{home:number;away:number;probability:number}[];lean?:string;notes:string[];
};
const TEAM_NAMES:Record<string,string> = {
  'AFC Bournemouth':'伯恩茅斯','Racing Santander':'桑坦德競技','Venezia':'威尼斯','Troyes':'特魯瓦','Le Mans':'勒芒',
  'Arsenal':'阿森納','Manchester City':'曼城','Manchester United':'曼聯','Liverpool':'利物浦','Chelsea':'切爾西','Tottenham Hotspur':'熱刺','Newcastle United':'紐卡索聯','Aston Villa':'阿斯頓維拉','Brighton & Hove Albion':'布萊頓','Fulham':'富勒姆','Everton':'艾佛頓','Brentford':'布倫特福德','Crystal Palace':'水晶宮','Nottingham Forest':'諾丁漢森林','West Ham United':'西漢姆聯','Leeds United':'里茲聯','Bournemouth':'伯恩茅斯','Wolverhampton Wanderers':'狼隊','Burnley':'伯恩利','Sunderland':'桑德蘭','Hull City':'赫爾城','Coventry City':'考文垂','Ipswich Town':'伊普斯維奇',
  'Real Madrid':'皇家馬德里','Barcelona':'巴塞隆納','Atlético Madrid':'馬德里競技','Atletico Madrid':'馬德里競技','Athletic Club':'畢爾包','Real Sociedad':'皇家社會','Real Betis':'皇家貝提斯','Sevilla':'塞維利亞','Villarreal':'比利亞雷亞爾','Valencia':'瓦倫西亞','Girona':'赫羅納','Espanyol':'西班牙人','Getafe':'赫塔費','Osasuna':'奧薩蘇納','Celta Vigo':'塞爾塔','Mallorca':'馬略卡','Rayo Vallecano':'巴列卡諾','Alavés':'阿拉維斯','Levante':'萊萬特','Elche':'埃爾切',
  'Internazionale':'國際米蘭','Inter Milan':'國際米蘭','AC Milan':'AC米蘭','Juventus':'尤文圖斯','Napoli':'拿坡里','AS Roma':'羅馬','Roma':'羅馬','Lazio':'拉齊奧','Atalanta':'亞特蘭大','Fiorentina':'佛羅倫斯','Bologna':'波隆那','Torino':'都靈','Udinese':'烏迪內斯','Genoa':'熱那亞','Como':'科莫','Parma':'帕爾馬','Lecce':'萊切','Cagliari':'卡利亞里','Sassuolo':'薩索洛','Pisa':'比薩','Cremonese':'克雷莫納','Hellas Verona':'維羅納',
  'Bayern Munich':'拜仁慕尼黑','Borussia Dortmund':'多特蒙德','Bayer Leverkusen':'勒沃庫森','RB Leipzig':'RB萊比錫','Eintracht Frankfurt':'法蘭克福','VfB Stuttgart':'斯圖加特','VfL Wolfsburg':'沃爾夫斯堡','Borussia Mönchengladbach':'門興','SC Freiburg':'弗萊堡','Mainz':'美因茨','1. FC Union Berlin':'柏林聯','FC Augsburg':'奧格斯堡','TSG Hoffenheim':'霍芬海姆','Werder Bremen':'不來梅','Hamburg SV':'漢堡','1. FC Köln':'科隆','1. FC Heidenheim 1846':'海登海姆','St. Pauli':'聖保利',
  'Paris Saint-Germain':'巴黎聖日耳曼','Marseille':'馬賽','AS Monaco':'摩納哥','Monaco':'摩納哥','Lyon':'里昂','Lille':'里爾','Nice':'尼斯','Lens':'朗斯','Stade Rennais':'雷恩','Rennes':'雷恩','Strasbourg':'史特拉斯堡','Toulouse':'圖盧茲','Nantes':'南特','Brest':'布雷斯特','AJ Auxerre':'歐塞爾','Angers':'昂熱','Le Havre AC':'勒阿弗爾','Paris FC':'巴黎FC','Metz':'梅斯','Lorient':'洛里昂',
  'Benfica':'本菲卡','FC Porto':'波爾圖','Sporting CP':'里斯本競技','Ajax Amsterdam':'阿賈克斯','PSV Eindhoven':'PSV恩荷芬','Feyenoord Rotterdam':'飛燕諾','Celtic':'塞爾提克','Galatasaray':'加拉塔薩雷','Club Brugge':'布魯日','Union St.-Gilloise':'聖吉羅斯聯','Bodø/Glimt':'博多格林特',
};
export const footballDay=(date:Date|string=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(date));
export const shiftFootballDay=(day:string,offset:number)=>new Date(Date.parse(day+'T12:00:00Z')+offset*86400000).toISOString().slice(0,10);
export function validFootballDay(day:string){return /^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day))&&new Date(day).toISOString().slice(0,10)===day;}
export function isFootballLeague(value:string):value is FootballLeague{return FOOTBALL_LEAGUES.some(l=>l.code===value);}
function goals(raw:any):number|null{
  const value=typeof raw==='object'&&raw!==null?raw.value:raw;
  if(value===null||value===undefined||value==='')return null;
  const n=Number(value);return Number.isInteger(n)&&n>=0&&n<=30?n:null;
}
export function parseFootballEvents(data:any,league:FootballLeague):FootballGame[]{
  if(!Array.isArray(data?.events))throw Error('足球來源格式改變');
  const games=new Map<string,FootballGame>();
  for(const event of data.events){
    if(event.league?.slug&&event.league.slug!==league)continue;
    const c=event.competitions?.[0],home=c?.competitors?.find((t:any)=>t.homeAway==='home'),away=c?.competitors?.find((t:any)=>t.homeAway==='away');
    const status=c?.status||event.status,type=status?.type,start=c?.date||event.date;
    if(!home?.team?.id||!away?.team?.id||String(home.team.id)===String(away.team.id)||!/^\d+$/.test(String(event.id))||!Number.isFinite(Date.parse(start)))continue;
    const statusName=String(type?.name||'');
    const state:FootballGame['state']=statusName==='STATUS_SCHEDULED'&&type?.state==='pre'?'scheduled':type?.state==='in'&&!/POSTPONED|CANCELED|SUSPENDED|ABANDONED/.test(statusName)?'live':type?.completed===true&&type?.state==='post'?'final':'other';
    const labels:Record<string,string>={STATUS_POSTPONED:'延期',STATUS_CANCELED:'取消',STATUS_CANCELLED:'取消',STATUS_SUSPENDED:'暫停',STATUS_ABANDONED:'中止',STATUS_FULL_TIME:'完場',STATUS_FINAL_AET:'加時完場',STATUS_FINAL_PEN:'互射十二碼完場',STATUS_HALFTIME:'中場休息'};
    const timeConfirmed=(c?.timeValid??event.timeValid)===true;
    const team=(value:any):FootballTeam=>{const englishName=String(value.team.displayName||value.team.name||'未知球隊');return {id:String(value.team.id),name:TEAM_NAMES[englishName]||englishName,englishName};};
    games.set(String(event.id),{id:String(event.id),league,season:Number(event.season?.year)||new Date(start).getUTCFullYear(),start:new Date(start).toISOString(),timeConfirmed,home:team(home),away:team(away),homeScore:state==='live'||state==='final'?goals(home.score):null,awayScore:state==='live'||state==='final'?goals(away.score):null,state,statusName,statusLabel:labels[statusName]||(state==='live'?`進行中 ${String(status.displayClock||'')}`:state==='scheduled'?(timeConfirmed?'未開賽':'開賽時間待定'):'狀態待確認'),neutral:c?.neutralSite===true,venue:String(c?.venue?.fullName||''),sourceUrl:`https://www.espn.com/soccer/match/_/gameId/${event.id}`});
  }
  return [...games.values()];
}
export function footballForm(teamId:string,venue:'home'|'away',history:FootballGame[],before:number,neutral=false):FootballForm{
  const unique=[...new Map(history.map(g=>[g.id,g])).values()];
  // Only confirmed regulation-time finals enter the model. AET/penalty results are not 90-minute scores.
  const rows=unique.filter(g=>g.statusName==='STATUS_FULL_TIME'&&g.state==='final'&&g.homeScore!==null&&g.awayScore!==null&&Date.parse(g.start)<before&&Date.parse(g.start)>=before-365*86400000&&(g.home.id===teamId||g.away.id===teamId)).sort((a,b)=>Date.parse(b.start)-Date.parse(a.start)).slice(0,20);
  const split=rows.filter(g=>!g.neutral&&g[venue].id===teamId);
  function mean(list:FootballGame[],kind:'scored'|'conceded'){
    let sum=0,weights=0;for(const g of list){const home=g.home.id===teamId,w=Math.exp(-(before-Date.parse(g.start))/(90*86400000));sum+=(kind==='scored'?(home?g.homeScore!:g.awayScore!):(home?g.awayScore!:g.homeScore!))*w;weights+=w;}return weights?sum/weights:0;
  }
  const rate=(kind:'scored'|'conceded')=>!neutral&&split.length>=3?.6*mean(split,kind)+.4*mean(rows,kind):mean(rows,kind);
  return {games:rows.length,venueGames:split.length,scored:rate('scored'),conceded:rate('conceded'),latest:rows[0]?.start||null,recent:rows.slice(0,5).map(g=>{const delta=g.home.id===teamId?g.homeScore!-g.awayScore!:g.awayScore!-g.homeScore!;return delta>0?'勝':delta<0?'負':'和';})};
}
export function footballDistribution(home:number,away:number){
  const poisson=(lambda:number)=>{const out=[Math.exp(-lambda)];for(let n=1;n<=20;n++)out.push(out[n-1]*lambda/n);return out;};
  const h=poisson(home),a=poisson(away),scores:{home:number;away:number;probability:number}[]=[];
  let mass=0;for(let x=0;x<h.length;x++)for(let y=0;y<a.length;y++){const p=h[x]*a[y];scores.push({home:x,away:y,probability:p});mass+=p;}
  const probabilities={home:0,draw:0,away:0,over25:0,under25:0,btts:0};
  for(const s of scores){s.probability/=mass;probabilities[s.home>s.away?'home':s.home<s.away?'away':'draw']+=s.probability;probabilities[s.home+s.away>2?'over25':'under25']+=s.probability;if(s.home>0&&s.away>0)probabilities.btts+=s.probability;}
  return {probabilities,scores:scores.sort((a,b)=>b.probability-a.probability).slice(0,3)};
}
export function analyzeFootball(game:FootballGame,history:FootballGame[],now=Date.now()):FootballAnalysis{
  const base={version:'football-form-poisson-v1',capturedAt:new Date(now).toISOString(),notes:['以最近一年同項賽事、最多20場正式90分鐘賽果計算；近期比賽權重較高。','主客場至少3場時採主客場60%＋整體40%；不足時採整體。每隊至少5場。','未納入先發、傷停、實際xG與賠率；尚未回測校準，機率是模型估計。','所有預測均為90分鐘含補時，不含加時與互射十二碼。']};
  if(game.state!=='scheduled'||Date.parse(game.start)<=now)return {...base,status:'closed',reason:'已開賽、完場或非正常賽程，不提供賽前分析。'};
  if(!game.timeConfirmed)return {...base,status:'waiting',reason:'開賽時間尚未確認。'};
  const cutoff=Math.min(now,Date.parse(game.start)),clean=history.filter(g=>g.league===game.league&&g.id!==game.id);
  const homeForm=footballForm(game.home.id,'home',clean,cutoff,game.neutral),awayForm=footballForm(game.away.id,'away',clean,cutoff,game.neutral);
  if(homeForm.games<5||awayForm.games<5)return {...base,homeForm,awayForm,status:'waiting',reason:`同賽事歷史不足：主隊${homeForm.games}場、客隊${awayForm.games}場；各需至少5場。`};
  if([homeForm,awayForm].some(f=>!f.latest||cutoff-Date.parse(f.latest)>120*86400000))return {...base,homeForm,awayForm,status:'waiting',reason:'近期賽果超過120天，等待較新的比賽資料。'};
  const clamp=(v:number)=>Math.max(.15,Math.min(5,v));
  const expected={home:clamp((homeForm.scored+awayForm.conceded)/2),away:clamp((awayForm.scored+homeForm.conceded)/2)};
  const result=footballDistribution(expected.home,expected.away),p=result.probabilities;
  const best=[{name:'主勝',p:p.home},{name:'和局',p:p.draw},{name:'客勝',p:p.away}].sort((a,b)=>b.p-a.p);
  const lean=best[0].p-best[1].p>=.08?`模型傾向${best[0].name}`:'勝負接近，保留觀望';
  return {...base,status:'ready',reason:'',homeForm,awayForm,expected,...result,lean};
}
