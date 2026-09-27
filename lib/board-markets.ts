import type {MarketKey,OddsGame,Quote} from './pinnacle';
import {settle,type MarketPick,type Outcome,type Settlement} from './markets';

export const BOARD_MARKETS=[
 {key:'spread',label:'全場讓球'},
 {key:'total',label:'全場大小'},
 {key:'moneyline',label:'全場獨贏'},
 {key:'runline',label:'全場一輸'},
 {key:'firstHalfSpread',label:'上半讓球'},
 {key:'firstHalfTotal',label:'上半大小'},
 {key:'firstHalfOddEven',label:'上半單雙'},
] as const;
export type BoardPick=MarketPick&{key:Exclude<MarketKey,'moneyline'>};
export const boardQuote=(game:OddsGame|null|undefined,key:MarketKey):Quote|null=>game?(key==='spread'||key==='total'?game[key]:game.additional?.[key])??null:null;
export const isHalfMarket=(key:MarketKey)=>key.startsWith('firstHalf');
export const isTotalMarket=(key:MarketKey)=>key==='total'||key==='firstHalfTotal'||key==='firstHalfOddEven';
export const boardMarketLabel=(key:MarketKey)=>BOARD_MARKETS.find(m=>m.key===key)!.label;
export const boardSides=(key:MarketKey):readonly BoardPick['side'][]=>isTotalMarket(key)?['over','under']:['home','away'];
export const sameBoardPick=(a:BoardPick,b:BoardPick)=>a.gameId===b.gameId&&a.key===b.key&&a.side===b.side&&a.line===b.line&&a.quote===b.quote;
export function makeBoardPick(gameId:number,key:BoardPick['key'],side:BoardPick['side'],q:Quote):BoardPick{
 return {gameId,key,market:isTotalMarket(key)?'total':'spread',side,line:q.line,boundary:q.boundary,parts:q.parts,display:q.display,quote:q.signature};
}
/** Full-game MLB has no drawn result. A genuine zero handicap is the same
 * winning event as moneyline, and must use the same guarded win model.
 * An average-zero split line and first-half PK are different settlements. */
export function isFullGamePk(pick:MarketPick&{key?:string}){
 return pick.market==='spread'&&(!pick.key||pick.key==='spread'||pick.key==='runline')&&pick.line===0&&
  ['home','away'].includes(pick.side)&&Number.isFinite(pick.boundary??0)&&Math.abs(pick.boundary??0)<=1&&
  (pick.parts===undefined||(pick.parts.length>0&&pick.parts.every(line=>line===0)));
}
export function settleBoard(grid:Outcome[],pick:BoardPick,fullGameHomeWin:number|null=null):Settlement|null{
 if(isFullGamePk(pick))return fullGameHomeWin===null?null:binaryOutcome(pick.side==='home'?fullGameHomeWin:1-fullGameHomeWin);
 if(pick.key!=='firstHalfOddEven')return settle(grid,pick);
 if(!grid.length||!['over','under'].includes(pick.side))return null;
 // SUPER's first/second total-price fields carry 單/雙 in the 105 market.
 const odd=grid.reduce((sum,o)=>sum+((o.home+o.away)%2===1?o.p:0),0);
 const win=pick.side==='over'?odd:1-odd;
 return {win,loss:1-win,push:0,partialWin:0,partialLoss:0,winWeight:win,lossWeight:1-win};
}
export function binaryOutcome(win:number):Settlement|null{
 return Number.isFinite(win)&&win>=0&&win<=1?{win,loss:1-win,push:0,partialWin:0,partialLoss:0,winWeight:win,lossWeight:1-win}:null;
}
