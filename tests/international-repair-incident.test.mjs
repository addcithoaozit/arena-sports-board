import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleUrl} from './profile-loader.mjs';
import {kboPublicForm,kboPageTargets,createKboSeasonPages} from '../server/kbo-season-pages.mjs';
import {collectLeague} from '../server/baseball-live-providers.mjs';
const {internationalTeam}=await import(moduleUrl('lib/international-teams.ts'));
const {pitcherIdentity}=await import(moduleUrl('lib/international-pitcher-identity.ts'));
const {supplementSeasonPitching}=await import(moduleUrl('lib/international-season-pitching.ts'));
const {mergePregameFixtures}=await import(moduleUrl('lib/international-pregame.ts'));
const {parseInternational}=await import(moduleUrl('lib/international.ts'));
const form=`<input type="hidden" name="__VIEWSTATE" value="public-state"><input type="hidden" name="__EVENTVALIDATION" value="public-validation"><input type="hidden" name="ctl$hfPage" value="1"><input type="hidden" name="ctl$hfOrderByCol" value="INN2_CN"><select name="ctl$ddlTeam"><option value="">全部</option><option value="LT">롯데</option></select><a href="javascript:__doPostBack('ctl$ucPager$btnNo2','')">2</a>`;
test('KBO public team and next-page filters retain actual form fields',()=>{
 const first=kboPublicForm(form,'LT');assert.equal(first.get('ctl$ddlTeam'),'LT');assert.equal(first.get('__EVENTTARGET'),'ctl$ddlTeam');assert.equal(first.get('ctl$hfOrderByCol'),'INN2_CN');
 const second=kboPublicForm(form,'LT',2);assert.equal(second.get('__EVENTTARGET'),'ctl$ucPager$btnNo2');assert.equal(second.get('ctl$hfPage'),'2');assert.equal(kboPageTargets(form).size,1);assert.throws(()=>kboPublicForm(form,'LT',3));assert.throws(()=>kboPublicForm('', 'LT'));
});
test('KBO includes nonqualified pitchers on later pages and does not call another team',async()=>{
 const calls=[];const collect=createKboSeasonPages({now:()=>Date.parse('2026-09-23T05:00:00Z'),fetcher:async(url,init)=>{calls.push(init.body||'GET');return new Response(calls.length<3?form:'last-page');},parse:(html,date,at,url)=>[{team:'樂天巨人',name:html===form?'박세웅':'new-pitcher',source:{observedAt:at,url},stats:{era:'4.92',whip:'1.54'}}]});
 const r=await collect('2026-09-23',['樂天巨人']);assert.deepEqual(r.rows.map(r=>r.name),['박세웅','new-pitcher']);assert.equal(calls.length,3);assert.equal(r.errors.length,0);await collect('2026-09-23',['樂天巨人']);assert.equal(calls.length,3);
});
test('KBO denied source stops without alternate-access retries',async()=>{let calls=0;const collect=createKboSeasonPages({fetcher:async()=>{calls++;return new Response('denied',{status:403});},parse:()=>[]});const r=await collect('2026-09-23',['樂天巨人']);assert.equal(calls,1);assert.equal(r.rows.length,0);assert.match(r.errors[0],/403/);});
test('KIA alias and verified Chiba pitcher forms share identity, other teams stay distinct',()=>{
 assert.equal(internationalTeam('起亞老虎','KBO'),'起亞虎');assert.equal(internationalTeam('起亞老虎','NPB'),'起亞老虎');
 for(const [a,b] of [['J・ルケーシー','ルケーシー'],['A・ジャクソン','ジャクソン']]){assert.equal(pitcherIdentity(a,'NPB','千葉羅德'),pitcherIdentity(b,'NPB','千葉羅德海洋'));assert.notEqual(pitcherIdentity(a,'NPB','阪神虎'),pitcherIdentity(b,'NPB','阪神虎'));}
});
test('newer matching ERA does not suppress missing WHIP or innings; conflicts still block',()=>{
 const now=Date.parse('2026-09-23T05:00:00Z'),oldTime='2026-09-23T04:40:00Z',freshTime='2026-09-23T04:55:00Z';
 const side={team:'千葉羅德海洋',starter:{name:'J・ルケーシー',season:{era:'4.20',whip:'',innings:'',wins:'1'},quality:'unavailable',warnings:[],statSources:{era:{observedAt:freshTime}}},bullpen:null};
 const data={league:'NPB',date:'2026-09-23',games:[{league:'NPB',date:'2026-09-23',start:'2026-09-23 16:00:00',away:side,home:{...side,starter:{...side.starter,name:'another'}}}]};
 const row={team:side.team,name:'ルケーシー',stats:{era:'4.20',whip:'1.27',innings:'15',wins:''},source:{name:'NPB',url:'https://npb.jp/',observedAt:oldTime}};
 const out=supplementSeasonPitching(data,{rows:[row]},now).games[0];assert.equal(out.away.starter.season.whip,'1.27');assert.equal(out.away.starter.season.innings,'15');assert.equal(out.away.starter.season.wins,'1');assert.equal(out.away.starter.statSources.era.observedAt,freshTime);assert.equal(out.away.starter.statSources.innings.observedAt,oldTime);assert.equal(out.home.starter.season.whip,'');assert.equal(out.away.bullpen,null);
 const bad=structuredClone(data);bad.games[0].away.starter.season.era='9.00';assert.equal(supplementSeasonPitching(bad,{rows:[row]},now).games[0].away.starter.season.whip,'');
});
test('CPBL standings accept actual tied ranks and leader gap without discarding all teams',()=>{
 const rows=[['1','龍','63','47','.573','-','0'],['2','悍將','56','54','.509','7.0','0'],['3','獅','55','54','.505','7.5','1'],['4','桃猿','51','56','.477','10.5','2'],['5','兄弟','51','58','.468','11.5','2'],['5','雄鷹','51','58','.468','11.5','1']];
 const html='<title>CPBL 2026 排名 - Yahoo運動</title><table><tr>'+['排名','ALL','勝','敗','勝率','勝差','和'].map(s=>'<th>'+s+'</th>').join('')+'</tr>'+rows.map(r=>'<tr>'+r.map(s=>'<td>'+s+'</td>').join('')+'</tr>').join('')+'</table>';
 const out=parseInternational(html,'cpbl-standings',2026);assert.equal(out.tables[0].rows.length,6);assert.equal(out.tables[0].rows[5][0],'5');assert.equal(out.tables[0].rows[0][1],'味全龍');assert.throws(()=>parseInternational(html.replace('<td>7.0</td>','<td>-</td>'),'cpbl-standings',2026));
});
test('CPBL future schedule remains visible when a box score is not yet published',async()=>{
 const raw={gameId:'cpbl.g.260924348',seasonPhase:'REGULAR_SEASON',startTime:'2026-09-24T10:35:00Z',status:'PREGAME',homeTeamId:'cpbl.t.2',awayTeamId:'cpbl.t.7',alias:{url:'https://tw.sports.yahoo.com/cpbl/game-260924348/'}};
 const html='<script>self.__next_f.push('+JSON.stringify([1,'1:'+JSON.stringify(raw)+'\n'])+')</script>';
 const result=await collectLeague('CPBL',{date:'2026-09-24',fetcher:async url=>new Response(String(url).includes('/teams/')?html:'<title>game</title>')});
 assert.equal(result.games.length,1);assert.equal(result.games[0].status,'pregame');assert.equal(result.games[0].starters.away,null);assert.equal(result.games[0].away.score,null);assert.equal(result.status,'partial');
});
test('Chiba Long announcement keeps matching season data; actual starter changes still block',()=>{
 assert.equal(pitcherIdentity('Ｓ・ロング','NPB','千葉羅德'),pitcherIdentity('ロング','NPB','千葉羅德海洋'));
 assert.notEqual(pitcherIdentity('A・ロング','NPB','千葉羅德'),pitcherIdentity('ロング','NPB','千葉羅德'));
 assert.notEqual(pitcherIdentity('S・ロング','NPB','阪神虎'),pitcherIdentity('ロング','NPB','阪神虎'));
 const starter=name=>({name,season:{era:'3.50',whip:'1.20'},quality:'source_reported'});
 const game={id:'long-regression',league:'NPB',date:'2026-10-01',start:'2026-10-01 17:00:00',kind:'pregame_snapshot',source:{observedAt:'2026-10-01T07:00:00Z'},away:{team:'北海道日本火腿鬥士',starter:starter('北山亘基')},home:{team:'千葉羅德海洋',starter:starter('ロング')}};
 const fixture={id:'official',start:game.start,away:game.away.team,home:game.home.team,live:false,displayMarkets:[],starters:{away:'北山 亘基',home:'S・ロング'}};
 const snapshot={league:'NPB',season:2026,date:game.date,games:[game]};
 assert.equal(mergePregameFixtures([fixture],snapshot,'NPB')[0].pregame.home.starter.season.whip,'1.20');
 assert.equal(mergePregameFixtures([{...fixture,starters:{...fixture.starters,home:'ジャクソン'}}],snapshot,'NPB')[0].pregame,undefined);
});
