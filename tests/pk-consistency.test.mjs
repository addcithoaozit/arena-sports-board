import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {moduleUrl} from './profile-loader.mjs';
const board=await import(moduleUrl('lib/board-markets.ts'));
const {scoreGrid,settle}=await import(moduleUrl('lib/markets.ts'));
const {winnerAnalysis}=await import(moduleUrl('lib/winner-analysis.ts'));
const {assembleAnalysis}=await import(moduleUrl('lib/pregame-analysis.ts'));
const {formatSpreadLine,formatPickLine}=await import(moduleUrl('lib/market-display.ts'));
const {matchOdds}=await import(moduleUrl('lib/pinnacle.ts'));
const now=Date.parse('2026-09-27T13:07:42Z'),stamp=new Date(now).toISOString();
// Public values transcribed from the screenshot. No account or quote credentials.
const game={id:910001,date:'2026-09-27T17:05:00Z',season:2026,gameType:'R',state:'Preview',status:'Scheduled',startTimeTBD:false,
 away:{id:121,name:'New York Mets',wins:74,losses:87,pitcherId:910101,pitcherEra:4.67,pitcherWhip:1.30},
 home:{id:120,name:'Washington Nationals',wins:76,losses:85,pitcherId:910102,pitcherEra:9,pitcherWhip:1.75}};
