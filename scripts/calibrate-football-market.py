"""Two-stage selection and one-time blind audit for the frozen DE/IT v4 study."""
import datetime,hashlib,json,pathlib,sys
import numpy as np
from scipy.optimize import minimize
from scipy.special import gammaln
from scipy.stats import poisson,skellam
ROOT=pathlib.Path(__file__).resolve().parents[1]
data=json.loads((ROOT/'.football-research/market-features.json').read_text());protocol=json.loads((ROOT/'docs/football-market-protocol.json').read_text())
phash=hashlib.sha256((ROOT/'docs/football-market-protocol.json').read_bytes()).hexdigest()
KEYS=['homeIntercept','awayIntercept','goalAttack','goalDefense','elo','rho','overTilt','bttsTilt','drawTilt']
def rates(t,x,baseline,blend=1):
 ih,ia,ga,gd,elo,rho,ot,bt,dt=t;n=x[:,5]>0;lh=np.where(n,(x[:,6]+x[:,7])/2,x[:,6]);la=np.where(n,(x[:,6]+x[:,7])/2,x[:,7])
 h=np.clip(lh*np.exp(np.where(n,(ih+ia)/2,ih)+ga*x[:,0]+gd*x[:,3]+elo*x[:,4]),.15,5)
 a=np.clip(la*np.exp(np.where(n,(ih+ia)/2,ia)+ga*x[:,2]+gd*x[:,1]-elo*x[:,4]),.15,5)
 return blend*h+(1-blend)*baseline[:,0],blend*a+(1-blend)*baseline[:,1],rho*blend,ot*blend,bt*blend,dt*blend
def probabilities(h,a,r,ot=0,bt=0,dt=0):
 r=np.clip(r,-np.minimum(1/h,1/a)+1e-6,np.minimum(1-1e-6,1/(h*a)-1e-6));e=np.exp(-h-a);q=e*h*a*r
 wh=skellam.sf(0,h,a)+q;draw=skellam.pmf(0,h,a)-2*q;wa=skellam.cdf(-1,h,a)+q
 p00=e*(1-h*a*r);p11=e*h*a*(1-r);uh=e*(h+h*h/2)+q;ua=e*(a+a*a/2)+q
 oh=np.exp(-a)*poisson.sf(2,h);oa=np.exp(-h)*poisson.sf(2,a);bd=np.maximum(0,draw-p00-p11);bh=np.maximum(0,wh-uh-oh);ba=np.maximum(0,wa-ua-oa)
 eo=np.exp(ot);ebd=np.exp(bt+dt);ed=np.exp(dt);eob=np.exp(ot+bt);eobd=np.exp(ot+bt+dt)
 hh=uh+oh*eo+bh*eob;aa=ua+oa*eo+ba*eob;dd=p00*ed+p11*ebd+bd*eobd;z=hh+aa+dd
 return np.column_stack([hh,dd,aa])/z[:,None],((oh+oa)*eo+(bh+ba)*eob+bd*eobd)/z,(p11*ebd+(bh+ba)*eob+bd*eobd)/z,z,r

def arrays(rows,index):return np.array([r['variants'][index] for r in rows]),np.array([r['baseline'] for r in rows]),np.array([r['homeScore'] for r in rows]),np.array([r['awayScore'] for r in rows])
def fit(rows,index,regularization,tilts):
 x,base,hg,ag=arrays(rows,index);yover=hg+ag>2;ybtts=(hg>0)&(ag>0);ydraw=hg==ag
 def objective(t):
  h,a,r,ot,bt,dt=rates(t,x,base);z=np.ones(len(x));r=np.clip(r,-np.minimum(1/h,1/a)+1e-6,np.minimum(1-1e-6,1/(h*a)-1e-6))
  if tilts:_,_,_,z,r=probabilities(h,a,r,ot,bt,dt)
  tau=np.ones(len(x))
  for mask,value in [((hg==0)&(ag==0),1-h*a*r),((hg==0)&(ag==1),1+h*r),((hg==1)&(ag==0),1+a*r),((hg==1)&(ag==1),1-r)]:tau[mask]=value[mask]
  loss=h-hg*np.log(h)+gammaln(hg+1)+a-ag*np.log(a)+gammaln(ag+1)-np.log(np.maximum(tau,1e-12))-ot*yover-bt*ybtts-dt*ydraw+np.log(z)
  return float(loss.mean()+regularization*np.square(t[2:5]).sum()+regularization*np.square(t[5:]).sum())
 bounds=[(-.6,.6),(-.6,.6),(0,1.5),(0,1.5),(0,1.5),(-.2,.2)]+([(-.75,.75)]*3 if tilts else [(0,0)]*3)
 result=minimize(objective,[0,0,.3,.3,.5,-.03,0,0,0],method='L-BFGS-B',bounds=bounds,options={'maxiter':400,'ftol':1e-10})
 if not result.success:raise RuntimeError(result.message)
 return result.x.tolist()
