"""Fit/select once under docs/football-calibration-protocol.json, then audit.

Uses ESPN scores only. No prices, lineups or future outcomes enter features.
Run node scripts/football-features.mjs first. scipy/numpy are research-only.
"""
import datetime, hashlib, json, pathlib
import numpy as np
from scipy.optimize import minimize
from scipy.special import gammaln
from scipy.stats import poisson, skellam

ROOT=pathlib.Path(__file__).resolve().parents[1]
data=json.loads((ROOT/'.football-research/features.json').read_text())
protocol=json.loads((ROOT/'docs/football-calibration-protocol.json').read_text())

def rates(theta,x):
    ih,ia,attack,defense,rho=theta
    ihv=np.where(x[:,4]>0,(ih+ia)/2,ih);iav=np.where(x[:,4]>0,(ih+ia)/2,ia)
    lh=np.clip(np.exp(ihv+attack*np.log(x[:,0]+.1)+defense*np.log(x[:,3]+.1)),.15,5)
    la=np.clip(np.exp(iav+attack*np.log(x[:,2]+.1)+defense*np.log(x[:,1]+.1)),.15,5)
    return lh,la,np.clip(np.full(len(lh),rho),-np.minimum(1/lh,1/la)+1e-6,np.minimum(1-1e-6,1/(lh*la)-1e-6))

def probabilities(lh,la,rho):
    # Dixon-Coles changes only 0:0, 0:1, 1:0, 1:1. Their total mass stays 1.
    q=np.exp(-lh-la)*lh*la*rho
    ph=skellam.sf(0,lh,la)+q
    pd=skellam.pmf(0,lh,la)-2*q
    pa=skellam.cdf(-1,lh,la)+q
    over=poisson.sf(2,lh+la)
    btts=(1-np.exp(-lh))*(1-np.exp(-la))-q
    return np.column_stack([ph,pd,pa]),over,btts

def fit(x,home,away):
    def objective(theta):
        lh,la,r=rates(theta,x)
        tau=np.ones(len(x))
        tau[(home==0)&(away==0)]=(1-lh*la*r)[(home==0)&(away==0)]
        tau[(home==0)&(away==1)]=(1+lh*r)[(home==0)&(away==1)]
        tau[(home==1)&(away==0)]=(1+la*r)[(home==1)&(away==0)]
        tau[(home==1)&(away==1)]=(1-r)[(home==1)&(away==1)]
        nll=lh-home*np.log(lh)+gammaln(home+1)+la-away*np.log(la)+gammaln(away+1)-np.log(np.maximum(tau,1e-12))
        penalty=.005*((theta[2]-.6)**2+(theta[3]-.6)**2)+.01*theta[4]**2
        return float(nll.mean()+penalty)
    result=minimize(objective,[-.05,-.05,.6,.6,-.05],method='L-BFGS-B',bounds=[(-1,1),(-1,1),(0,2),(0,2),(-.2,.2)],options={'maxiter':500,'ftol':1e-11})
    if not result.success:raise RuntimeError('Fit failed: '+result.message)
    return result.x

def metrics(pred,home,away):
    p,over,btts=pred;y=np.where(home>away,0,np.where(home<away,2,1));onehot=np.eye(3)[y]
    logloss=-np.log(np.maximum(p[np.arange(len(y)),y],1e-12))
    result={'n':len(y),'logLoss':float(logloss.mean()),'brier':float(((p-onehot)**2).sum(axis=1).mean()),'accuracy':float((p.argmax(axis=1)==y).mean()),'over25Brier':float(((over-(home+away>2))**2).mean()),'bttsBrier':float(((btts-((home>0)&(away>0)))**2).mean()),'meanDrawProbability':float(p[:,1].mean()),'observedDrawRate':float((y==1).mean())}
    bins=[]
    for outcome,label in enumerate(['home','draw','away']):
        for i in range(10):
            sel=(p[:,outcome]>=i/10)&(p[:,outcome]<(i+1)/10 if i<9 else p[:,outcome]<=1)
            n=int(sel.sum())
            if n:
                observed=float((y[sel]==outcome).mean());z=1.96;den=1+z*z/n;centre=(observed+z*z/(2*n))/den;half=z*np.sqrt(observed*(1-observed)/n+z*z/(4*n*n))/den
                bins.append({'outcome':label,'from':i/10,'to':(i+1)/10,'n':n,'predicted':float(p[sel,outcome].mean()),'observed':observed,'ci95':[float(centre-half),float(centre+half)]})
    result['reliability']=bins
    return result,logloss

