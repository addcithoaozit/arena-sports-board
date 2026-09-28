import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
import {parseNpbPlayText} from '../server/baseball-play-text.mjs';
const {npbTextZh,npbDisplayPlay,npbGameNames}=await import(moduleUrl('lib/npb-play-zh.ts'));
const cases=[
 ['四球を選ぶ 一塁','四壞保送；一壘有人'],
 ['セカンドゴロ 1アウト 一塁','二壘方向滾地球；1 出局；一壘有人'],
 ['セカンドゴロ 1アウト一塁','二壘方向滾地球；1 出局；一壘有人'],
 ['外角高めのストレートを打つもセンターフライ 3アウト','擊打外角偏高的直球，形成中外野飛球；3 出局'],
 ['空振り三振でバッターアウト 3アウト','揮棒落空三振出局；3 出局'],
 ['見逃し三振 2アウト','站著不動遭三振；2 出局'],
 ['一塁けん制:ランナー 小郷 帰塁','牽制一壘：跑者 小郷 回壘'],
 ['また一塁けん制:ランナー 小郷 帰塁','再次牽制一壘：跑者 小郷 回壘'],
 ['ど真ん中のストレートをレフトへ打ってヒット 一二塁','擊打正中央的直球，形成左外野安打；一、二壘有人'],
 ['フルカウントから空振りの三振を喫する 3アウト','滿球數時，揮棒落空三振出局；3 出局'],
 ['カウント0-1から左中間へのホームラン 西 1-3 楽','0 壞 1 好時，左中外野方向的全壘打 西武 1-3 樂天'],
 ['2アウト二塁からセンターへのヒット','2 出局、二壘有人時，中外野方向的安打'],
 ['二塁走者 宗山 は走塁死 3アウト','二壘跑者 宗山 跑壘出局；3 出局'],
 ['ファーストゴロの間に楽天1点をあげる','一壘方向滾地球期間，樂天攻下 1 分'],
 ['投手交代: 隅田 → 山田','換投: 隅田 → 山田'],
 ['守備変更: 山口(左)→(右)','守備調整: 山口（左外野）→（右外野）'],
 ['ランナーフルベースの2-0から犠飛','滿壘，2 壞 0 好時，高飛犧牲打'],
 ['広島サヨナラ勝ち！ 広 2-1 巨','廣島再見勝利! 廣島 2-1 巨人'],
 ['ネビン (一)のファンブルにより出塁する','因ネビン （一壘）接球失誤而上壘'],
 ['強烈な打球の内野安打','強勁內野安打'],
 ['試合終了','比賽結束'],['－治療中－','治療中'],
 ['中飛','中外野飛球'],['右2','右外野二壘安打'],['左犠飛','左外野高飛犧牲打'],['三ゴロ','三壘方向滾地球'],['ツーシーム','二縫線速球'],['カットボール','卡特球'],['空振り','揮棒落空'],['ファウル','界外球'],
];
test('NPB narrative, score-pitch abbreviations and pitch types display Traditional Chinese',()=>{for(const [jp,zh] of cases)assert.equal(npbTextZh(jp),zh,jp);});
test('player names are protected from term substitution and unfamiliar prose is not guessed',()=>{
 assert.equal(npbTextZh('ライトへのヒット 一塁',['ライト']),'右外野方向的安打；一壘有人');
 assert.equal(npbTextZh('ライト (右):エラー',['ライト']),'ライト （右外野）:失誤');
 assert.equal(npbTextZh('投手交代: ジャクソン → マルティネス',['ジャクソン','マルティネス']),'換投: ジャクソン → マルティネス');
 assert.equal(npbTextZh('これは未対応の文章です',[],'安打'),'安打');assert.equal(npbTextZh(''), '');
});
test('old raw snapshots render translated detailed text without modifying source or numeric fields',()=>{
 for(const id of ['2021039468','2021039469']){
  const game=JSON.parse(readFileSync(`tests/fixtures/npb-live/${id}.json`));
  game.playText=parseNpbPlayText(readFileSync(`tests/fixtures/npb-live/${id}-text.html`,'utf8'),game,{url:`https://baseball.yahoo.co.jp/npb/game/${id}/text`,fetchedAt:new Date().toISOString()});
  const before=JSON.stringify(game),names=npbGameNames(game);
  for(const play of game.playText.records){
   const shown=npbDisplayPlay(play,game);assert.equal(shown.language,'zh-Hant');
   for(const field of ['batter','count','bases','score','scoring','pitches','fetchedAt'])assert.deepEqual(shown[field],play[field]);
   for(const source of [...play.originalText,...play.actions.map(a=>a.description)])assert.notEqual(npbTextZh(source,names,'UNTRANSLATED'),'UNTRANSLATED',source);
   assert.equal(npbDisplayPlay(play,{...game,league:'KBO'}),play);
  }
  assert.equal(JSON.stringify(game),before);
 }
});
