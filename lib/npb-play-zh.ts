import type {TextGame,TextPlay} from './international-play-text';

const terms:Record<string,string>={
 '空振り三振でバッターアウト':'揮棒落空三振出局','空振りの三振を喫する':'揮棒落空三振出局','見逃し三振':'站著不動遭三振','空振り三振':'揮棒落空三振出局',
 '四球を選ぶ':'四壞保送','フォアボールを選ぶ':'四壞保送','見事送りバントを決める':'成功完成犧牲觸擊','送りバントを決める':'完成犧牲觸擊',
 'タイムリーツーベース':'帶有打點的二壘安打','タイムリースリーベース':'帶有打點的三壘安打','タイムリーヒット':'帶有打點的安打','タイムリー内野安打':'帶有打點的內野安打',
 'ランニングホームラン':'場內全壘打','満塁ホームラン':'滿貫全壘打','ソロホームラン':'陽春全壘打','ツーランホームラン':'兩分全壘打','スリーランホームラン':'三分全壘打',
 'ホームラン':'全壘打','本塁打':'全壘打','ツーベース':'二壘安打','スリーベース':'三壘安打','内野安打':'內野安打','ヒット':'安打','二塁打':'二壘安打','三塁打':'三壘安打',
 'ダブルプレー':'雙殺','ゲッツー':'雙殺','併殺打':'雙殺打','犠牲フライ':'高飛犧牲打','犠飛':'高飛犧牲打','送りバント':'犧牲觸擊','犠打':'犧牲觸擊',
 'セーフティバント':'突襲觸擊','スクイズ':'強迫取分觸擊','バント':'觸擊','インフィールドフライ':'內野高飛球','ファウルフライ':'界外飛球',
 'ストライクゾーン':'好球帶','ワンバウンド':'落地彈跳球','ストレート':'直球','ツーシーム':'二縫線速球','カットボール':'卡特球','スライダー':'滑球','カーブ':'曲球','フォーク':'指叉球','チェンジアップ':'變速球','スプリット':'快速指叉球','シンカー':'伸卡球','シュート':'噴射球','ナックル':'蝴蝶球','パーム':'掌心球',
 '外角低め':'外角偏低','内角低め':'內角偏低','外角高め':'外角偏高','内角高め':'內角偏高','ど真ん中':'正中央','真ん中低め':'中間偏低','真ん中高め':'中間偏高','真ん中':'中間','外角':'外角','内角':'內角','高め':'偏高','低め':'偏低',
 'ピッチャー':'投手','キャッチャー':'捕手','ファースト':'一壘','セカンド':'二壘','サード':'三壘','ショート':'游擊','センター':'中外野','レフト':'左外野','ライト':'右外野','左中間':'左中外野','右中間':'右中外野',
 'ゴロ':'滾地球','ライナー':'平飛球','フライ':'飛球','ファウル':'界外球','空振り':'揮棒落空','見逃し':'好球（未揮棒）','ボール':'壞球','ストライク':'好球',
 'フォアボール':'四壞保送','四球':'四壞保送','デッドボール':'觸身球','死球':'觸身球','申告敬遠':'申告故意四壞','敬遠':'故意四壞','三振':'三振出局',
 'ファンブル':'接球失誤','送球ミス':'傳球失誤','エラー':'失誤','悪送球':'傳球失誤','ワイルドピッチ':'暴投','パスボール':'捕逸','ボーク':'投手犯規','フィルダースチョイス':'野手選擇','野選':'野手選擇','打撃妨害':'打擊妨礙','守備妨害':'守備妨礙','走塁妨害':'跑壘妨礙',
 '盗塁成功':'盜壘成功','盗塁失敗':'盜壘失敗','盗塁刺':'盜壘被刺殺','盗塁':'盜壘','けん制':'牽制','牽制死':'牽制出局','走塁死':'跑壘出局','帰塁':'回壘','進塁':'推進壘包','帰還':'回到本壘','生還':'回本壘得分','ホームイン':'回本壘得分',
 '投手交代':'換投','守備交代':'守備更換','守備変更':'守備調整','代走':'代跑','代打':'代打','ピンチランナー':'代跑球員','リリーフ':'後援投手','マウンド':'投手丘',
 'リクエスト':'提出重播輔助判決','リプレー検証':'重播輔助判決','ビデオ判定':'重播輔助判決','判定覆り':'判決改判','判定変わらず':'維持原判','リプレイ':'重播','治療中':'治療中','コーチ':'教練','タイム':'暫停',
 'サヨナラ勝ち':'再見勝利','サヨナラ':'再見','先制':'率先得分','同点':'追平比分','逆転':'逆轉','勝ち越し':'取得領先','追加点':'追加得分','先頭打者':'首位打者','打者':'打者','バッター':'打者','ランナー':'跑者','走者':'跑者','フルベース':'滿壘','満塁':'滿壘','走者なし':'壘上無人','無死':'無人出局','一死':'一人出局','二死':'兩人出局',
 '結果待ち':'等待結果','判定待ち':'等待判決','打球':'擊球','投球':'投球','投球開始':'開始投球','故意四球':'故意四壞保送','敬遠四球':'故意四壞保送','打撃妨害で出塁':'因打擊妨礙上壘',
 '試合終了':'比賽結束','試合中断':'比賽暫停','試合再開':'比賽恢復','試合開始':'比賽開始','試合前情報':'賽前資訊','攻撃終了':'半局結束','投球前':'投球前','打席開始':'打席開始',
 '強烈な打球':'強勁擊球','痛烈な打球':'強勁擊球','鋭い打球':'強勁擊球','詰まった打球':'擠壓擊球','つまった打球':'擠壓擊球','高く弾んだ打球':'高彈跳球','ワンアウト':'1 出局','ツーアウト':'2 出局','スリーアウト':'3 出局','アウト':'出局',
 '横浜':'橫濱','広島':'廣島','楽天':'樂天','ロッテ':'羅德','日本ハム':'日本火腿','ソフトバンク':'軟銀','オリックス':'歐力士','ヤクルト':'養樂多','ＤｅＮＡ':'DeNA',
};
const escape=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const termPattern=new RegExp(Object.keys(terms).sort((a,b)=>b.length-a.length).map(escape).join('|'),'g');
const teamShort:Record<string,string>={'巨':'巨人','神':'阪神','デ':'DeNA','広':'廣島','ヤ':'養樂多','中':'中日','ソ':'軟銀','日':'日本火腿','オ':'歐力士','楽':'樂天','西':'西武','ロ':'羅德'};
const bases=(value:string)=>[...value].join('、')+'壘有人';
const position:Record<string,string>={'投':'投手','捕':'捕手','一':'一壘','二':'二壘','三':'三壘','遊':'游擊','左':'左外野','中':'中外野','右':'右外野','指':'指定打擊'};
const pitchShort:Record<string,string>={'左飛':'左外野飛球','中飛':'中外野飛球','右飛':'右外野飛球','左安':'左外野安打','中安':'中外野安打','右安':'右外野安打','左安打':'左外野安打','中安打':'中外野安打','右安打':'右外野安打','空三振':'揮棒落空三振出局','見三振':'站著不動遭三振','投ゴロ':'投手方向滾地球','捕ゴロ':'捕手方向滾地球','一ゴロ':'一壘方向滾地球','二ゴロ':'二壘方向滾地球','三ゴロ':'三壘方向滾地球','遊ゴロ':'游擊方向滾地球'};

