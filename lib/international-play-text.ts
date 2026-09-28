import {internationalTeam} from './international-teams';
import {internationalInningRecords,type InternationalLiveGame} from './international-live-display';
export type TextCount={balls:number|null;strikes:number|null;outs:number|null};
export type TextPitch={id:string;number:number;description:string;originalText:string;speedKph:number|null;kind:string;count:TextCount};
export type TextPlay={id:string;inning:number;half:'top'|'bottom';sequence:number;batter:{id:string|null;name:string;order:number|null;photoUrls?:string[]}|null;event:string;tone:string;description:string;originalText:string[];language:string;actions:{id:string;event:string;description:string}[];pitches:TextPitch[];count:TextCount;bases:boolean[]|null;score:{away:number|null;home:number|null};scoring:boolean;isComplete:boolean;fetchedAt:string};
export type PlayTextSnapshot={version:string;gameKey:string;date:string;away:string;home:string;awayId?:string|number;homeId?:string|number;status:string;fetchedAt:string|null;sourceUrl:string;records:TextPlay[];missingInnings:number[];stale?:boolean;reason?:string};
export type TextGame=InternationalLiveGame&{playText?:PlayTextSnapshot};
export type TextInning={key:string;inning:number;half:'top'|'bottom';side:'away'|'home';plays:TextPlay[]};
/** Archived events may be old, but never belong to another game or a future capture. */
export function internationalTextEvents(game:TextGame,now=Date.now()):TextPlay[]{
 const t=game.playText;
 const sameTeam=(side:'away'|'home')=>{
  if(!t||internationalTeam(t[side],game.league)!==internationalTeam(game[side].name,game.league))return false;
  const id=side==='away'?t.awayId:t.homeId;
  return id==null||String(id)===String(game[side].id);
 };
 if(!['live','final','suspended'].includes(game.status)||!t||t.version!=='international-play-text-v1'||t.gameKey!==game.key||t.date!==game.date||!sameTeam('away')||!sameTeam('home')||!Array.isArray(t.records))return [];
 const unique=new Map<string,TextPlay>();
 for(const row of t.records){
  if(!row||typeof row.id!=='string'||!row.id.startsWith(game.key+':')||!Number.isInteger(row.inning)||row.inning<1||row.inning>50||!['top','bottom'].includes(row.half)||!Number.isFinite(row.sequence)||!Array.isArray(row.originalText)||!Array.isArray(row.actions)||!Array.isArray(row.pitches)||!Number.isFinite(Date.parse(row.fetchedAt))||Date.parse(row.fetchedAt)>now+60000)continue;
  if(!row.description&&!row.actions.length)continue;unique.set(row.id,row);
 }
 return [...unique.values()].sort((a,b)=>a.inning-b.inning||(a.half===b.half?0:a.half==='top'?-1:1)||a.sequence-b.sequence);
}
export function internationalTextInnings(game:TextGame,now=Date.now()):TextInning[]{
 const map=new Map<string,TextInning>();
 const add=(inning:number,half:'top'|'bottom')=>{const key=`${game.key}:${inning}:${half}`;if(!map.has(key))map.set(key,{key,inning,half,side:half==='top'?'away':'home',plays:[]});return map.get(key)!;};
 // Linescores define which half-inning headings exist, never the events inside them.
 for(const row of internationalInningRecords(game))add(row.inning,row.half);
 for(const play of internationalTextEvents(game,now))add(play.inning,play.half).plays.push(play);
 if(game.status==='live'&&game.inning&&['top','bottom'].includes(game.half||''))add(game.inning,game.half as 'top'|'bottom');
 return [...map.values()].sort((a,b)=>a.inning-b.inning||(a.half===b.half?0:a.half==='top'?-1:1));
}
export function selectTextInnings(groups:TextInning[],filter:string){const last=groups.at(-1)?.inning;return groups.filter(g=>filter==='all'||g.inning===(filter==='latest'?last:Number(filter)));}
export function currentTextPlay(game:TextGame,stale:boolean){
 if(stale||game.status!=='live'||!game.currentBatter)return null;
 const live=game.currentAtBat;if(live&&live.inning===game.inning&&live.half===game.half&&String(game.currentBatter.id)===live.batterId&&Number.isFinite(Date.parse(live.fetchedAt))&&Math.abs(Date.now()-Date.parse(live.fetchedAt))<=120000)return {pitches:live.pitches};
 if(game.playText?.stale)return null;
 const play=internationalTextEvents(game).at(-1);if(!play||play.isComplete||play.inning!==game.inning||play.half!==game.half||!play.batter)return null;
 const a=game.currentBatter,b=play.batter;return (a.id!=null&&b.id!=null?String(a.id)===String(b.id):!!a.name&&a.name===b.name)?play:null;
}
