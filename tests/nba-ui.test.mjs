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
const now=Date.parse('2026-09-29T16:00:00Z'),game=n.parseNbaEvents(fixture('future'))[0],history=['2','5'].flatMap(t=>[2,3].flatMap(p=>n.parseNbaEvents(fixture(`team-${t}-2026-${p}`),t)));
const report={game,analysis:m.analyzeNba(game,history,now),sourceFetchedAt:new Date(now).toISOString()},render=(C,props)=>renderToStaticMarkup(React.createElement(C,props));
test('card and floating pane render the same favored team, estimate and team links',()=>{
 const oldNow=Date.now;Date.now=()=>now;
 try{
  const card=render(Card,{game,report,now,unavailable:false,showAnalysis:true}),pane=render(Pane,{games:[game],reports:{[game.id]:report},day:'2026-10-09',now,fetchedAt:new Date(now).toISOString(),unavailable:false,loading:false});
  const pick=m.nbaPick(game,report.analysis);
  for(const html of [card,pane]){assert.ok(html.includes(pick.label));assert.ok(html.includes(match.nbaPercent(pick.probability)));assert.ok(html.includes(String(Math.round(report.analysis.expected.total))));assert.ok(html.includes('/teams/nba/2?date=2026-10-09'));assert.ok(html.includes('/teams/nba/5?date=2026-10-09'));assert.ok(!html.includes('候選未通過'));assert.ok(!html.includes('賠率'));}
 }finally{Date.now=oldNow;}
});
test('stale and already started games show no recommendation on either surface',()=>{
 const oldNow=Date.now;Date.now=()=>now;
 try{for(const [g,unavailable] of [[game,true],[{...game,state:'live'},false]]){
  const card=render(Card,{game:g,report,now,unavailable,showAnalysis:true}),pane=render(Pane,{games:[g],reports:{[game.id]:report},day:'2026-10-09',now,fetchedAt:new Date(now).toISOString(),unavailable,loading:false});
  assert.ok(!card.includes('data-nba-recommendation'));assert.ok(!pane.includes('data-nba-recommendation'));
 }}finally{Date.now=oldNow;}
});
test('all 30 team identities expose real logo URLs and working profile links',()=>{
 for(const team of n.NBA_TEAMS){const html=render(match.NbaTeamIdentity,{team});assert.ok(html.includes(`/teams/nba/${team.id}`));assert.ok(html.includes(team.logo));assert.ok(html.includes(team.name));}
});
test('quarter score renderer labels overtime and retains null as unknown rather than zero',()=>{
 const g={...game,homeScore:120,awayScore:118,quarters:[{period:5,home:12,away:null}]};const html=render(match.NbaQuarters,{game:g});assert.ok(html.includes('延長1'));assert.ok(html.includes('—'));assert.ok(html.includes('120'));assert.ok(html.includes('118'));
});

test('displayed complementary win rates sum to 100 after one-decimal rounding',()=>{for(const home of [.0025,.3845,.5005,.9975]){const d=match.nbaDisplayedProbabilities({home,away:1-home});assert.equal(Math.round((parseFloat(d.home)+parseFloat(d.away))*10),1000);}});

test('integer predicted scores cannot tie or contradict the favored side',()=>{
 assert.deepEqual(match.nbaDisplayedScore({home:88,away:88.4},{home:.4842,away:.5158}),{home:88,away:89,total:177,margin:-1});
 assert.deepEqual(match.nbaDisplayedScore({home:88.4,away:88},{home:.5158,away:.4842}),{home:89,away:88,total:177,margin:1});
 assert.deepEqual(match.nbaDisplayedScore({home:88.6,away:88.9},{home:.49,away:.51}),{home:88,away:89,total:177,margin:-1});
 assert.equal(match.nbaDisplayedScore({home:88,away:88},{home:.5,away:.5}),null);
 assert.deepEqual(match.nbaDisplayedScore({home:110.2,away:105.3},{home:.6,away:.4}),{home:110,away:105,total:215,margin:5});
});