/** Display translation only: source text and numeric game fields remain intact. */
export function npbTextZh(input:string,names:string[]=[],fallback='比賽紀錄更新'){
 if(!input)return '';
 const source=input.normalize('NFKC').trim();if(pitchShort[source])return pitchShort[source];
 const short=source.match(/^([投捕一二三遊左中右])(飛|直|邪飛|安|安打|2|3|本|失|犠打|犠飛|併殺)$/);
 if(short)return position[short[1]]+({飛:'飛球',直:'平飛球',邪飛:'界外飛球',安:'安打',安打:'安打','2':'二壘安打','3':'三壘安打',本:'全壘打',失:'守備失誤',犠打:'犧牲觸擊',犠飛:'高飛犧牲打',併殺:'雙殺'} as Record<string,string>)[short[2]];
 let text=source;const protectedNames:string[]=[];
 // Protect roster names, including the short surnames used in runner events.
 const candidates=[...new Set(names.filter(Boolean).flatMap(n=>[n.normalize('NFKC'),...n.normalize('NFKC').split(/\s+/).filter(p=>p.length>=2)]))].sort((a,b)=>b.length-a.length);
 if(candidates.length)text=text.replace(new RegExp('(?<![\\p{L}\\p{N}])(?:'+candidates.map(escape).join('|')+')(?![\\p{L}\\p{N}])','gu'),name=>`\uE000${protectedNames.push(name)-1}\uE001`);
 // A player adjacent to a fielding-position tag is explicitly named by the source.
 text=text.replace(/[ァ-ヶー・]+(?=\s*\([投捕一二三遊左中右指]\))/g,name=>`\uE000${protectedNames.push(name)-1}\uE001`);
 text=text
  .replace(/([巨神デ広ヤ中ソ日オ楽西ロ])\s+(\d+)-(\d+)\s+([巨神デ広ヤ中ソ日オ楽西ロ])/g,(_,a,x,y,b)=>`${teamShort[a]} ${x}-${y} ${teamShort[b]}`)
  .replace(/一打先制の場面で/g,'有機會率先得分時，')
  .replace(/フルカウントから/g,'滿球數時，')
  .replace(/(?:カウント)?([0-3])-([0-2])から/g,'$1 壞 $2 好時，')
  .replace(/([123])アウト(一二三|一二|一三|二三|一|二|三)塁から/g,(_,out,b)=>`${out} 出局、${bases(b)}時，`)
  .replace(/(?:ランナー)?(一二三|一二|一三|二三|一|二|三)塁(?:から|の)/g,(_,b)=>bases(b)+'時，')
  .replace(/ランナーフルベースの/g,'滿壘，')
  .replace(/([一二三])塁走者\s*(.+?)\s*は走塁死/g,'$1壘跑者 $2 跑壘出局')
  .replace(/([一二三])塁けん制\s*:\s*ランナー\s*(.+?)\s*帰塁/g,'牽制$1壘：跑者 $2 回壘')
  .replace(/また(?=牽制)/g,'再次')
  .replace(/の間に(.+?)(\d+)点をあげる/g,'期間，$1攻下 $2 分')
  .replace(/(.+?)を(レフト|センター|ライト)へ打ってヒット/g,'擊打$1，形成$2安打')
  .replace(/(.+?)を打つも/g,'擊打$1，形成')
  .replace(/(?:を放つ|を放った|を記録|をマーク)/g,'')
  .replace(/で出塁(?:する)?/g,'上壘')
  .replace(/(.+?)のファンブルにより出塁(?:する)?/g,'因$1接球失誤而上壘')
  .replace(/により出塁(?:する)?/g,'而上壘')
  .replace(/(?:(?:投手交代|換投)\s*:\s*)?([\uE000\uE001\dァ-ヶー・一-龠]+)\s*に代わって\s*([\uE000\uE001\dァ-ヶー・一-龠]+)/g,'$1 → $2')
  .replace(/に代わり/g,' → ')
  .replace(/がマウンドにあがる/g,'登板投球')
  .replace(/(\d)アウト(一二三|一二|一三|二三|一|二|三)塁/g,(_,out,b)=>`；${out} 出局；${bases(b)}`)
  .replace(/(^|\s)(一二三|一二|一三|二三|一|二|三)塁(?=$|\s)/g,(_,before,b)=>`${before}；${bases(b)}`)
  .replace(/\s*([123])アウト/g,'；$1 出局')
  .replace(/(\d+)回表/g,'$1 局上').replace(/(\d+)回裏/g,'$1 局下')
  .replace(/\(([投捕一二三遊左中右指])\)/g,(_,p)=>`（${position[p]}）`);
 text=text.replace(termPattern,word=>terms[word])
  .replace(/への/g,'方向的').replace(/へ/g,'往').replace(/の/g,'的')
  .replace(/を選ぶ/g,'').replace(/を喫する/g,'').replace(/に成功/g,'成功').replace(/に失敗/g,'失敗')
  .replace(/で打者出局/g,'，打者出局').replace(/となる/g,'').replace(/により/g,'因').replace(/終了/g,'結束').replace(/塁/g,'壘')
  .replace(/(?:的)?(\d+) 壞 (\d+) 好時/g,'$1 壞 $2 好時')
  .replace(/(投手|捕手|一壘|二壘|三壘|游擊)(?=滾地球)/g,'$1方向')
  .replace(/\s*；\s*/g,'；').replace(/強勁擊球的內野安打/g,'強勁內野安打').replace(/^-治療中-$/,'治療中').replace(/^[；，\s]+|[；，\s]+$/g,'').replace(/\s+/g,' ');
 // Unrecognized prose never becomes a guessed play or partially translated sentence.
 // Show the source's already-classified event instead, retaining raw text in the feed.
 if(/[\u3040-\u30ff]/.test(text))text=fallback;
 return text.replace(/\uE000(\d+)\uE001/g,(_,index)=>protectedNames[Number(index)]);
}
export function npbGameNames(game:TextGame){
 return [game.currentBatter?.name,game.currentPitcher?.name,...(['away','home'] as const).flatMap(side=>[game.starters?.[side]?.name,...[game.lineups?.[side],game.batting?.[side],game.pitching?.[side]].flatMap(rows=>(rows||[]).map(p=>p.name))]),...(game.playText?.records||[]).map(p=>p.batter?.name)].filter((n):n is string=>!!n);
}
export function npbDisplayPlay(play:TextPlay,game:TextGame){
 if(game.league!=='NPB')return play;
 const names=npbGameNames(game),fallback=play.event==='文字紀錄'?'比賽紀錄更新':play.event;
 return {...play,language:'zh-Hant',description:npbTextZh(play.description,names,fallback),originalText:play.originalText.map(text=>npbTextZh(text,names,fallback)),actions:play.actions.map(a=>({...a,description:npbTextZh(a.description,names,a.event)}))};
}
