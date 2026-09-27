"""Fit external-data candidates once under the frozen external protocol.

Never refit/tune after inspecting the new holdout or previously seen audits.
"""
import datetime,hashlib,json,pathlib
import numpy as np
from scipy.optimize import minimize
from scipy.special import gammaln
from scipy.stats import poisson,skellam
ROOT=pathlib.Path(__file__).resolve().parents[1]
data=json.loads((ROOT/'.football-research/external-features.json').read_text())
protocol=json.loads((ROOT/'docs/football-external-protocol.json').read_text())

def fitted_rates(theta,x):
 ih,ia,ga,gd,xa,xd,elo,rho=theta
 hi=np.where(x[:,9]>0,(ih+ia)/2,ih);ai=np.where(x[:,9]>0,(ih+ia)/2,ia)
 h=np.clip(np.exp(hi+ga*np.log(x[:,0]+.1)+gd*np.log(x[:,3]+.1)+xa*np.log(x[:,4]+.1)+xd*np.log(x[:,7]+.1)+elo*x[:,8]),.15,5)
 a=np.clip(np.exp(ai+ga*np.log(x[:,2]+.1)+gd*np.log(x[:,1]+.1)+xa*np.log(x[:,6]+.1)+xd*np.log(x[:,5]+.1)-elo*x[:,8]),.15,5)
 return h,a,np.full(len(x),rho)

def safe_rho(h,a,r):return np.clip(r,-np.minimum(1/h,1/a)+1e-6,np.minimum(1-1e-6,1/(h*a)-1e-6))
def probabilities(h,a,r):
 r=safe_rho(h,a,r);q=np.exp(-h-a)*h*a*r
 return np.column_stack([skellam.sf(0,h,a)+q,skellam.pmf(0,h,a)-2*q,skellam.cdf(-1,h,a)+q]),poisson.sf(2,h+a),(1-np.exp(-h))*(1-np.exp(-a))-q
def fit(rows,index,has_xg):
 x=np.array([r['variants'][index] for r in rows]);home=np.array([r['homeScore'] for r in rows]);away=np.array([r['awayScore'] for r in rows])
 def objective(theta):
  h,a,r=fitted_rates(theta,x);r=safe_rho(h,a,r);tau=np.ones(len(x))
  for mask,value in [((home==0)&(away==0),1-h*a*r),((home==0)&(away==1),1+h*r),((home==1)&(away==0),1+a*r),((home==1)&(away==1),1-r)]:tau[mask]=value[mask]
  nll=h-home*np.log(h)+gammaln(home+1)+a-away*np.log(a)+gammaln(away+1)-np.log(np.maximum(tau,1e-12))
  return float(nll.mean()+.01*np.square(theta[2:7]).sum()+.01*theta[7]**2)
 initial=[0,0,.3 if has_xg else .6,.3 if has_xg else .6,.3 if has_xg else 0,.3 if has_xg else 0,.1,-.05]
 bounds=[(-1,1),(-1,1),(0,1.5),(0,1.5),(0,1.5) if has_xg else (0,0),(0,1.5) if has_xg else (0,0),(0,1.5),(-.2,.2)]
 result=minimize(objective,initial,method='L-BFGS-B',bounds=bounds,options={'maxiter':600,'ftol':1e-11})
 if not result.success:raise RuntimeError(result.message)
 return result.x
def evaluate(rows,index=None,theta=None,blend=1):
 base=np.array([r['variants'][1] for r in rows]);bh=np.clip((base[:,0]+base[:,3])/2,.15,5);ba=np.clip((base[:,2]+base[:,1])/2,.15,5)
 if theta is None:
  h=bh.copy();a=ba.copy();rho=np.zeros(len(rows))
  for i,r in enumerate(rows):
   if r['deployed'] is not None:h[i],a[i],rho[i]=r['deployed']
 else:
  x=np.array([r['variants'][index] for r in rows]);h,a,rho=fitted_rates(theta,x);h=blend*h+(1-blend)*bh;a=blend*a+(1-blend)*ba;rho=rho*blend
 p,over,btts=probabilities(h,a,rho);home=np.array([r['homeScore'] for r in rows]);away=np.array([r['awayScore'] for r in rows]);y=np.where(home>away,0,np.where(home<away,2,1));one=np.eye(3)[y];ll=-np.log(np.maximum(p[np.arange(len(rows)),y],1e-12))
 metrics={'n':len(rows),'logLoss':float(ll.mean()),'brier':float(((p-one)**2).sum(axis=1).mean()),'accuracy':float((p.argmax(axis=1)==y).mean()),'over25Brier':float(((over-(home+away>2))**2).mean()),'bttsBrier':float(((btts-((home>0)&(away>0)))**2).mean())}
 return metrics,ll,(h,a,rho),(p,over,btts)
def bootstrap(rows,delta):
 groups={}
 for r,d in zip(rows,delta):
  key=datetime.datetime.fromisoformat(r['start'].replace('Z','+00:00')).strftime('%G-%V');groups.setdefault(key,[]).append(float(d))
 stats=np.array([[sum(v),len(v)] for v in groups.values()]);rng=np.random.default_rng(20260927);draws=stats[rng.integers(0,len(stats),size=(1000,len(stats)))].sum(axis=1)
 return [float(v) for v in np.quantile(draws[:,0]/draws[:,1],[.025,.975])]