def evaluate(rows,variant,theta):
    x=np.array([r['variants'][variant]+[int(r['neutral'])] for r in rows]);h=np.array([r['homeScore'] for r in rows]);a=np.array([r['awayScore'] for r in rows])
    if theta is None:lh=np.clip((x[:,0]+x[:,3])/2,.15,5);la=np.clip((x[:,2]+x[:,1])/2,.15,5);rho=np.zeros(len(x))
    else:lh,la,rho=rates(theta,x)
    p=probabilities(lh,la,rho);m,ll=metrics(p,h,a);return m,ll,p

def week_bootstrap(rows,deltas):
    groups={}
    for r,d in zip(rows,deltas):
        dt=datetime.datetime.fromisoformat(r['start'].replace('Z','+00:00'));key=dt.strftime('%G-%V');groups.setdefault(key,[]).append(float(d))
    stats=np.array([[sum(v),len(v)] for v in groups.values()]);rng=np.random.default_rng(20260927)
    draws=stats[rng.integers(0,len(stats),size=(1000,len(stats)))].sum(axis=1);quantiles=np.quantile(draws[:,0]/draws[:,1],[.025,.975])
    return [float(x) for x in quantiles]

results={};baseline_index=data['options'].index({'decayDays':90,'venueWeight':.6})
for league in sorted({r['league'] for r in data['rows']}):
    league_rows=[r for r in data['rows'] if r['league']==league]
    splits={'training':[r for r in league_rows if r['start']<'2024-01-01'],'selection':[r for r in league_rows if '2024-01-01'<=r['start']<'2025-01-01'],'holdout':[r for r in league_rows if '2025-01-01'<=r['start']<'2026-01-01'],'recent':[r for r in league_rows if r['start']>='2026-01-01']}
    candidates=[]
    for index,option in enumerate(data['options']):
        train=splits['training'];x=np.array([r['variants'][index]+[int(r['neutral'])] for r in train]);h=np.array([r['homeScore'] for r in train]);a=np.array([r['awayScore'] for r in train]);theta=fit(x,h,a)
        m,_,_=evaluate(splits['selection'],index,theta)
        candidates.append({'option':option,'index':index,'theta':theta.tolist(),'selectionLogLoss':m['logLoss']})
    winner=min(candidates,key=lambda c:c['selectionLogLoss']);index=winner['index'];theta=winner['theta']
    reports={};reasons=[]
    for name,rows in splits.items():
        baseline,bll,bp=evaluate(rows,baseline_index,None);candidate,cll,cp=evaluate(rows,index,theta)
        entry={'baseline':baseline,'candidate':candidate,'logLossChange':candidate['logLoss']-baseline['logLoss']}
        if name in ['holdout','recent']:entry['logLossChangeCI95']=week_bootstrap(rows,cll-bll)
        reports[name]=entry
    gate=protocol['promotionGate']
    for name,minimum in [('training',gate['minimumTrainingGames']),('selection',gate['minimumSelectionGames']),('holdout',gate['minimumHoldoutGames']),('recent',gate['minimumRecentGames'])]:
        if len(splits[name])<minimum:reasons.append(name+'_sample_small')
    for name in ['selection','holdout','recent']:
        if reports[name]['logLossChange']>=0:reasons.append(name+'_logloss_not_improved')
    for name in ['holdout','recent']:
        b=reports[name]['baseline'];c=reports[name]['candidate']
        if c['brier']>b['brier']:reasons.append(name+'_brier_worse')
        for metric in ['over25Brier','bttsBrier']:
            if c[metric]-b[metric]>gate['maximumBinaryBrierIncrease']:reasons.append(name+'_'+metric+'_worse')
    results[league]={'enabled':not reasons,'status':'validated' if not reasons else 'baseline_retained','reasons':reasons,'parameters':{'decayDays':winner['option']['decayDays'],'venueWeight':winner['option']['venueWeight'],'homeIntercept':theta[0],'awayIntercept':theta[1],'attack':theta[2],'defense':theta[3],'rho':theta[4]},'sampleSizes':{k:len(v) for k,v in splits.items()},'metrics':reports,'selectionCandidates':candidates}
    print(json.dumps({'league':league,'enabled':not reasons,'reason':reasons,'samples':results[league]['sampleSizes'],'changes':{k:round(v['logLossChange'],5) for k,v in reports.items()},'parameters':results[league]['parameters']}),flush=True)

