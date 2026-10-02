import json, numpy as np, hashlib
from pathlib import Path
from scipy.optimize import minimize
from scipy.special import gammaln
root=Path(__file__).parent
I,J=np.meshgrid(np.arange(26),np.arange(26),indexing='ij');i=I.ravel();j=J.ravel();F=np.stack([i+j>2,(i>0)&(j>0),i==j],axis=1).astype(float);fac=gammaln(i+1)+gammaln(j+1)
def dist(r,t):
 log=-r[:,0,None]-r[:,1,None]+np.log(r[:,0,None])*i+np.log(r[:,1,None])*j-fac+F@t
 log-=log.max(axis=1,keepdims=True);p=np.exp(log);p/=p.sum(axis=1,keepdims=True)
 return p

def metrics(p,y):
 out=np.stack([p[:,i>j].sum(1),p[:,i==j].sum(1),p[:,i<j].sum(1)],1);lab=np.where(y[:,0]>y[:,1],0,np.where(y[:,0]==y[:,1],1,2));one=np.eye(3)[lab]
 ov=p[:,i+j>2].sum(1);bt=p[:,(i>0)&(j>0)].sum(1)
 return dict(n=len(y),logLoss=float(-np.log(out[np.arange(len(y)),lab]).mean()),brier=float(((out-one)**2).sum(1).mean()),over25Brier=float(((ov-(y.sum(1)>2))**2).mean()),bttsBrier=float(((bt-(y.min(1)>0))**2).mean()))
def oldmetrics(rows,y):
 out=np.array([[x['old']['probabilities'][k] for k in ['home','draw','away','over25','btts']] for x in rows]);lab=np.where(y[:,0]>y[:,1],0,np.where(y[:,0]==y[:,1],1,2));return dict(n=len(y),logLoss=float(-np.log(out[np.arange(len(y)),lab]).mean()),brier=float(((out[:,:3]-np.eye(3)[lab])**2).sum(1).mean()),over25Brier=float(((out[:,3]-(y.sum(1)>2))**2).mean()),bttsBrier=float(((out[:,4]-(y.min(1)>0))**2).mean()))
