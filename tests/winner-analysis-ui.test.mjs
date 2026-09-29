import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {moduleUrl} from './profile-loader.mjs';
const {winnerAnalysis}=await import(moduleUrl('lib/winner-analysis.ts'));
const {isPregame,canShowPregameMarkets}=await import(moduleUrl('lib/baseball.ts'));
// Execute the actual nested JSX renderer with a small virtual element runtime.
// This checks UI conditions without claiming a logged-in production browser test.
const source=ts.createSourceFile('pregame.tsx',readFileSync('app/pregame.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const component=source.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='Pregame');
const renderer=component.body.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='winnerOptions');
assert.ok(renderer,'the moneyline renderer must exist');
const compiled=ts.transpileModule(renderer.getText(source),{fileName:'options.tsx',compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText;
const now=Date.parse('2026-09-22T18:31:00Z');
const game={id:1,date:'2026-09-22T22:40:00Z',season:2026,gameType:'R',state:'Preview',status:'Scheduled',startTimeTBD:false,
 away:{id:2,name:'Away',wins:70,losses:70,pitcherId:12,pitcherEra:4,pitcherWhip:1.2},
 home:{id:1,name:'Home',wins:70,losses:70,pitcherId:11,pitcherEra:3,pitcherWhip:1.2}};
const quote={first:.604,second:1.458,signature:'test-quote'};
const React={Fragment:'fragment',createElement:(type,props,...children)=>({type,props:props??{},children})};
function render(report,{marketReason='',legs=[],g=game,scheduleOK=true}={}){
 const scope={React,model:match=>winnerAnalysis(match,report,now,scheduleOK),unavailable:()=>marketReason,moneylineOK:!marketReason,isPregame,canShowPregameMarkets,now,moneyline:()=>quote,legs,choose:()=>{},
  Button:'button',TeamName:'team',MarketOutcomes:'outcomes',binaryOutcome:p=>({win:p,loss:1-p,partialWin:0,partialLoss:0,push:0})};
 return new Function(...Object.keys(scope),compiled+'\nreturn winnerOptions;')(...Object.values(scope))(g);
}
function nodes(tree){return Array.isArray(tree)?tree.flatMap(nodes):tree&&typeof tree==='object'?[tree,...tree.children.flatMap(nodes)]:[];}
function text(tree){return Array.isArray(tree)?tree.map(text).join(''):tree&&typeof tree==='object'?tree.children.map(text).join(''):typeof tree==='string'||typeof tree==='number'?String(tree):'';}
const badges=tree=>nodes(tree).filter(node=>node.props['data-winner-recommendation']);
function report(){const features={};for(const side of ['home','away'])Object.assign(features,{[side+'_starter_recent_era']:4,[side+'_lineup_wrc_plus']:100,[side+'_bullpen_last3_pitches']:100,[side+'_bullpen_back_to_back']:2});return {game:structuredClone(game),capturedAt:new Date(now).toISOString(),features,issues:[],context:{sides:{home:{lineupStatus:'confirmed'},away:{lineupStatus:'confirmed'}}}};}
test('preliminary cards show one green recommendation label, retain their analysis stage and remain manually selectable',()=>{
 const tree=render(undefined),all=nodes(tree);assert.equal(tree.props['data-analysis-status'],'preliminary');
 assert.equal(all.filter(n=>n.type==='outcomes').length,2);assert.equal(badges(tree).length,1);assert.equal(text(badges(tree)[0]),'推薦');assert.match(badges(tree)[0].props.className,/text-green-400/);
 assert.ok(!text(tree).includes('初步分析：'));assert.ok(!text(tree).includes('初步傾向'));assert.equal(badges(tree)[0].props['data-winner-recommendation'],'preliminary');assert.match(badges(tree)[0].props.title,/分項未齊/);
 const buttons=all.filter(n=>n.type==='button');assert.equal(buttons.length,2);assert.ok(buttons.every(n=>n.props.disabled===false));
 assert.ok(text(tree).includes('@1.458'));assert.ok(text(tree).includes('@0.604'));
});
test('playoff moneyline cards display estimates and a recommendation using the same renderer',()=>{
 for(const gameType of ['F','D','L','W']){
  const tree=render(undefined,{g:{...game,gameType}});
  assert.equal(tree.props['data-analysis-status'],'preliminary');
  assert.equal(nodes(tree).filter(n=>n.type==='outcomes').length,2);
  assert.equal(badges(tree).length,1);
  assert.ok(nodes(tree).filter(n=>n.type==='button').every(n=>!n.props.disabled));
 }
});
test('full current inputs use the same visible recommendation label without changing the ready state',()=>{
 const tree=render(report());assert.equal(tree.props['data-analysis-status'],'ready');assert.equal(badges(tree).length,1);assert.equal(text(badges(tree)[0]),'推薦');assert.match(badges(tree)[0].props.className,/text-green-400/);assert.equal(nodes(tree).filter(n=>n.type==='outcomes').length,2);
});
test('unconfirmed lineup and missing coverage retain preliminary status when usable estimates recommend',()=>{
 const r=report();r.context.sides.home.lineupStatus='expected';r.features.home_starter_recent_era=null;
 const tree=render(r);assert.equal(nodes(tree).filter(n=>n.type==='outcomes').length,2);assert.equal(tree.props['data-analysis-status'],'preliminary');assert.ok(!text(tree).includes('初步分析：'));assert.equal(winnerAnalysis(game,r,now,true).ready,false);assert.equal(winnerAnalysis(game,r,now,true).canRecommend,true);
});
test('an expired quote has no selectable cards, outcomes or recommendation badge',()=>{
 const tree=render(report(),{marketReason:'獨贏資料尚未取得或已過期'});assert.equal(nodes(tree).filter(n=>n.type==='outcomes').length,0);assert.ok(nodes(tree).filter(n=>n.type==='button').every(n=>n.props.disabled));assert.equal(badges(tree).length,0);
});
test('a conflict or expired report cannot leave a misleading win probability or badge on the card',()=>{
 for(const change of [r=>r.issues=['傷兵衝突'],r=>r.capturedAt=new Date(now-300001).toISOString()]){
  const r=report();change(r);const tree=render(r);assert.equal(tree.props['data-analysis-status'],'blocked');assert.equal(nodes(tree).filter(n=>n.type==='outcomes').length,0);assert.equal(badges(tree).length,0);assert.ok(text(tree).includes('不參與自動推薦或串關機率試算'));
 }
});
test('manual selection retains its check mark only for the same quote signature and uses dark green on yellow',()=>{
 const current=render(undefined,{legs:[{gameId:1,side:'home',quote:quote.signature}]});assert.equal(nodes(current).filter(n=>n.type==='button'&&n.props['aria-pressed']).length,1);assert.match(badges(current)[0].props.className,/text-green-700/);assert.equal(text(badges(current)[0]),'推薦');assert.equal(nodes(current).filter(n=>n.props['aria-label']==='已選取').length,1);
 const old=render(undefined,{legs:[{gameId:1,side:'home',quote:'old-quote'}]});assert.equal(nodes(old).filter(n=>n.type==='button'&&n.props['aria-pressed']).length,0);assert.match(badges(old)[0].props.className,/text-green-400/);
});
test('the requested explanatory block is removed from both preliminary and ready cards without empty details or paragraphs',()=>{
 for(const tree of [render(undefined),render(report())]){
  for(const phrase of ['初步分析：','分析依據與缺少項目','模型試算尚未回測校準，不代表實際命中率','可手動選取，未達自動推薦條件','傾向方向不等於賠率價值判斷'])assert.ok(!text(tree).includes(phrase),phrase);
  assert.equal(nodes(tree).filter(n=>['details','summary','p'].includes(n.type)).length,0);
 }
});
test('equal model estimates never acquire a recommendation badge',()=>{
 const g=structuredClone(game);g.home.pitcherEra=g.away.pitcherEra;const tree=render(undefined,{g});assert.equal(badges(tree).length,0);assert.equal(nodes(tree).filter(n=>n.type==='outcomes').length,2);
});
test('the recommendation stays beside the actual favored team rather than a selected opposing side',()=>{
 const g=structuredClone(game);g.away.pitcherEra=2;
 const tree=render(undefined,{g,legs:[{gameId:1,side:'home',quote:quote.signature}]});const buttons=nodes(tree).filter(n=>n.type==='button');
 assert.equal(badges(buttons[0]).length,1);assert.equal(badges(buttons[1]).length,0);assert.equal(buttons[1].props['aria-pressed'],true);
});
