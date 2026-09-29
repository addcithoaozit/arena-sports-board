import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {moduleUrl} from './profile-loader.mjs';
const n=await import(moduleUrl('lib/nba.ts')),m=await import(moduleUrl('lib/nba-analysis.ts'));
const fixture=name=>JSON.parse(readFileSync(`tests/fixtures/nba/${name}.json`,'utf8'));
function component(file,dependencies){
 const code=ts.transpileModule(readFileSync(file,'utf8'),{fileName:file,compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 return new Function('require','exports','React',code+'\nreturn exports;')(key=>{if(key in dependencies)return dependencies[key];throw Error('Unmapped dependency '+key);},{},React);
}
const match=component('app/nba-match.tsx',{'@/lib/nba':n,'@/lib/nba-analysis':m});
const parsed=ts.createSourceFile('nba-board.tsx',readFileSync('app/nba-board.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const node=parsed.statements.find(x=>ts.isFunctionDeclaration(x)&&x.name?.text==='NbaCard');
const code=ts.transpileModule(node.getText(parsed),{fileName:'card.tsx',compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText;
const scope={React,...n,...m,...match},Card=new Function(...Object.keys(scope),code+'\nreturn NbaCard;')(...Object.values(scope));
const Pane=component('app/nba-recommendations.tsx',{'react':{useId:()=>':nba:'},'react-dom':{createPortal:child=>child},'@/lib/nba':n,'@/lib/nba-analysis':m,'./nba-match':match,'./super-workspace':{useSuperWorkspace:()=>({activePane:':nba:',host:{}})}}).default;
const w=await import(moduleUrl('lib/wnba.ts')),wa=await import(moduleUrl('lib/wnba-analysis.ts'));
const read=name=>JSON.parse(readFileSync(`tests/fixtures/wnba/${name}.json`,'utf8'));
const now=Date.parse('2026-09-29T16:00:00Z'),game=w.parseWnbaEvents(read('day-20260930')).find(g=>g.id==='401918019'),history=['16','20'].flatMap(t=>[2,3].flatMap(p=>w.parseWnbaEvents(read(`team-${t}-2026-${p}`),t)));
const report={game,analysis:wa.analyzeWnba(game,history,now),sourceFetchedAt:new Date(now).toISOString()},render=(C,props)=>renderToStaticMarkup(React.createElement(C,props));
test('WNBA shared NBA card and floating pane show identical picks and WNBA team destinations',()=>{
 const oldNow=Date.now;Date.now=()=>now;try{
 const card=render(Card,{game,report,now,unavailable:false,showAnalysis:true}),pane=render(Pane,{league:'WNBA',games:[game],reports:{[game.id]:report},day:'2026-10-01',now,fetchedAt:new Date(now).toISOString(),unavailable:false,loading:false}),pick=m.nbaPick(game,report.analysis);
 for(const html of [card,pane]){assert.ok(html.includes(pick.label));assert.ok(html.includes(match.nbaPercent(pick.probability)));assert.ok(html.includes('/teams/wnba/16?date=2026-10-01'));assert.ok(html.includes('/teams/wnba/20?date=2026-10-01'));assert.ok(!html.includes('/teams/nba/'));}
 assert.ok(pane.includes('WNBA 推薦內容'));
 }finally{Date.now=oldNow;}
});
test('all WNBA directory identities retain WNBA logos and profile links in the shared renderer',()=>{for(const team of w.WNBA_TEAMS){const html=render(match.NbaTeamIdentity,{team});assert.ok(html.includes(`/teams/wnba/${team.id}`));assert.ok(html.includes(team.logo));}});
test('document-model weights and probabilities stay identical on the WNBA card and floating pane',async()=>{
 const e=await import(moduleUrl('lib/basketball-efficiency.ts')),raw=JSON.parse(readFileSync('tests/fixtures/basketball-efficiency/wnba-boxes.json','utf8')),games=[...new Map(['16','20'].flatMap(id=>e.efficiencyHistory(game,history,id,'WNBA',now)).map(g=>[g.id,g])).values()],boxes=games.map(g=>e.parseEfficiencyBox(raw[g.id],g,'WNBA')),analysis=e.analyzeEfficiency(game,history,boxes,'WNBA',undefined,now),current={game,analysis,sourceFetchedAt:new Date(now).toISOString()},oldNow=Date.now;Date.now=()=>now;
 try{for(const expectedWeights of [e.weightKey([20,20,20,20,20]),e.weightKey([0,0,0,0,100])]){const card=render(Card,{game,report:current,now,unavailable:false,showAnalysis:true,expectedWeights}),pane=render(Pane,{league:'WNBA',games:[game],reports:{[game.id]:current},day:'2026-10-01',now,fetchedAt:new Date(now).toISOString(),unavailable:false,loading:false,expectedWeights});if(expectedWeights===analysis.weightsKey){for(const html of [card,pane]){assert.ok(html.includes('效率模擬'));assert.ok(html.includes('51.6%'));assert.ok(html.includes('亞特蘭大夢想 勝'));}}else{assert.ok(!card.includes('data-nba-recommendation'));assert.ok(!pane.includes('data-nba-recommendation'));}}}finally{Date.now=oldNow;}
});
