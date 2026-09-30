import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const m=await import(moduleUrl('lib/wnba-official-players.ts'));
const raw=()=>JSON.parse(readFileSync('tests/fixtures/wnba/official-players.json','utf8'));
const base={id:4704180,name:'Georgia Amoore',height:'',weight:'',school:'',photo:'https://a.espncdn.com/i/headshots/wnba/players/full/4704180.png',href:'https://www.espn.com/wnba/player/stats/_/id/4704180'};
test('official identity enriches genuine headshot, bio, season statistics and link',()=>{
 const players=m.parseWnbaOfficialPlayers(raw()),p=m.enrichWnbaPlayer(base,'16',2026,players);
 assert.equal(p.officialId,1642781);assert.match(p.photo,/cdn.wnba.com\/headshots\/wnba\/latest\/1040x760\/1642781.png$/);assert.equal(p.photoFallback,base.photo);assert.equal(p.weight,'155');assert.equal(p.country,'Australia');assert.equal(p.averages.points,7);assert.match(p.href,/wnba.com\/player\/1642781\/georgia-amoore$/);
 assert.equal(m.enrichWnbaPlayer(base,'20',2026,players).averages,null);assert.equal(m.enrichWnbaPlayer(base,'16',2025,players).averages,null);
 assert.equal(m.enrichWnbaPlayer({...base,name:'Unmatched Player'},'16',2026,players).photo,base.photo);
 assert.equal(m.enrichWnbaPlayer(base,'16',2026,[...players,players.find(p=>p.id===1642781)]).photo,base.photo);
});
test('invalid directory rejects duplicate identities and unknown season-stat labels',()=>{
 const d=raw();d.props.pageProps.currentPlayersData.push(d.props.pageProps.currentPlayersData[0]);assert.throws(()=>m.parseWnbaOfficialPlayers(d));
 const other=raw();other.props.pageProps.currentPlayersData[0][24]='Career';assert.equal(m.parseWnbaOfficialPlayers(other)[0].points,null);
});
test('audited fallback has real identity and bio only; it never invents live statistics',()=>{
 const snapshot=JSON.parse(readFileSync('data/wnba-player-identities.json','utf8'));
 for(const [id,p] of Object.entries(snapshot.players)){
  const out=m.enrichWnbaPlayer({...base,id:Number(id),name:p.name},'16',2026,[]);
  assert.equal(out.officialId,p.id);assert.equal(out.averages,null);assert.match(out.photo,/cdn.wnba.com/);
 }
 const ui=readFileSync('app/nba-team-profile.tsx','utf8');assert.ok(ui.includes('p.photo||'));assert.ok(ui.includes('p.href||'));assert.ok(ui.includes('p.photoFallback'));
});
test('actual roster panel renders official photos, data and player links',async()=>{
 const ts=(await import('typescript')).default,React=(await import('react')).default,{renderToStaticMarkup}=await import('react-dom/server');
 const source=ts.createSourceFile('profile.tsx',readFileSync('app/nba-team-profile.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let panel;
 function visit(n){if(ts.isConditionalExpression(n)&&n.condition.getText(source)==="tab==='players'")panel=n.whenTrue;ts.forEachChild(n,visit);}visit(source);assert.ok(panel);
 const code=ts.transpileModule('function Panel(){return '+panel.getText(source)+'}',{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText;
 const p=m.enrichWnbaPlayer(base,'16',2026,m.parseWnbaOfficialPlayers(raw()));
 const Panel=new Function('React','official','officialError','retry','labelSeason','league','positionZh',code+';return Panel;')(React,{rosterSeason:'2026',roster:[p]},'',null,String,'WNBA',String);
 const html=renderToStaticMarkup(React.createElement(Panel));assert.match(html,/cdn.wnba.com\/headshots/);assert.match(html,/wnba.com\/player\/1642781/);assert.match(html,/2026 場均/);assert.match(html,/Australia/);assert.match(html,/Kentucky/);
});
