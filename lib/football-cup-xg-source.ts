// Verified source evidence only. A failed candidate cannot alter probabilities.
import seed from '../data/football/cup-xg-history.json';
import type {FootballAnalysis,FootballGame} from './football';
const DAY=86400000;
type Row=[string,string,string,string,string,number,number,number,number,boolean,string,string,string,boolean];
const rows=seed.rows as Row[];
const identities=seed.identities as Record<string,{espnId:string;canonicalId:string}>;
const canonical=new Map(Object.values(identities).map(t=>[t.espnId,t.canonicalId]));
const NATIONAL=new Set(['uefa.nations','uefa.euro','uefa.euroq','fifa.world','fifa.worldq.uefa']);
export type CupXgEvidence={sources:string[];sourceUpdatedAt:string;stale:boolean;modelApplied:false;home:{games:number;for:number|null;against:number|null;latest:string|null};away:{games:number;for:number|null;against:number|null;latest:string|null}};
export function cupXgEvidence(game:FootballGame,now=Date.now()):CupXgEvidence|null{
 const national=game.league==='uefa.nations';
 if(!national&&game.league!=='uefa.champions')return null;
 const before=Math.min(Math.floor(now/DAY)*DAY,Math.floor(Date.parse(game.start)/DAY)*DAY);
 if(!Number.isFinite(before))return null;
 const home=national?game.home.id:canonical.get(game.home.id),away=national?game.away.id:canonical.get(game.away.id);
 if(!home||!away)return null;
 const history=rows.filter(r=>(national?NATIONAL.has(r[1]):r[1]===game.league)&&Date.parse(r[2])<before&&Date.parse(r[2])>=before-(national?730:365)*DAY);
 const summarize=(id:string)=>{
  const selected=history.filter(r=>r[3]===id||r[4]===id).slice(-20);
  return {games:selected.length,for:selected.length?selected.reduce((v,r)=>v+r[r[3]===id?7:8],0)/selected.length:null,against:selected.length?selected.reduce((v,r)=>v+r[r[3]===id?8:7],0)/selected.length:null,latest:selected.at(-1)?.[2]??null};
 };
 const age=now-Date.parse(seed.sourceUpdatedAt);
 return {sources:['FotMob','ESPN'],sourceUpdatedAt:seed.sourceUpdatedAt,stale:!Number.isFinite(age)||age<0||age>48*3600000,modelApplied:false,home:summarize(home),away:summarize(away)};
}
export function attachCupXgEvidence(game:FootballGame,analysis:FootballAnalysis,now=Date.now()):FootballAnalysis{
 const evidence=cupXgEvidence(game,now);
 return evidence?{...analysis,xgEvidence:evidence}:analysis;
}