const quote={line:0,first:.95,second:.95,signature:'full-pk',display:'主平手 PK'};
const grid=scoreGrid(4.8,5.0),pk=side=>board.makeBoardPick(game.id,'spread',side,quote);
test('screenshot contradiction: full PK uses 68/32 winner probabilities instead of the opposing 52.6/47.4 score model',()=>{
 assert.ok(settle(grid,pk('home')).win>.52);
 for(const side of ['home','away']){const r=board.settleBoard(grid,pk(side),.32);assert.ok(Math.abs(r.win-(side==='home'?.32:.68))<1e-12);assert.equal(r.push,0);assert.equal(r.partialWin,0);assert.equal(r.partialLoss,0);assert.equal(r.win+r.loss,1);}
});
test('full PK has no score-model fallback when the winner probability is unavailable',()=>{
 for(const p of [null,NaN,Infinity,-.1,1.1])for(const side of ['home','away'])assert.equal(board.settleBoard(grid,pk(side),p),null);
 assert.equal(board.settleBoard(grid,pk('home')),null);
});
test('PK classification preserves period and real handicap settlement',()=>{
 const half=board.makeBoardPick(game.id,'firstHalfSpread','home',quote),halfGrid=scoreGrid(2.5,2.5,false);
 assert.equal(board.isFullGamePk(half),false);assert.deepEqual(board.settleBoard(halfGrid,half,.68),settle(halfGrid,half));assert.ok(board.settleBoard(halfGrid,half,.68).push>.1);
 for(const pick of [{...pk('home'),line:-1.5},{...pk('home'),parts:[-.5,.5]},{...pk('home'),market:'total',key:'total',side:'over',line:8.5}]){assert.equal(board.isFullGamePk(pick),false);assert.deepEqual(board.settleBoard(grid,pick,.32),settle(grid,pick));}
 assert.equal(board.isFullGamePk({...pk('home'),parts:[0,0]}),true);
});
// Execute the real nested UI functions so card badges, floating picks and auto
// parlays are checked through their shared result() path, not a duplicate model.
const source=ts.createSourceFile('markets.tsx',readFileSync('app/markets.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const component=source.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='Markets');
const names=['result','options','preferred','recommend','marketPanel','buildSingleRecommendations'];
const code=ts.transpileModule(component.body.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.includes(n.name?.text)).map(n=>n.getText(source)).join('\n'),{fileName:'pk-ui.tsx',compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText;
const React={Fragment:'fragment',createElement:(type,props,...children)=>({type,props:props??{},children})};
const nodes=t=>Array.isArray(t)?t.flatMap(nodes):t&&typeof t==='object'?[t,...(t.children||[]).flatMap(nodes)]:[];
function ui({g=game,report,scheduleOK=true,blocked='',q=quote}={}){
 let selected=[];
 const scope={...board,React,formatSpreadLine,formatPickLine,matchOdds,winnerAnalysis,now,scheduleOK,analysis:report?{[g.id]:{report}}:{},games:[g],fixtures:[g],orderedGames:[g],models:new Map([[g.id,{full:grid,half:scoreGrid(4.8*5/9,5*5/9,false)}]]),quote:(_g,key)=>key==='spread'?q:null,reason:()=>blocked,
  count:1,setPicks:p=>{selected=p;},setNotice:()=>{},picks:[],automatic:true,oddsOK:true,oddsError:'',odds:{games:[{...g,home:g.home.name,away:g.away.name,spread:q,total:null,start:g.date}],fetchedAt:stamp},Button:'button',TeamName:'team',MarketOutcomes:'outcomes',Input:'input',manualLines:()=>({spread:'0',total:'8.5'}),update:()=>{},add:()=>{},label:(_g,p)=>p.key+':'+p.side,pct:p=>(p*100).toFixed(1)+'%'};
 const api=new Function(...Object.keys(scope),code+'\nreturn {result,options,preferred,recommend,marketPanel,buildSingleRecommendations};')(...Object.values(scope));return {...api,selected:()=>selected};
}
test('real UI card, floating recommendation and automatic parlay all pick the higher displayed probability',()=>{
 const view=ui(),win=winnerAnalysis(game,undefined,now,true);assert.equal(win.favoredSide,'away');
 const home=view.result(pk('home')),away=view.result(pk('away'));assert.equal(home.win,win.homeWin);assert.equal(away.win,1-win.homeWin);
 const panel=view.marketPanel(game,'spread'),badges=nodes(panel).filter(n=>n.props['data-market-recommendation']);assert.equal(badges.length,1);assert.equal(badges[0].props['data-market-recommendation'],'spread:away');
 assert.deepEqual(nodes(panel).filter(n=>n.type==='outcomes').map(n=>n.props.outcome.win),[win.homeWin,1-win.homeWin]);
 view.recommend();assert.equal(view.selected()[0].side,'away');
 const cards=view.buildSingleRecommendations();assert.equal(cards.length,1);assert.equal(nodes(cards[0].node).find(n=>n.type==='outcomes').props.outcome.win,1-win.homeWin);
});
test('expired/conflicting reports, changed starters, invalid quotes and stale schedules cannot leave PK recommendations',()=>{
 const base={game:structuredClone(game),capturedAt:stamp,features:{},issues:[]};
 for(const opts of [{report:{...base,capturedAt:new Date(now-300001).toISOString()}},{report:{...base,issues:['先發資料衝突']}},{report:{...base,game:{...game,home:{...game.home,pitcherId:999}}}},{scheduleOK:false},{blocked:'資料過期'},{g:{...game,home:{...game.home,pitcherWhip:null}}}]){
  const view=ui(opts);assert.equal(view.result(pk('home')),null);assert.equal(view.result(pk('away')),null);assert.equal(nodes(view.marketPanel(opts.g||game,'spread')).filter(n=>n.props['data-market-recommendation']).length,0);view.recommend();assert.deepEqual(view.selected(),[]);assert.deepEqual(view.buildSingleRecommendations(),[]);
 }
 assert.equal(ui({q:{...quote,signature:'changed'}}).result(pk('home')),null);
});
test('equal winner probabilities keep 50/50 outcomes without a recommended team',()=>{
 const g={...game,home:{...game.home,wins:game.away.wins,losses:game.away.losses,pitcherEra:game.away.pitcherEra,pitcherWhip:game.away.pitcherWhip}},view=ui({g});
 assert.equal(view.result(pk('home')).win,.5);assert.equal(view.result(pk('away')).win,.5);assert.equal(view.preferred(view.options(g,'spread')),undefined);view.recommend();assert.deepEqual(view.selected(),[]);
});
test('saved server PK predictions use the same guarded winner model and version as the visible board',()=>{
 const snapshot=x=>({fetchedAt:stamp,source:'test',...x});
 const input={runs:snapshot({year:2026,league:4.5,rows:[{id:121,scored:740,allowed:790,batGames:161,pitchGames:161},{id:120,scored:800,allowed:760,batGames:161,pitchGames:161}]}),super007:snapshot({games:[{id:920001,home:'華盛頓國民(主)',away:'紐約大都會',start:'2026/09/28 01:05:00',live:false,markets:[{type:103,quotes:[{primary:true,homeLine:'PK',awayLine:'',homePrice:'.95',awayPrice:'.95'}]}]}]})};
 const r=assembleAnalysis(game,input,now),win=winnerAnalysis(game,r,now,true);assert.match(r.version,/pk-consistent/);assert.equal(r.baseline.markets.length,2);
 for(const q of r.baseline.markets){assert.equal(q.probability.win,q.pick.side==='home'?win.homeWin:1-win.homeWin);assert.equal(q.modelVersion,win.version);}
 const missing=assembleAnalysis({...game,home:{...game.home,pitcherWhip:null}},input,now);assert.equal(missing.baseline.markets.length,2);assert.ok(missing.baseline.markets.every(q=>q.probability===null));
});