def evaluate(rows,index=1,t=None,blend=1):
 x,base,hg,ag=arrays(rows,index);r=(base[:,0],base[:,1],0,0,0,0) if t is None else rates(t,x,base,blend)
 p,over,btts,_,_=probabilities(*r);y=np.where(hg>ag,0,np.where(hg<ag,2,1));ll=-np.log(np.maximum(p[np.arange(len(rows)),y],1e-12))
 return {'n':len(rows),'logLoss':float(ll.mean()),'brier':float(((p-np.eye(3)[y])**2).sum(axis=1).mean()),'accuracy':float((p.argmax(axis=1)==y).mean()),'over25Brier':float(((over-(hg+ag>2))**2).mean()),'bttsBrier':float(((btts-((hg>0)&(ag>0)))**2).mean())},ll

def fails(b,c):
 result=[]
 if c['logLoss']>=b['logLoss']:result.append('logloss_not_improved')
 if c['brier']>b['brier']:result.append('brier_worse')
 for k in ['over25Brier','bttsBrier']:
  if c[k]-b[k]>.002:result.append(k+'_worse')
 return result

def bootstrap(rows,delta):
 groups={}
 for row,v in zip(rows,delta):groups.setdefault(datetime.datetime.fromisoformat(row['start'].replace('Z','+00:00')).strftime('%G-%V'),[]).append(float(v))
 stats=np.array([[sum(v),len(v)] for v in groups.values()]);rng=np.random.default_rng(20260928);draws=stats[rng.integers(0,len(stats),size=(1000,len(stats)))].sum(axis=1)
 return np.quantile(draws[:,0]/draws[:,1],[.025,.975]).tolist()

def split(league):
 rows=[r for r in data['rows'] if r['league']==league]
 return {name:[r for r in rows if start<=r['start']<end] for name,start,end in [('training','2005','2010'),('selection','2010','2012'),('holdout','2012','2014'),('audit2019','2019','2021'),('audit2025','2025','2026'),('audit2026','2026','2027')]}

if '--select' in sys.argv:
 selected={}
 for league in protocol['leagues']:
  splits=split(league);base=evaluate(splits['selection'])[0];candidates=[]
  for index,options in enumerate(data['options']):
   for reg in protocol['candidates']['regularization']:
    for tilts in protocol['candidates']['marketTilts']:
     t=fit(splits['training'],index,reg,tilts)
     for blend in protocol['candidates']['blend']:
      m=evaluate(splits['selection'],index,t,blend)[0];score=sum(m[k]/base[k] for k in ['logLoss','brier','over25Brier','bttsBrier'])
      candidates.append({'index':index,'regularization':reg,'marketTilts':tilts,'parameters':{**options,'blend':blend,**dict(zip(KEYS,t))},'selectionMetrics':m,'score':score,'reasons':fails(base,m)})
  eligible=[c for c in candidates if not c['reasons']];winner=min(eligible or candidates,key=lambda c:c['score']);selected[league]={'winner':winner,'candidates':candidates,'selectionBaseline':base}
  print(json.dumps({'league':league,'eligible':len(eligible),'candidates':len(candidates),'winner':winner,'base':base}),flush=True)
 out={'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceSha256':data['sourceSha256'],'protocolSha256':phash,'leagues':selected}
 (ROOT/'data/football/market-selection-20260928.json').write_text(json.dumps(out,indent=2)+'\n')
