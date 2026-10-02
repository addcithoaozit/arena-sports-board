// Pure chronological features shared by the offline audit and production.
import type {ExternalFootballGame} from './football-xg-features';
import {marketFootballDistribution} from './football-market-core';
const DAY=86400000;
export type OpponentXgOptions={decayDays:number;lookbackDays:number;priorGames?:number};
type Form={games:number;xgGames:number;latest:number;gf:number;ga:number;xf:number;xa:number;agf:number;aga:number;axf:number;axa:number};
export type OpponentXgGame=Omit<ExternalFootballGame,'league'>&{league:string};
type Adjusted=OpponentXgGame&{adjusted:[number,number,number|null,number|null]};
const clampRatio=(v:number)=>Math.max(.5,Math.min(2,v));
export class FootballOpponentXgHistory {
  private rows:Adjusted[]=[];
  private seen=new Set<string>();
  private lastDay=-Infinity;
  constructor(readonly options:OpponentXgOptions){
    if(![options.decayDays,options.lookbackDays,options.priorGames??5].every(v=>Number.isFinite(v)&&v>0))throw Error('對手特徵時間設定無效');
  }
  private form(id:string,before:number,rows=this.rows):Form {
    const selected=rows.filter(g=>(g.homeId===id||g.awayId===id)&&Date.parse(g.start)<before&&Date.parse(g.start)>=before-this.options.lookbackDays*DAY).slice(-20);
    let w=0,xw=0,gf=0,ga=0,xf=0,xa=0,agf=0,aga=0,axf=0,axa=0,xgGames=0,latest=0;
    for(const g of selected){const home=g.homeId===id,weight=Math.exp(-(before-Date.parse(g.start))/(this.options.decayDays*DAY));w+=weight;gf+=weight*(home?g.homeGoals:g.awayGoals);ga+=weight*(home?g.awayGoals:g.homeGoals);agf+=weight*g.adjusted[home?0:1];aga+=weight*g.adjusted[home?1:0];
      if(g.homeXg!==null&&g.awayXg!==null){xw+=weight;xgGames++;latest=Math.max(latest,Date.parse(g.start));xf+=weight*(home?g.homeXg:g.awayXg);xa+=weight*(home?g.awayXg:g.homeXg);axf+=weight*g.adjusted[home?2:3]!;axa+=weight*g.adjusted[home?3:2]!;}}
    return {games:selected.length,xgGames,latest,gf:w?gf/w:0,ga:w?ga/w:0,xf:xw?xf/xw:0,xa:xw?xa/xw:0,agf:w?agf/w:0,aga:w?aga/w:0,axf:xw?axf/xw:0,axa:xw?axa/xw:0};
  }
  addDay(games:OpponentXgGame[]){
    if(!games.length)return;
    const before=Date.parse(games[0].start.slice(0,10)+'T00:00:00Z');
    if(!Number.isFinite(before)||before<this.lastDay||games.some(g=>g.start.slice(0,10)!==games[0].start.slice(0,10)))throw Error('對手特徵日期順序無效');
    const ids=new Set<string>();
    for(const g of games){
      if(this.seen.has(g.id)||ids.has(g.id)||g.homeId===g.awayId||![g.homeGoals,g.awayGoals].every(v=>Number.isInteger(v)&&v>=0&&v<=30)||![g.homeXg,g.awayXg].every(v=>v===null||Number.isFinite(v)&&v>=0&&v<=20))throw Error('對手特徵賽果無效');
      ids.add(g.id);
    }
    this.lastDay=before;for(const id of ids)this.seen.add(id);
    const rows=this.rows.filter(g=>Date.parse(g.start)<before&&Date.parse(g.start)>=before-this.options.lookbackDays*DAY);
    let w=0,xw=0,goals=0,xg=0;
    for(const g of rows){const weight=Math.exp(-(before-Date.parse(g.start))/(this.options.decayDays*DAY));w+=2*weight;goals+=weight*(g.homeGoals+g.awayGoals);if(g.homeXg!==null&&g.awayXg!==null){xw+=2*weight;xg+=weight*(g.homeXg+g.awayXg);}}
    const meanG=w?goals/w:1.3,meanX=xw?xg/xw:meanG,prior=this.options.priorGames??5;
    const relative=(value:number,n:number,mean:number)=>clampRatio((value*n+mean*prior)/(n+prior)/Math.max(.1,mean));
    const prepared=games.map(g=>{
      const h=this.form(g.homeId,before,rows),a=this.form(g.awayId,before,rows);
      return {...g,adjusted:[g.homeGoals/relative(a.ga,a.games,meanG),g.awayGoals/relative(h.ga,h.games,meanG),g.homeXg===null?null:g.homeXg/relative(a.xa,a.xgGames,meanX),g.awayXg===null?null:g.awayXg/relative(h.xa,h.xgGames,meanX)] as Adjusted['adjusted']};
    });
    // Defending a strong attack is accounted for in the conceded form below.
    // Store both attack and defence adjustments separately in an auxiliary map.
    for(let k=0;k<prepared.length;k++){
      const g=prepared[k],h=this.form(g.homeId,before,rows),a=this.form(g.awayId,before,rows);
      this.defense.set(g.id,[g.awayGoals/relative(a.gf,a.games,meanG),g.homeGoals/relative(h.gf,h.games,meanG),g.awayXg===null?null:g.awayXg/relative(a.xf,a.xgGames,meanX),g.homeXg===null?null:g.homeXg/relative(h.xf,h.xgGames,meanX)]);
    }
    this.rows.push(...prepared);
  }
  private defense=new Map<string,[number,number,number|null,number|null]>();
  features(homeId:string,awayId:string,before:number){
    const adjustedForm=(id:string)=>{
      const f=this.form(id,before),selected=this.rows.filter(g=>(g.homeId===id||g.awayId===id)&&Date.parse(g.start)<before&&Date.parse(g.start)>=before-this.options.lookbackDays*DAY).slice(-20);let w=0,xw=0,ga=0,xa=0;
      for(const g of selected){const d=this.defense.get(g.id)!;const h=g.homeId===id,weight=Math.exp(-(before-Date.parse(g.start))/(this.options.decayDays*DAY));w+=weight;ga+=weight*d[h?0:1];if(g.homeXg!==null&&g.awayXg!==null){xw+=weight;xa+=weight*d[h?2:3]!;}}
      return {...f,aga:w?ga/w:0,axa:xw?xa/xw:0};
    };
    const home=adjustedForm(homeId),away=adjustedForm(awayId),log=(x:number,y:number)=>Math.log((x+.1)/(y+.1));
    const attack=(f:Form)=>[log(f.agf,f.gf),log(f.axf,f.agf)],defense=(f:Form)=>[log(f.aga,f.ga),log(f.axa,f.aga)];
    const h=attack(home),a=attack(away),hd=defense(home),ad=defense(away);
    const values=[[h[0],ad[0],h[1],ad[1]],[a[0],hd[0],a[1],hd[1]]];
    const enough=[home,away].every(f=>f.games>=5&&f.xgGames>=5&&f.xgGames>=f.games*.8&&before-f.latest<=120*DAY)&&values.flat().every(Number.isFinite);
    return {home,away,values,enough};
  }
}
export type OpponentCorrection={decayDays:number;lookbackDays:number;blend:number;coefficients:number[];tilts:number[]};
export type FootballBaseRates={home:number;away:number;rho?:number;overTilt?:number;bttsTilt?:number;drawTilt?:number};
export function opponentCorrectedDistribution(rates:FootballBaseRates,features:number[][],p:OpponentCorrection,neutral=false){
  if(p.coefficients.length!==6||p.tilts.length!==3||features.length!==2||features.some(f=>f.length!==4))throw Error('對手xG模型格式無效');
  if(![rates.home,rates.away].every(v=>Number.isFinite(v)&&v>0)||![...p.coefficients,...p.tilts,...features.flat(),p.blend,rates.rho??0,rates.overTilt??0,rates.bttsTilt??0,rates.drawTilt??0].every(Number.isFinite)||p.blend<0||p.blend>1)throw Error('對手xG模型數值無效');
  const b=p.coefficients,intercept=neutral?(b[0]+b[1])/2:null;
  const predict=(side:number,rate:number)=>Math.max(.15,Math.min(5,rate*Math.exp(p.blend*((intercept??b[side])+features[side].reduce((s,x,i)=>s+x*b[i+2],0)))));
  return marketFootballDistribution({home:predict(0,rates.home),away:predict(1,rates.away),rho:rates.rho??0,overTilt:(rates.overTilt??0)+p.blend*p.tilts[0],bttsTilt:(rates.bttsTilt??0)+p.blend*p.tilts[1],drawTilt:(rates.drawTilt??0)+p.blend*p.tilts[2]});
}
