import {fetchPublic,plain,yahooObjects} from './baseball-live-providers.mjs';
export const PLAY_TEXT_VERSION='international-play-text-v1';
const integer=(x,max=1000)=>x!==null&&x!==undefined&&String(x).trim()!==''&&Number.isInteger(Number(x))&&Number(x)>=0&&Number(x)<=max?Number(x):null;
const clean=x=>plain(String(x??'')).slice(0,2400);
const rules=[
 [/投手交代|投手更換|투수.*교체/,'更換投手','neutral'],[/守備交代|守備変更|守備更換|수비.*교체/,'守備更換','neutral'],
 [/代打|대타/,'代打','neutral'],[/代走|대주자/,'代跑','neutral'],[/ビデオ|リクエスト|비디오 판독/,'重播輔助判決','neutral'],[/コーチ.*マウンド|教練暫停/,'教練暫停','neutral'],
 [/ホームラン|本塁打|全壘打|홈런/,'全壘打','hit'],[/スリーベース|三塁打|三壘安打|3루타/,'三壘安打','hit'],[/ツーベース|二塁打|二壘安打|2루타/,'二壘安打','hit'],
 [/併殺|ダブルプレー|雙殺|병살/,'雙殺','out'],[/犠飛|犠牲フライ|高飛犧牲打|희생플라이/,'高飛犧牲打','out'],[/犠打|送りバント|犧牲觸擊|희생번트/,'犧牲觸擊','out'],
 [/敬遠|故意四壞|고의.*4구/,'故意四壞保送','walk'],[/死球|觸身球|몸에 맞는 볼|몸에맞는볼/,'觸身球','walk'],[/フォアボール|四球|四壞|볼넷/,'四壞保送','walk'],
 [/エラー|失誤|실책/,'失誤','neutral'],[/三振|삼진/,'三振出局','out'],[/ヒット|タイムリー|安打|1루타|안타/,'安打','hit'],[/フライ|飛球出局|플라이 아웃/,'飛球出局','out'],[/ゴロ|滾地球|땅볼 아웃/,'滾地球出局','out'],
 [/盗塁|盜壘|도루/,'盜壘紀錄','neutral'],[/生還|ホームイン|得分|홈인|득점/,'得分','hit'],[/交代|교체/,'球員更換','neutral'],[/試合終了|比賽結束|경기종료/,'比賽結束','neutral']
];
export function playLabel(text){const hit=rules.find(([re])=>re.test(text));return hit?{event:hit[1],tone:hit[2]}:{event:'文字紀錄',tone:'neutral'};}
function summary(name,label,outs){return label.event==='文字紀錄'?'':`${name?name+'：':''}${label.event}${outs===null?'':`；${outs} 出局`}`;}
function emptyCount(){return {balls:null,strikes:null,outs:null};}
function stateFields(s){return {count:{balls:integer(s?.ball,4),strikes:integer(s?.strike,3),outs:integer(s?.out,3)},bases:s&&['base1','base2','base3'].every(k=>integer(s[k],999999)!==null)?[s.base1,s.base2,s.base3].map(v=>Number(v)>0):null,score:{away:integer(s?.awayScore),home:integer(s?.homeScore)}};}
const snapshot=(g,p,records,extra={})=>({version:PLAY_TEXT_VERSION,gameKey:g.key,date:g.date,away:g.away.name,home:g.home.name,awayId:g.away.id,homeId:g.home.id,status:records.length?'available':'unavailable',fetchedAt:p?.fetchedAt??null,sourceUrl:p?.url??g.source.url,records,missingInnings:[],...extra});
const sortRecords=rows=>rows.sort((a,b)=>a.inning-b.inning||(a.half===b.half?0:a.half==='top'?-1:1)||a.sequence-b.sequence);
/** Only source-owned relay events are used. Inning totals never become at-bats. */
export function parseKboPlayText(relay,g,p,requestedInning){
 if(!relay||String(relay.gameId)!==String(g.id)||!String(g.id).startsWith(g.date.replaceAll('-','')))throw new Error('KBO text fixture mismatch');
 if(!Array.isArray(relay.textRelays))throw new Error('KBO text schema missing');
 const groups=new Map();
 for(const group of relay.textRelays){const inn=integer(group.inn,50),half=String(group.homeOrAway)==='0'?'top':String(group.homeOrAway)==='1'?'bottom':null,no=integer(group.no,10000);if(!inn||!half||no===null||requestedInning&&inn!==requestedInning)continue;groups.set(`${inn}:${half}:${no}`,group);}
 const records=[];
 for(const [key,group] of groups){
  const options=(group.textOptions||[]).filter(row=>row&&clean(row.text)&&!/^[-=\s]+$/.test(clean(row.text))&&Number(row.type)!==99);
  if(!options.length)continue;
  // seqno may be reused for a substitution and a batter. Preserve source order.
  const headers=options.filter(row=>Number(row.type)===8),header=headers.at(-1),outcomes=options.filter(row=>[13,23].includes(Number(row.type)));
  const outcome=outcomes.at(-1),state=options.at(-1)?.currentGameState,fields=stateFields(state);
  const title=clean(header?.text||group.title),name=clean(header?.batterRecord?.name||title.match(/(?:\d+번타자|대타)\s+(.+)$/)?.[1]);
  const batter=header?{id:header.batterRecord?.pcode?String(header.batterRecord.pcode):header.currentGameState?.batter?String(header.currentGameState.batter):null,name,order:integer(header.batterRecord?.batOrder??title.match(/(\d+)번타자/)?.[1],9)}:null;
  const originalText=options.filter(row=>Number(row.type)!==1&&Number(row.type)!==8).map(row=>clean(row.text));
  const label=playLabel(clean(outcome?.text||originalText.join(' '))),before=stateFields(options[0]?.currentGameState).score;
  const scoring=(fields.score.away!==null&&before.away!==null&&fields.score.away>before.away)||(fields.score.home!==null&&before.home!==null&&fields.score.home>before.home)||originalText.some(t=>/홈인|홈런/.test(t));
  const actions=options.filter(row=>![1,8,13,23,14].includes(Number(row.type))).map((row,i)=>({id:`${key}:a:${i}`,event:playLabel(clean(row.text)).event,description:clean(row.text)}));
  const pitchMap=new Map();for(const row of options.filter(row=>Number(row.type)===1)){
   const num=integer(row.pitchNum,200);if(!num)continue;const id=`${row.seqno}:${num}:${row.pitchResult}:${row.text}`;if(pitchMap.has(id))continue;
   const names={B:'壞球',T:'好球',S:'揮棒落空',F:'界外球',H:'擊球'};
   pitchMap.set(id,{id:`${key}:p:${id}`,number:num,description:names[row.pitchResult]||clean(row.text),originalText:clean(row.text),speedKph:integer(row.speed,200),kind:clean(row.stuff),...stateFields(row.currentGameState)});
  }
  records.push({id:`${g.key}:naver:${key}`,inning:Number(group.inn),half:String(group.homeOrAway)==='0'?'top':'bottom',sequence:Number(group.no),batter,event:label.event,tone:label.tone,description:summary(batter?.name,label,fields.count.outs)||originalText.join('；')||title,originalText,language:'ko',actions,pitches:[...pitchMap.values()],scoring,isComplete:!!outcome||!header,fetchedAt:p.fetchedAt,...fields});
 }
 return snapshot(g,p,sortRecords(records));
}
const blocks=(html,tag,cls)=>[...html.matchAll(new RegExp(`<${tag}\\b[^>]*class=["'][^"']*\\b${cls}\\b[^"']*["'][^>]*>([\\s\\S]*?)<\\/${tag}>`,'gi'))];
/** Sportsnavi's text page is grouped by half inning, including walk-off innings. */
export function parseNpbPlayText(html,g,p){
 const url=new URL(p.url);if(url.hostname!=='baseball.yahoo.co.jp'||url.pathname!==`/npb/game/${g.id}/text`)throw new Error('NPB text URL mismatch');
 const title=clean(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]),date=title.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
 if(!date||`${date[1]}-${date[2].padStart(2,'0')}-${date[3].padStart(2,'0')}`!==g.date)throw new Error('NPB text date mismatch');
 const records=[],seen=new Set();
 for(const section of blocks(html,'section','bb-liveText')){
  const content=section[1],h=clean(blocks(content,'h1','bb-liveText__inning')[0]?.[1]).match(/^(\d+)回(表|裏)$/);if(!h||Number(h[1])>50)continue;
  const inning=Number(h[1]),half=h[2]==='表'?'top':'bottom',side=half==='top'?'away':'home',team=content.match(/bb-liveText__head--npbTeam(\d+)/)?.[1];
  if(!team||String(g[side].id)!==team)throw new Error('NPB text batting team mismatch');
  let index=0;
  for(const item of blocks(content,'li','bb-liveText__item')){
   index++;const body=item[1],sourceNumber=integer(clean(blocks(body,'p','bb-liveText__number')[0]?.[1]).replace(/[：:]$/,''),1000),sequence=sourceNumber||index,b=blocks(body,'p','bb-liveText__batter')[0]?.[1]||'',player=b.match(/<a\b[^>]*href=["']\/npb\/player\/(\d+)\/top["'][^>]*>([\s\S]*?)<\/a>/i),order=clean(blocks(b,'span','bb-liveText__order')[0]?.[1]).match(/(\d+)番/);
   const batter=player?{id:player[1],name:clean(player[2]),order:order?Number(order[1]):null}:null;
   const paragraphs=blocks(body,'p','bb-liveText__summary'),actions=paragraphs.filter(m=>/bb-liveText__summary--change/.test(m[0])).map((m,i)=>({id:`${inning}:${half}:${sequence}:a:${i}`,event:playLabel(clean(m[1])).event,description:clean(m[1]).replace(/投手交代/g,'換投').replace(/守備交代/g,'守備更換').replace(/守備変更/g,'守備調整')}));
   const originalText=paragraphs.filter(m=>!/bb-liveText__summary--change/.test(m[0])).map(m=>clean(m[1])).filter(Boolean);if(!originalText.length&&!actions.length)continue;
   const resultText=originalText.join('；'),label=playLabel(resultText),outs=[...resultText.matchAll(/([123])アウト/g)].at(-1),id=`${g.key}:sportsnavi:${inning}:${half}:${sequence}`;if(seen.has(id))continue;seen.add(id);
   records.push({id,inning,half,sequence,batter,event:label.event,tone:label.tone,description:summary(batter?.name,label,outs?Number(outs[1]):null)||resultText,originalText,language:'ja',actions,pitches:[],count:{...emptyCount(),outs:outs?Number(outs[1]):null},bases:null,score:{away:null,home:null},scoring:paragraphs.some(m=>/bb-liveText__summary--point/.test(m[0])),isComplete:true,fetchedAt:p.fetchedAt});
  }
 }
 return snapshot(g,p,sortRecords(records));
}
const cache=new Map();
async function parallel(items,fn,limit=3){let cursor=0;const out=[];await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(cursor<items.length){const i=cursor++;out[i]=await fn(items[i]);}}));return out;}
function identity(g){return `${g.key}:${g.date}:${g.away.id}:${g.home.id}`;}
async function cachedText(key,ttl,load,store,now){const old=store.get(key);if(old&&now-old.savedAt<ttl)return old.data;const data=await load();store.set(key,{savedAt:now,data});while(store.size>160)store.delete(store.keys().next().value);return data;}
export async function enrichGamePlayText(g,{fetcher=fetch,store=cache,now=Date.now(),npbTextPages}={}){
 if(!['live','final','suspended'].includes(g.status))return g;
 const fail=reason=>snapshot(g,null,[],{reason,checkedAt:new Date(now).toISOString()});
 try{
  const baseKey=identity(g)+':'+g.status;let text;
  if(g.league==='NPB')text=await cachedText(baseKey,g.status==='final'?900000:45000,async()=>{const prefetched=npbTextPages?.get(String(g.id));if(prefetched===null)throw new Error('NPB text unavailable');const p=prefetched||await fetchPublic(`https://baseball.yahoo.co.jp/npb/game/${g.id}/text`,fetcher);return parseNpbPlayText(p.text,g,p);},store,now);
  else if(g.league==='KBO'){
   const max=Math.min(30,Math.max(g.inning||0,...['away','home'].flatMap(s=>(g.innings[s]||[]).filter(r=>r.runs!==null).map(r=>r.inning))));
   if(!max||!Number.isFinite(max))return {...g,playText:fail('尚未取得已進行局數，暫無文字紀錄')};
   const pages=await parallel(Array.from({length:max},(_,i)=>i+1),async n=>{
    try{return await cachedText(baseKey+':'+n,g.status==='final'||n<max-1?900000:45000,async()=>{const p=await fetchPublic(`https://api-gw.sports.naver.com/schedule/games/${g.id}/relay?inning=${n}`,fetcher),json=JSON.parse(p.text),relay=json.result?.textRelayData;if(json.code!==200&&json.code!=='200'&&json.code!==undefined)throw new Error('Naver relay request failed');return parseKboPlayText(relay,g,p,n);},store,now);}catch{return {missing:n};}
   });
   const records=sortRecords(pages.flatMap(x=>x.records||[])),missingInnings=pages.flatMap((x,i)=>x.missing||!x.records?.length?[i+1]:[]),dates=pages.map(x=>x.fetchedAt).filter(Boolean).sort();
   text=snapshot(g,{url:`https://m.sports.naver.com/game/${g.id}/relay`,fetchedAt:dates[0]??null},records,{missingInnings,status:records.length?missingInnings.length?'partial':'available':'unavailable',reason:missingInnings.length?'部分局數尚未取得文字紀錄':''});
  }else if(g.league==='CPBL'){
   text=await cachedText(baseKey,300000,async()=>{const p=await fetchPublic(g.source.url,fetcher),raw=yahooObjects(p.text).find(x=>x.gameId==='cpbl.g.'+g.id&&x.playerStats);if(!raw||raw.homeTeamId!==g.home.id||raw.awayTeamId!==g.away.id)throw new Error('CPBL text fixture mismatch');return snapshot(g,p,[],{reason:Array.isArray(raw.playByPlay)&&raw.playByPlay.length?'來源文字格式尚待核對':'來源未提供本場逐事件文字紀錄'});},store,now);
  }else return g;
  return {...g,playText:text};
 }catch{return {...g,playText:fail('文字紀錄暫時無法取得，比分資料照常更新')};}
}
export async function enrichLeaguePlayText(result,options){result.games=await parallel(result.games,g=>enrichGamePlayText(g,options),2);return result;}
/** Retain only unavailable innings from the same fixture, with original text times. */
export function retainGamePlayText(fresh,old){
 if(!old||identity(fresh)!==identity(old)||!['live','final','suspended'].includes(fresh.status)||old.playText?.version!==PLAY_TEXT_VERSION||!old.playText.records?.length)return fresh;
 const text=fresh.playText;if(text?.version===PLAY_TEXT_VERSION&&text.status==='available')return fresh;
 if(text?.records?.length){const keep=old.playText.records.filter(r=>text.missingInnings?.includes(r.inning));if(!keep.length)return fresh;return {...fresh,playText:{...text,records:sortRecords([...keep,...text.records]),fetchedAt:[old.playText.fetchedAt,text.fetchedAt].filter(Boolean).sort()[0],stale:true}};}
 return {...fresh,playText:{...old.playText,status:'partial',stale:true,reason:text?.reason||'文字來源待更新，保留已取得紀錄'}};
}