elif '--audit' in sys.argv:
 selection_path=ROOT/'data/football/market-selection-20260928.json';selection=json.loads(selection_path.read_text());assert selection['sourceSha256']==data['sourceSha256'] and selection['protocolSha256']==phash
 results={};parity=[]
 for league in protocol['leagues']:
  splits=split(league);winner=selection['leagues'][league]['winner'];p=winner['parameters'];t=[p[k] for k in KEYS];metrics={};reasons=[]
  for name,rows in splits.items():
   b,bll=evaluate(rows);c,cll=evaluate(rows,winner['index'],t,p['blend']);metrics[name]={'baseline':b,'candidate':c,'logLossChange':c['logLoss']-b['logLoss']}
   if name!='training':metrics[name]['logLossChangeCI95']=bootstrap(rows,cll-bll);reasons.extend(name+'_'+v for v in fails(b,c))
   minimum=180 if name=='training' else 80 if name=='selection' else 160 if name=='holdout' else 60
   if len(rows)<minimum:reasons.append(name+'_sample_small')
  results[league]={'enabled':not reasons,'reasons':reasons,'parameters':p,'sampleSizes':{k:len(v) for k,v in splits.items()},'metrics':metrics}
  for row in [splits['holdout'][0],splits['holdout'][-1]]:
   x,base,_,_=arrays([row],winner['index']);r=rates(t,x,base,p['blend']);pr,ov,bt,_,_=probabilities(*r)
   rv=[float(v[0]) if hasattr(v,'__len__') else float(v) for v in r];h,a,rho,ot,bt_t,dt=rv;rho=float(np.clip(rho,-min(1/h,1/a)+1e-6,min(1-1e-6,1/(h*a)-1e-6)))
   grid=np.outer(poisson.pmf(np.arange(26),h),poisson.pmf(np.arange(26),a));grid[0,0]*=1-h*a*rho;grid[0,1]*=1+h*rho;grid[1,0]*=1+a*rho;grid[1,1]*=1-rho
   ii,jj=np.meshgrid(np.arange(26),np.arange(26),indexing='ij');grid*=np.exp(ot*(ii+jj>2)+bt_t*((ii>0)&(jj>0))+dt*(ii==jj));grid/=grid.sum()
   parity.append({'league':league,'input':x[0].tolist(),'baseline':base[0].tolist(),'parameters':p,'rates':dict(zip(['home','away','rho','overTilt','bttsTilt','drawTilt'],rv)),'expected':{'home':float((ii*grid).sum()),'away':float((jj*grid).sum())},'probabilities':dict(zip(['home','draw','away','over25','under25','btts'],[*pr[0].tolist(),float(ov[0]),float(1-ov[0]),float(bt[0])]))})
  print(json.dumps({'league':league,'enabled':not reasons,'reasons':reasons,'samples':results[league]['sampleSizes'],'changes':{k:{metric:round(v['candidate'][metric]-v['baseline'][metric],6) for metric in ['logLoss','brier','over25Brier','bttsBrier']} for k,v in metrics.items()}}),flush=True)
 created=datetime.datetime.now(datetime.timezone.utc);source=json.loads((ROOT/'data/football/market-history-20260928.json').read_text())
 artifact={'version':'football-market-v4-20260928','createdAt':created.isoformat(),'expiresAt':(created+datetime.timedelta(days=90)).isoformat(),'auditThrough':source['cutoff'],'sourceSha256':data['sourceSha256'],'protocolSha256':phash,'selectionSha256':hashlib.sha256(selection_path.read_bytes()).hexdigest(),'historyGames':len(source['games']),'replayedGames':len(data['rows']),'leagues':results,'protocol':protocol,'coverage':data['coverage']}
 (ROOT/'data/football/market-calibration-20260928.json').write_text(json.dumps(artifact,ensure_ascii=False,indent=2)+'\n')
 runtime={k:v for k,v in artifact.items() if k not in ['protocol','coverage']};(ROOT/'data/football/market-calibration-runtime.json').write_text(json.dumps(runtime,indent=2)+'\n')
 (ROOT/'tests/fixtures/football-market-parity.json').write_text(json.dumps(parity,indent=2)+'\n')
else:raise SystemExit('Choose --select (development only) or --audit (locked candidates).')