def passes(a,b):return a['logLoss']<b['logLoss'] and a['brier']<=b['brier'] and all(a[k]<=b[k]+.002 for k in ['over25Brier','bttsBrier'])
allresults={}
for league in ['eng.1','esp.1','ger.1','ita.1','fra.1']:
 rows=json.loads((root/(league+'-features.json')).read_text());years=np.array([int(x['start'][:4]) for x in rows]);y=np.array([x['goals'] for x in rows]);train=np.isin(years,[2015,2016,2017,2018]);sel=np.isin(years,[2021,2022]);splits={'selection':sel,'holdout':np.isin(years,[2023,2024]),'audit2025':years==2025,'audit2026':years==2026};base={k:oldmetrics([r for r,m in zip(rows,mask) if m],y[mask]) for k,mask in splits.items()};candidates=[]
 for fi,decay in enumerate([90,180]):
  x=np.array([r['features'][fi] for r in rows]);a=np.zeros((len(x),2,7));a[:,0,0]=1;a[:,1,1]=1
  a[:,0,2:]=np.stack([np.log(x[:,0]+.1),np.log(x[:,3]+.1),np.log(x[:,4]+.1),np.log(x[:,7]+.1),x[:,8]],1);a[:,1,2:]=np.stack([np.log(x[:,2]+.1),np.log(x[:,1]+.1),np.log(x[:,6]+.1),np.log(x[:,5]+.1),-x[:,8]],1)
  # no neutral domestic rows in this archive; runtime uses the average intercept for neutral sites
  for ridge in [.01,.1]:
   at=a[train];yt=y[train]
   def loss(b):
    z=at@b;r=np.exp(z);return float((r-yt*z).mean()+ridge*(b[2:]**2).sum()),np.einsum('nsi,ns->i',at,r-yt)/(yt.size)+np.r_[0,0,2*ridge*b[2:]]
   opt=minimize(loss,np.array([0.,-.2,.1,.1,.4,.3,.5]),jac=True,method='L-BFGS-B',bounds=[(-1,1),(-1,1)]+[(0,2)]*5);b=opt.x;raw=np.clip(np.exp(a@b),.15,5)
   # Tune three score-grid tilts on training only, shared by every market.
   rt=raw[train];p0=dist(rt,np.zeros(3));ft=np.stack([yt.sum(1)>2,yt.min(1)>0,yt[:,0]==yt[:,1]],1).mean(0)
   def tl(t):
    weights=np.exp(F@t);z=p0@weights;pp=p0*weights/z[:,None];return float(np.log(z).mean()-ft@t+.01*(t*t).sum()),(pp@F).mean(0)-ft+.02*t
   t=minimize(tl,np.zeros(3),jac=True,bounds=[(-.5,.5)]*3,method='L-BFGS-B').x
   # Blend against the existing raw form baseline, not against target-specific output.
   bx=np.array([r.get('baseline',r['features'][0]) for r in rows]);br=np.clip(np.stack([(bx[:,0]+bx[:,3])/2,(bx[:,2]+bx[:,1])/2],1),.15,5)
   for blend in [.25,.5,.75,1]:
    rates=blend*raw+(1-blend)*br;tilts=t*blend;m=metrics(dist(rates[sel],tilts),y[sel]);params=dict(decayDays=decay,venueWeight=0,blend=blend,homeIntercept=b[0],awayIntercept=b[1],goalAttack=b[2],goalDefense=b[3],xgAttack=b[4],xgDefense=b[5],elo=b[6],rho=0,usesXg=True,overTilt=t[0],bttsTilt=t[1],drawTilt=t[2]);candidates.append(dict(parameters=params,ridge=ridge,selection=m,eligible=passes(m,base['selection']),converged=bool(opt.success)))
 eligible=[c for c in candidates if c['eligible'] and c['converged']];winner=min(eligible or candidates,key=lambda c:c['selection']['logLoss']);(root/(league+'-selection.json')).write_text(json.dumps({'candidates':candidates,'winner':winner},indent=2))
 # Only now evaluate the frozen winner on holdout/audits.
 p=winner['parameters'];x=np.array([r['features'][[90,180].index(p['decayDays'])] for r in rows]);b=np.array([p[k] for k in ['homeIntercept','awayIntercept','goalAttack','goalDefense','xgAttack','xgDefense','elo']]);raw=np.clip(np.exp(np.stack([b[0]+b[2]*np.log(x[:,0]+.1)+b[3]*np.log(x[:,3]+.1)+b[4]*np.log(x[:,4]+.1)+b[5]*np.log(x[:,7]+.1)+b[6]*x[:,8],b[1]+b[2]*np.log(x[:,2]+.1)+b[3]*np.log(x[:,1]+.1)+b[4]*np.log(x[:,6]+.1)+b[5]*np.log(x[:,5]+.1)-b[6]*x[:,8]],1)),.15,5);bx=np.array([r.get('baseline',r['features'][0]) for r in rows]);br=np.clip(np.stack([(bx[:,0]+bx[:,3])/2,(bx[:,2]+bx[:,1])/2],1),.15,5);rates=p['blend']*raw+(1-p['blend'])*br;tilts=np.array([p[k] for k in ['overTilt','bttsTilt','drawTilt']])*p['blend'];evaluation={k:{'baseline':base[k],'candidate':metrics(dist(rates[mask],tilts),y[mask])} for k,mask in splits.items()};reasons=[k+'_gate_failed' for k,m in evaluation.items() if not passes(m['candidate'],m['baseline'])];
 if not winner['converged']:reasons.append('fit_not_converged')
 for k,minimum in [('selection',80),('holdout',160),('audit2025',60),('audit2026',60)]:
  if base[k]['n']<minimum:reasons.append(k+'_sample_small')
 entry=dict(enabled=not reasons,reasons=reasons,parameters=p,sampleSizes={'training':int(train.sum()),**{k:int(mask.sum()) for k,mask in splits.items()}},metrics=evaluation);allresults[league]=entry;(root/'evaluation.json').write_text(json.dumps(allresults,indent=2));print(league,entry['enabled'],reasons,flush=True)