artifact={'schema':1,'version':'football-calibrated-v2-20260927','createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceSha256':data['sourceSha256'],'protocolSha256':hashlib.sha256((ROOT/'docs/football-calibration-protocol.json').read_bytes()).hexdigest(),'protocol':protocol,'coverage':data['coverage'],'leagues':results,'limitations':['Retrospective scores captured in 2026 are not archived pregame feed snapshots.','No lineup, injury, xG, bookmaker odds or profit validation.','Chronological holdout improvement is not a guaranteed future win rate.','New Champions League entrants and promoted teams may still lack five valid same-competition results.']}
(ROOT/'data/football/calibration-20260927.json').write_text(json.dumps(artifact,ensure_ascii=False,indent=2)+'\n')

# Compact production metadata. Keep the large research report server-side.
runtime={'version':artifact['version'],'createdAt':artifact['createdAt'],'auditThrough':'2026-09-27T12:35:04Z','expiresAt':'2027-03-26T12:35:04Z','sourceSha256':artifact['sourceSha256'],'historyGames':sum(v['total'] for v in data['coverage'].values()),'replayedGames':len(data['rows']),'leagues':{}}
for league,r in results.items():
    metrics_out={k:{'baseline':{m:v['baseline'][m] for m in ['n','logLoss','brier','accuracy','over25Brier','bttsBrier']},'candidate':{m:v['candidate'][m] for m in ['n','logLoss','brier','accuracy','over25Brier','bttsBrier']},'logLossChangeCI95':v.get('logLossChangeCI95')} for k,v in r['metrics'].items() if k in ['holdout','recent']}
    runtime['leagues'][league]={k:r[k] for k in ['enabled','status','reasons','parameters','sampleSizes']}
    runtime['leagues'][league]['metrics']=metrics_out
(ROOT/'data/football/calibration-runtime.json').write_text(json.dumps(runtime,ensure_ascii=False,indent=2)+'\n')

parity=[]
for league,r in results.items():
    for row in [x for x in data['rows'] if x['league']==league and x['start']>='2025-01-01'][:2]:
        index=data['options'].index({'decayDays':r['parameters']['decayDays'],'venueWeight':r['parameters']['venueWeight']})
        x=np.array([row['variants'][index]+[int(row['neutral'])]]);theta=[r['parameters'][k] for k in ['homeIntercept','awayIntercept','attack','defense','rho']]
        lh,la,rho=rates(theta,x);p,over,btts=probabilities(lh,la,rho)
        parity.append({'league':league,'gameId':row['id'],'input':x[0].tolist(),'parameters':r['parameters'],'expected':{'home':float(lh[0]),'away':float(la[0])},'probabilities':dict(zip(['home','draw','away','over25','under25','btts'],[float(z) for z in [*p[0],over[0],1-over[0],btts[0]]]))})
(ROOT/'tests/fixtures/football-calibration-parity.json').write_text(json.dumps(parity,indent=2)+'\n')
