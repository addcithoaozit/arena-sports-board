'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {RefreshCw,UserRound} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@/components/ui/table';
import {PLAYER_COLUMNS,type PlayerGroup,type PlayerStat} from '@/lib/player-profile';
import {NPB_GAME_COLUMNS,npbSeasonStats,type NpbPlayerData,type NpbPlayerLine} from '@/lib/npb-player-profile';
import InternationalTeamLogo from './international-team-logo';

const value=(stat:PlayerStat|null,key:string)=>stat?.[key]??'—';
function StatTable({group,rows,mode}:{group:PlayerGroup;rows:NpbPlayerLine[];mode:'history'|'games'}){
 const columns=mode==='history'?PLAYER_COLUMNS[group]:NPB_GAME_COLUMNS[group];
 return <Table><caption className="sr-only">{mode==='history'?'歷年':'近期'}{group==='pitching'?'投球':'打擊'}成績</caption><TableHeader><TableRow><TableHead>{mode==='history'?'球季':'日期'}</TableHead><TableHead>{mode==='history'?'球隊':'對手'}</TableHead>{mode==='games'&&<TableHead>賽事</TableHead>}{columns.map(([key,label])=><TableHead key={key} className="text-right">{label}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((row,index)=><TableRow key={`${row.season}-${row.date}-${row.team}-${index}`}><TableCell className="font-semibold">{mode==='history'?row.season:row.date}</TableCell><TableCell><span className="inline-flex items-center gap-2 whitespace-nowrap">{row.team!=='合計'&&<InternationalTeamLogo league="NPB" name={row.team} size={20}/>}<span>{row.team}</span></span></TableCell>{mode==='games'&&<TableCell>{row.competition}</TableCell>}{columns.map(([key])=><TableCell key={key} className="text-right tabular-nums">{value(row.stat,key)}</TableCell>)}</TableRow>)}</TableBody></Table>;
}
export default function NpbPlayerProfile({id}:{id:string}){
 const [data,setData]=useState<NpbPlayerData|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
 const [season,setSeason]=useState(''),[selectedGroup,setSelectedGroup]=useState<PlayerGroup|null>(null),[view,setView]=useState('overview'),[photoIndex,setPhotoIndex]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();let active=true;setLoading(true);setError('');const timer=setTimeout(()=>controller.abort(),25000);
  fetch(`/api/npb-player?id=${id}`,{signal:controller.signal,cache:'no-store'}).then(async response=>{const result=await response.json();if(!response.ok)throw Error(result.error);if(active){setData(result);setSeason(old=>old||String(result.sourceSeason));setPhotoIndex(0);}}).catch(()=>{if(active)setError('球員資料暫時無法更新，請稍後重試。');}).finally(()=>{clearTimeout(timer);if(active)setLoading(false);});
  return()=>{active=false;clearTimeout(timer);controller.abort();};
 },[id,revision]);
 const player=data?.player,group=selectedGroup||player?.defaultGroup||'hitting',stats=data?.groups[group],seasonStat=data?npbSeasonStats(data,group,+season):null;
 const years=data?[...new Set([data.sourceSeason,...Object.values(data.groups).flatMap(g=>g.history.map(row=>row.season))])].sort((a,b)=>b-a):[];
 const summary=group==='pitching'?[['era','防禦率'],['whip','WHIP'],['inningsPitched','投球局數'],['strikeOuts','三振'],['wins','勝投'],['saves','救援成功']]:[['avg','打擊率'],['ops','OPS'],['hits','安打'],['homeRuns','全壘打'],['rbi','打點'],['stolenBases','盜壘']];
 const games=stats?.games.filter(row=>row.season===+season)||[];
 const recent=<section className="panel p-5 mt-5"><h2 className="team-section-title">近期出賽 <small>· {season} · 最近 6 場（含二軍）</small></h2>{games.length?<StatTable rows={games} group={group} mode="games"/>:<p className="team-footnote">{+season===data?.sourceSeason?'目前尚無近期出賽紀錄。':'近期出賽僅提供最新球季；其他年度請查看歷年成績。'}</p>}</section>;
 return <main className="arena-shell min-h-screen"><header className="team-page-nav"><Link href="/?league=NPB">← YJ體育分析</Link><Link href="/?league=NPB&view=teams">球隊一覽</Link></header><div className="team-page-container player-page">
  <div className="team-identity player-identity"><div className="player-portrait"><UserRound aria-hidden="true"/>{player?.photoUrls[photoIndex]&&<img src={player.photoUrls[photoIndex]} width={120} height={150} alt={`${player.name} 球員照片`} onError={()=>setPhotoIndex(n=>n+1)}/>}</div><div><p className="league-eyebrow">NPB / 球員數據</p><h1>{player?.name||'球員數據'}</h1>{player&&<><p className="player-subtitle">#{player.number||'—'} · {player.position}</p>{player.teamCode?<Link href={`/teams/international/npb/${player.teamCode}`} className="player-team-link inline-flex items-center gap-2"><InternationalTeamLogo league="NPB" name={player.team} size={26}/>{player.team}</Link>:<p>{player.team}</p>}</>}</div><Button variant="outline" disabled={loading} onClick={()=>setRevision(n=>n+1)}><RefreshCw className={loading?'animate-spin':''}/>更新</Button></div>
  {error&&<div className="panel p-5 mb-4" role="alert">{error}<Button variant="ghost" onClick={()=>setRevision(n=>n+1)} disabled={loading}>重試</Button></div>}
  {!data?(!error&&<div className="panel p-6" role="status">正在取得球員資料與成績…</div>):<>
   <div className="team-filters panel"><label className="team-filter"><span>年度</span><Select value={season} onValueChange={setSeason}><SelectTrigger aria-label="球員成績年度"><SelectValue/></SelectTrigger><SelectContent>{years.map(y=><SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select></label><div className="team-filter"><span>賽事類型</span><strong className="block py-2 text-sm">一軍例行賽</strong></div><label className="team-filter"><span>數據類別</span><Select value={group} onValueChange={v=>setSelectedGroup(v as PlayerGroup)}><SelectTrigger aria-label="選擇投球或打擊數據"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="pitching">投球</SelectItem><SelectItem value="hitting">打擊</SelectItem></SelectContent></Select></label></div>
   {data.stale&&<p className="team-footnote" role="status">顯示最近一次取得的資料，更新時間見頁尾。</p>}
   <Tabs value={view} onValueChange={setView}><TabsList className="league-tabs" aria-label="球員數據分類"><TabsTrigger value="overview">概覽</TabsTrigger><TabsTrigger value="history">歷年成績</TabsTrigger><TabsTrigger value="games">逐場紀錄</TabsTrigger></TabsList><TabsContent value={view}>
    {view==='overview'&&<><div className="team-metrics">{summary.map(([key,label])=><div key={key}><span>{label}</span><strong>{value(seasonStat,key)}</strong><small>{season} · 一軍例行賽</small></div>)}</div>{!seasonStat&&<p className="team-footnote">此球季尚無可用的一軍{group==='pitching'?'投球':'打擊'}成績。</p>}
     <div className="team-detail-grid"><section className="panel p-5"><h2 className="team-section-title">個人資料</h2><dl className="player-bio">{player!.bio.map(([label,text])=><div key={label}><dt>{label}</dt><dd>{text}</dd></div>)}</dl></section><section className="panel p-5"><h2 className="team-section-title">生涯{group==='pitching'?'投球':'打擊'}成績 <small>· 一軍例行賽</small></h2>{stats?.career?<dl className="player-career">{PLAYER_COLUMNS[group].map(([key,label])=><div key={key}><dt>{label}</dt><dd>{value(stats.career,key)}</dd></div>)}</dl>:<p className="team-footnote">尚無可用的 NPB 一軍生涯{group==='pitching'?'投球':'打擊'}紀錄。</p>}</section></div>{recent}</>}
    {view==='history'&&<section className="panel p-5"><h2 className="team-section-title">歷年{group==='pitching'?'投球':'打擊'}成績 <small>· 一軍例行賽</small></h2>{stats?.history.length?<StatTable rows={stats.history} group={group} mode="history"/>:<p className="team-footnote">尚無可用的歷年成績。</p>}</section>}
    {view==='games'&&recent}
   </TabsContent></Tabs>
   <p className="team-footnote">資料來源：<a href={data.source} target="_blank" rel="noreferrer">Sportsnavi 日職</a> · 成績更新 {data.updatedAt}（日本） · 取得 {new Date(data.fetchedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})}（台灣）</p>
  </>}
 </div></main>;
}
