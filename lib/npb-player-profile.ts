import {plain} from './international';
import {internationalTeam} from './international-teams';
import {profileTeams} from './international-profile';
import type {PlayerGroup,PlayerStat} from './player-profile';

export type NpbPlayerLine={season:number;team:string;date:string;competition:string;stat:PlayerStat};
export type NpbPlayerGroup={season:PlayerStat|null;career:PlayerStat|null;history:NpbPlayerLine[];games:NpbPlayerLine[]};
export type NpbPlayerData={
 player:{id:string;name:string;number:string;position:string;team:string;teamCode:string;bio:[string,string][];photoUrls:string[];defaultGroup:PlayerGroup};
 sourceSeason:number;groups:Record<PlayerGroup,NpbPlayerGroup>;source:string;updatedAt:string;fetchedAt:string;stale?:boolean;
};
export const npbPlayerId=(value:string|null)=>!!value&&/^[1-9]\d{3,8}$/.test(value);
const fields:Record<string,string>={防御率:'era',登板:'gamesPlayed',試合:'gamesPlayed',先発:'gamesStarted',勝利:'wins',敗戦:'losses',セーブ:'saves',ホールド:'holds',投球回:'inningsPitched',被安打:'hits',自責点:'earnedRuns',与四球:'baseOnBalls',奪三振:'strikeOuts',WHIP:'whip',打率:'avg',打席:'plateAppearances',打数:'atBats',安打:'hits',二塁打:'doubles',三塁打:'triples',本塁打:'homeRuns',打点:'rbi',得点:'runs',盗塁:'stolenBases',四球:'baseOnBalls',三振:'strikeOuts',出塁率:'obp',長打率:'slg',OPS:'ops',投球数:'pitches',失点:'runsAllowed',死球:'hitByPitch',与死球:'hitByPitch'};
function tableRows(html:string){
 const carry=new Map<number,{value:string;left:number}>();
 return [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(tr=>{
  const row:string[]=[];let col=0;
  const inherited=()=>{while(carry.has(col)){const cell=carry.get(col)!;row[col]=cell.value;if(--cell.left===0)carry.delete(col);col++;}};
  for(const m of tr[1].matchAll(/<t[hd]\b([^>]*)>([\s\S]*?)<\/t[hd]>/gi)){
   inherited();const span=Math.min(30,Number(m[1].match(/colspan=["']?(\d+)/i)?.[1]||1)),down=Math.min(30,Number(m[1].match(/rowspan=["']?(\d+)/i)?.[1]||1));
   for(let i=0;i<span;i++){const value=i?'':plain(m[2]);row[col]=value;if(down>1)carry.set(col,{value,left:down-1});col++;}
  }
  inherited();return row;
 });
}
function readStat(headers:string[],values:string[]):PlayerStat{
 const stat:PlayerStat={};
 headers.forEach((h,i)=>{const key=fields[h.normalize('NFKC')];if(!key)return;const v=values[i]?.trim();stat[key]=v&&/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(v)?v:null;});
 return stat;
}
const classText=(html:string,tag:string,cls:string)=>plain(html.match(new RegExp(`<${tag}\\b[^>]*class=["'][^"']*\\b${cls}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/${tag}>`,'i'))?.[1]||'');
const teamName=(name:string)=>/^(?:通算|合計|計|\d+球団)/.test(name)?'合計':internationalTeam(name,'NPB');
function competition(text:string){
 if(/ファーム|イースタン|ウエスタン/.test(text))return /交流/.test(text)?'二軍交流賽':'二軍例行賽';
 if(/オープン/.test(text))return '熱身賽';
 if(/セ・パ交流/.test(text))return '一軍交流賽';
 if(/[セパ]・リーグ/.test(text))return '一軍例行賽';
 if(/クライマックス/.test(text))return '季後賽';
 if(/日本シリーズ/.test(text))return '日本大賽';
 return '其他賽事';
}

/** Only Sportsnavi's identified first-team tables supply season/career totals.
 * Recent appearances retain their own competition, including farm games. */
export function parseNpbPlayer(html:string,id:string,fetchedAt=new Date().toISOString()):NpbPlayerData{
 const source=`https://baseball.yahoo.co.jp/npb/player/${id}/top`;
 const canonical=html.match(/<meta\b[^>]*property=["']og:url["'][^>]*content=["']([^"']+)/i)?.[1];
 const name=classText(html.replace(/<rt\b[^>]*>[\s\S]*?<\/rt>/gi,''),'h2','bb-profile__name');
 if(!npbPlayerId(id)||canonical!==source||!name)throw Error('日職球員資料識別不符');
 const updatedAt=plain(html.match(/<time\b[^>]*class=["'][^"']*bb-tableNote__update[^"']*["'][^>]*>([\s\S]*?)<\/time>/i)?.[1]||'');
 const sourceSeason=Number(updatedAt.match(/^(\d{4})[/-]/)?.[1]);
 if(!sourceSeason||sourceSeason>Number(fetchedAt.slice(0,4)))throw Error('日職球員成績年度無法確認');
 const team=teamName(classText(html,'h2','bb-title02__title'));
 const teamCode=Object.entries(profileTeams.NPB).find(([,n])=>n===team)?.[0]||'';
 const position=classText(html,'p','bb-profile__position').replace('内野','內野');
 const rawBio=Object.fromEntries([...html.matchAll(/<dt\b[^>]*>([\s\S]*?)<\/dt>\s*<dd\b[^>]*>([\s\S]*?)<\/dd>/gi)].map(m=>[plain(m[1]),plain(m[2])]));
 const birth=rawBio['生年月日（満年齢）']||'',birthParts=birth.match(/(\d{4})年(\d+)月(\d+)日/),age=birth.match(/（(\d+)歳）/);
 const bio:[string,string][]=[['出生日期',birthParts?`${birthParts[1]} / ${birthParts[2].padStart(2,'0')} / ${birthParts[3].padStart(2,'0')}`:''],['年齡',age?`${age[1]} 歲`:''],['出生地',rawBio['出身地']],['身高',rawBio['身長']?.replace('cm',' 公分')],['體重',rawBio['体重']?.replace('kg',' 公斤')],['投打習慣',rawBio['投打']?.replace('両打','左右開弓').replace('投','投／')],['選秀',rawBio['ドラフト年（順位）']?.replace('位','順位')],['職業年資',rawBio['プロ通算年']]];
 const photo=html.match(/<img\b[^>]*class=["'][^"']*bb-profile__img[^"']*["'][^>]*src=["']([^"']+)/)?.[1]||'';
 const photoUrls=photo.match(new RegExp(`^https://sports-baseball\\.west\\.edge\\.storage-yahoo\\.jp/npb/images/player/(?:portrait|square)/\\d+/${id}\\.jpg$`))?[photo]:[];
 const groups={} as Record<PlayerGroup,NpbPlayerGroup>;
 const summaryEnd=html.indexOf('id="js-changeText01"');
 for(const group of ['pitching','hitting'] as const)groups[group]={season:null,career:null,history:[],games:[]};
 for(const table of html.matchAll(/<table\b([^>]*)>([\s\S]*?)<\/table>/gi)){
  if(!/\bbb-playerStatsTable\b/.test(table[1]))continue;
  const rows=tableRows(table[2]);
  const headers=rows[0]||[];
  const tableId=table[1].match(/\bid=["']([^"']+)/)?.[1];
  if(tableId==='year_p'||tableId==='year_b'){
   const g=groups[tableId==='year_p'?'pitching':'hitting'];
   if(headers[0]!=='年度'||headers[1]!=='チーム名')throw Error('日職歷年成績欄位變更');
   for(const row of rows.slice(1)){
    if(row.length!==headers.length)continue;
    if(row[0]==='通算成績'){g.career=readStat(headers,row);continue;}
    if(!/^\d{4}$/.test(row[0])||+row[0]>sourceSeason)continue;
    g.history.push({season:+row[0],team:teamName(row[1]),date:'',competition:'一軍例行賽',stat:readStat(headers,row)});
   }
   g.history.sort((a,b)=>b.season-a.season);
  }else if(tableId==='game_p'||tableId==='game_b'){
   const g=groups[tableId==='game_p'?'pitching':'hitting'];
   if(headers[0]!=='日付'||headers[1]!=='対戦チーム')throw Error('日職逐場成績欄位變更');
   for(const row of rows.slice(1)){
    const date=row[0]?.match(/^(\d{1,2})\/(\d{1,2})\s+(.+)$/);
    if(!date||row.length!==headers.length||+date[1]<1||+date[1]>12||+date[2]<1||+date[2]>31)continue;
    g.games.push({season:sourceSeason,date:`${sourceSeason}-${date[1].padStart(2,'0')}-${date[2].padStart(2,'0')}`,team:teamName(row[1]),competition:competition(date[3]),stat:readStat(headers,row)});
   }
   g.games.sort((a,b)=>b.date.localeCompare(a.date));
  }else if(summaryEnd>=0&&table.index!<summaryEnd&&(headers[0]==='防御率'||headers[0]==='打率')){
   const g=groups[headers[0]==='防御率'?'pitching':'hitting'];
   // First summary appears before condition/farm/exhibition sections.
   if(g.season!==null)continue;
   let stat:PlayerStat={};for(let i=0;i+1<rows.length;i+=2)if(rows[i].length===rows[i+1].length)stat={...stat,...readStat(rows[i],rows[i+1])};
   g.season=stat;
  }
 }
 return {player:{id,name,number:classText(html,'p','bb-profile__number'),position,team,teamCode,bio:bio.map(([k,v])=>[k,v||'尚未提供']),photoUrls,defaultGroup:position==='投手'?'pitching':'hitting'},sourceSeason,groups,source,updatedAt,fetchedAt};
}

export function npbSeasonStats(data:NpbPlayerData,group:PlayerGroup,season:number){
 if(season===data.sourceSeason)return data.groups[group].season;
 const rows=data.groups[group].history.filter(row=>row.season===season),total=rows.filter(row=>row.team==='合計');
 // Never sum traded-team ratios or fractional innings.
 return total.length===1?total[0].stat:rows.length===1?rows[0].stat:null;
}
export const NPB_GAME_COLUMNS:Record<PlayerGroup,[string,string][]>= {
 pitching:[['inningsPitched','局數'],['pitches','用球數'],['hits','被安打'],['strikeOuts','三振'],['baseOnBalls','保送'],['hitByPitch','觸身球'],['runsAllowed','失分'],['earnedRuns','自責分']],
 hitting:[['atBats','打數'],['hits','安打'],['homeRuns','全壘打'],['rbi','打點'],['runs','得分'],['strikeOuts','三振'],['baseOnBalls','保送'],['hitByPitch','觸身球']],
};