def fails(base,candidate):
 reasons=[]
 if candidate['logLoss']>=base['logLoss']:reasons.append('logloss_not_improved')
 if candidate['brier']>base['brier']:reasons.append('brier_worse')
 for name in ['over25Brier','bttsBrier']:
  if candidate[name]-base[name]>.002:reasons.append(name+'_worse')
 return reasons

results={};parity=[]
for league in sorted({r['league'] for r in data['rows']}):
 has_xg=league!='uefa.champions';spec=protocol['xgExperiment' if has_xg else 'championsExpansion'];all_rows=[r for r in data['rows'] if r['league']==league]
 start='2015-01-01' if has_xg else '2012-01-01'
 splits={'training':[r for r in all_rows if start<=r['start']<'2017-01-01'],'selection':[r for r in all_rows if '2017-01-01'<=r['start']<'2019-01-01'],'holdout':[r for r in all_rows if '2019-01-01'<=r['start']<'2021-01-01'],'audit2025':[r for r in all_rows if '2025-01-01'<=r['start']<'2026-01-01'],'audit2026':[r for r in all_rows if r['start']>='2026-01-01']}
 candidates=[];base_selection=evaluate(splits['selection'])[0]
 if any(not s for s in splits.values()):raise ValueError('Empty split '+league)
 for index,option in enumerate(data['options']):
  theta=fit(splits['training'],index,has_xg)
  for blend in spec['candidates']['baselineBlend']:
   metric=evaluate(splits['selection'],index,theta,blend)[0]
   candidates.append({'option':option,'index':index,'theta':theta.tolist(),'blend':blend,'selectionMetrics':metric,'selectionReasons':fails(base_selection,metric)})
 eligible=[c for c in candidates if not c['selectionReasons']];winner=min(eligible or candidates,key=lambda c:c['selectionMetrics']['logLoss'])
 reports={};reasons=[]
 for name,rows in splits.items():
  b,bll,_,_=evaluate(rows);c,cll,_,_=evaluate(rows,winner['index'],winner['theta'],winner['blend']);reports[name]={'baseline':b,'candidate':c,'logLossChange':c['logLoss']-b['logLoss']}
  if name!='training':
   reasons.extend(name+'_'+r for r in fails(b,c));reports[name]['logLossChangeCI95']=bootstrap(rows,cll-bll)
 gate=spec['promotion']
 for name,minimum in [('training',gate['minimumTrainingGames']),('selection',gate['minimumSelectionGames']),('holdout',gate['minimumHoldoutGames']),('audit2025',gate['minimumAuditGames']),('audit2026',gate['minimumAuditGames'])]:
  if len(splits[name])<minimum:reasons.append(name+'_sample_small')
 parameters={**winner['option'],'blend':winner['blend'],**dict(zip(['homeIntercept','awayIntercept','goalAttack','goalDefense','xgAttack','xgDefense','elo','rho'],winner['theta'])),'usesXg':has_xg}
 results[league]={'enabled':not reasons,'reasons':reasons,'parameters':parameters,'sampleSizes':{k:len(v) for k,v in splits.items()},'metrics':reports,'selectionCandidates':candidates}
 for row in splits['holdout'][:2]:
  _,_,rates,preds=evaluate([row],winner['index'],winner['theta'],winner['blend']);p,over,btts=preds
  parity.append({'league':league,'input':row['variants'][winner['index']],'baselineInput':row['variants'][1],'parameters':parameters,'expected':{'home':float(rates[0][0]),'away':float(rates[1][0]),'rho':float(rates[2][0])},'probabilities':dict(zip(['home','draw','away','over25','under25','btts'],[float(v) for v in [*p[0],over[0],1-over[0],btts[0]]]))})
 print(json.dumps({'league':league,'enabled':not reasons,'reasons':reasons,'samples':results[league]['sampleSizes'],'logLossChanges':{k:round(v['logLossChange'],6) for k,v in reports.items()}}),flush=True)

created=datetime.datetime.now(datetime.timezone.utc);source=json.loads((ROOT/'data/football/external-history-20260927.json').read_text())
artifact={'version':'football-external-v3-20260927','createdAt':created.isoformat(),'expiresAt':(created+datetime.timedelta(days=90)).isoformat(),'sourceSha256':data['sourceSha256'],'auditThrough':source['cutoff'],'historyGames':len(source['games']),'replayedGames':len(data['rows']),'protocolSha256':hashlib.sha256((ROOT/'docs/football-external-protocol.json').read_bytes()).hexdigest(),'protocol':protocol,'coverage':data['coverage'],'leagues':results}
(ROOT/'data/football/external-calibration-20260927.json').write_text(json.dumps(artifact,ensure_ascii=False,indent=2)+'\n')
runtime={k:v for k,v in artifact.items() if k not in ['protocol','coverage','leagues']};runtime['leagues']={league:{k:v for k,v in entry.items() if k!='selectionCandidates'} for league,entry in results.items()}
(ROOT/'data/football/external-calibration-runtime.json').write_text(json.dumps(runtime,ensure_ascii=False,indent=2)+'\n')
(ROOT/'tests/fixtures/football-external-parity.json').write_text(json.dumps(parity,indent=2)+'\n')
