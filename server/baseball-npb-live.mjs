import {plain} from './baseball-live-providers.mjs';
// The score page contains nested divs; stop at the matching closing tag.
export function npbElement(html,id){
 const match=new RegExp(`<div\\b[^>]*\\bid=["']${id}["'][^>]*>`,'i').exec(html);if(!match)return '';
 const tags=/<\/?div\b[^>]*>/gi;tags.lastIndex=match.index;let depth=0;
 for(let tag;tag=tags.exec(html);){depth+=/^<\/div/i.test(tag[0])?-1:1;if(!depth)return html.slice(match.index,tags.lastIndex);}
 return '';
}
function person(html,team){
 if(!new RegExp(`\\bteam${team}\\b`).test(html))throw Error('NPB live player team conflict');
 const cell=html.match(/<td\b[^>]*class=["']nm["'][^>]*>([\s\S]*?)<\/td>/i)?.[1];
 const p=cell?.match(/href=["']\/npb\/player\/(\d+)\/top["'][^>]*>([\s\S]*?)<\/a>/i);
 return p?{id:p[1],name:plain(p[2])}:null;
}
const pitchNames={'ボール':'壞球','見逃し':'好球（未揮棒）','空振り':'揮棒落空','ファウル':'界外球'};
/** Read only this fixture's current score page; historical query pages are rejected. */
export function addNpbLive(game,page){
 const expected=`https://baseball.yahoo.co.jp/npb/game/${game.id}/score`;
 const canonical=page.text.match(/property=["']og:url["']\s+content=["']([^"']+)["']/)?.[1];
 if(page.url!==expected||canonical!==expected)throw Error('NPB live game identity conflict');
 const date=plain(page.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'').match(/^(\d{4})年(\d+)月(\d+)日/);
 if(!date||`${date[1]}-${date[2].padStart(2,'0')}-${date[3].padStart(2,'0')}`!==game.date)throw Error('NPB live date conflict');
 if(game.status!=='live')return game;
 const board=npbElement(page.text,'sbo'),inning=board.match(/<em>\s*(\d+)回(表|裏)\s*<\/em>/),half=inning?.[2]==='表'?'top':'bottom';
 if(!inning||Number(inning[1])!==game.inning||half!==game.half)throw Error('NPB live inning conflict');
 const side=half==='top'?'away':'home',defense=side==='away'?'home':'away';
 const batterHtml=npbElement(page.text,'batter'),pitcherHtml=npbElement(page.text,'pit');
 const batter=person(batterHtml,game[side].id),pitcher=person(pitcherHtml,game[defense].id);
 const counts={};
 for(const [field,key,max] of [['balls','b',4],['strikes','s',3],['outs','o',3]]){
  const value=board.match(new RegExp(`<p\\b[^>]*class=["']${key}["'][^>]*>[\\s\\S]*?<b>([\\s\\S]*?)<\\/b>`))?.[1];
  const dots=value===undefined?null:plain(value);counts[field]=dots!==null&&/^●*$/.test(dots)&&dots.length<=max?dots.length:null;
 }
 // Bits are first/second/third, confirmed against the page's base1/base2/base3 runner elements.
 const base=npbElement(page.text,'base'),bits=base.match(/class=["']b([01]{3})["']/)?.[1];
 const bases=bits?[...bits].map(x=>x==='1'):null;
 if(bases&&bases.some((occupied,i)=>occupied!==new RegExp(`id=["']base${i+1}["']`).test(base)))throw Error('NPB live base conflict');
 const result=plain(npbElement(page.text,'result').match(/<span[^>]*>([\s\S]*?)<\/span>/)?.[1]||'');
 // Outcome cards retain the previous batter until the next pitch. Only a pitch
 // result or an explicit pre-pitch state establishes an active at-bat.
 const active=counts.outs!==3&&counts.balls!==4&&counts.strikes!==3&&(/^(ボール|見逃し|空振り|ファウル)$/.test(result)||/^(投球前|打席開始)$/.test(result));
 const pitches=[...npbElement(page.text,'nxt_batt').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].flatMap(row=>{
  const number=Number(row[1].match(/class=["'][^"']*bb-icon__number[^"']*["'][^>]*>\s*(\d+)/)?.[1]);
  const originalText=plain(row[1].match(/<td[^>]*>([\s\S]*?)<\/td>/)?.[1]||'');
  return number>0&&number<=200&&originalText?[{id:`${game.key}:${game.inning}:${half}:${batter?.id}:p:${number}`,number,description:pitchNames[originalText]||originalText,originalText,speedKph:null,kind:'',count:{balls:null,strikes:null,outs:null}}]:[];
 }).sort((a,b)=>a.number-b.number);
 const pitchCount=pitcherHtml.match(/<th>投球数<\/th>[\s\S]*?<tr class="score">\s*<td>(\d+)<\/td>/)?.[1];
 Object.assign(game,counts,{bases,currentBatter:active?batter:null,currentPitcher:pitcher?{...pitcher,pitchCount:pitchCount?Number(pitchCount):null}:null,currentAtBat:active&&batter?{batterId:batter.id,inning:game.inning,half,fetchedAt:page.fetchedAt,pitches}:null});
 if(bases&&Object.values(counts).every(v=>v!==null))game.warnings=game.warnings.filter(x=>x!=='bso_and_bases_not_verified');
 return game;
}
