import argparse, json, hashlib
from pathlib import Path
import numpy as np
from scipy.optimize import minimize
from scipy.special import gammaln

ROOT=Path(__file__).parent
PROTOCOL=ROOT.parent/'docs/football-xg-opponent-v6-protocol.json'
I,J=np.meshgrid(np.arange(26),np.arange(26),indexing='ij');i=I.ravel();j=J.ravel()
F=np.stack([i+j>2,(i>0)&(j>0),i==j],1).astype(float);fac=gammaln(i+1)+gammaln(j+1)

def grid(r,tilts,rho):
 h,a=r[:,0],r[:,1];rho=np.maximum(-np.minimum(1/h,1/a)+1e-6,np.minimum(np.minimum(1-1e-6,1/(h*a)-1e-6),rho))
 log=-h[:,None]-a[:,None]+np.log(h[:,None])*i+np.log(a[:,None])*j-fac+tilts@F.T
 for x,y,tau in [(0,0,1-h*a*rho),(0,1,1+h*rho),(1,0,1+a*rho),(1,1,1-rho)]:log[:,(i==x)&(j==y)]+=np.log(tau[:,None])
 log-=log.max(1,keepdims=True);p=np.exp(log);return p/p.sum(1,keepdims=True)

def metrics(p,y):
 out=np.stack([p[:,i>j].sum(1),p[:,i==j].sum(1),p[:,i<j].sum(1)],1)
 lab=np.where(y[:,0]>y[:,1],0,np.where(y[:,0]==y[:,1],1,2));ov=p[:,i+j>2].sum(1);bt=p[:,(i>0)&(j>0)].sum(1)
 return dict(n=len(y),logLoss=float(-np.log(out[np.arange(len(y)),lab]).mean()),brier=float(((out-np.eye(3)[lab])**2).sum(1).mean()),over25Brier=float(((ov-(y.sum(1)>2))**2).mean()),bttsBrier=float(((bt-(y.min(1)>0))**2).mean()))

def baseline(rows,y):
 out=np.array([[r['old']['probabilities'][k] for k in ['home','draw','away','over25','btts']] for r in rows]);lab=np.where(y[:,0]>y[:,1],0,np.where(y[:,0]==y[:,1],1,2))
 return dict(n=len(y),logLoss=float(-np.log(out[np.arange(len(y)),lab]).mean()),brier=float(((out[:,:3]-np.eye(3)[lab])**2).sum(1).mean()),over25Brier=float(((out[:,3]-(y.sum(1)>2))**2).mean()),bttsBrier=float(((out[:,4]-(y.min(1)>0))**2).mean()))

def passes(a,b):
 return a['logLoss']<b['logLoss'] and a['brier']<=b['brier'] and all(a[k]<=b[k]+.002 for k in ['over25Brier','bttsBrier'])

def run(league,output):
 output.mkdir(parents=True,exist_ok=True)
 if any((output/(league+suffix)).exists() for suffix in ["-selection.json","-evaluation.json"]):raise ValueError("Refusing to overwrite a frozen evaluation; choose a new output directory")
 protocol=json.loads(PROTOCOL.read_text());rows=json.loads((ROOT/(league+'-features.json')).read_text());dates=np.array([r['start'][:10] for r in rows]);y=np.array([r['goals'] for r in rows]);years=np.array([int(d[:4]) for d in dates])
 kind='champions' if league=='uefa.champions' else 'nations' if league=='uefa.nations' else 'domestic';config=protocol['splits'][kind]
 def mask(bounds):
  return (dates>=bounds[0])&(dates<bounds[1]) if isinstance(bounds[0],str) else (years>=bounds[0])&(years<=bounds[1])
 training=mask(config['training']);splits={k:mask(v) for k,v in config.items() if k not in ['training','minimumSamples']}
 sizes={'training':int(training.sum()),**{k:int(v.sum()) for k,v in splits.items()}}
 if any(n==0 for n in sizes.values()):
  result={'enabled':False,'reasons':['empty_split'],'sampleSizes':sizes};(output/(league+'-evaluation.json')).write_text(json.dumps(result,indent=2));print(league,result,flush=True);return
 old={k:baseline([r for r,m in zip(rows,v) if m],y[v]) for k,v in splits.items()}
 r0=np.array([[r['old']['rates'][k] for k in ['home','away']] for r in rows]);rho=np.array([r['old']['rates'].get('rho',0) for r in rows]);t0=np.array([[r['old']['rates'].get(k,0) for k in ['overTilt','bttsTilt','drawTilt']] for r in rows]);candidates=[]
 for fi,decay in enumerate(protocol['candidateGrid']['decayDays']):
  x=np.array([r['features'][fi] for r in rows]);design=np.zeros((len(rows),2,6));design[:,0,0]=1;design[:,1,1]=1
  neutral=np.array([r.get('neutral',False) for r in rows]);design[neutral,:,:2]=.5;design[:,:,2:]=x
  at=design[training];yt=y[training];off=np.log(r0[training])
  for ridge in protocol['candidateGrid']['ridge']:
   def loss(b):
    z=off+at@b;mu=np.exp(z)
    return float((mu-yt*z).mean()+ridge*(b[2:]**2).sum()),np.einsum('nsi,ns->i',at,mu-yt)/yt.size+np.r_[0,0,2*ridge*b[2:]]
   fitted=minimize(loss,np.zeros(6),jac=True,method='L-BFGS-B',bounds=[(-.3,.3)]*2+[(0,1)]*4)
   b=fitted.x;corrected=np.clip(r0*np.exp(design@b),.15,5);p0=grid(corrected[training],t0[training],rho[training]);target=np.stack([yt.sum(1)>2,yt.min(1)>0,yt[:,0]==yt[:,1]],1).mean(0)
   def tilt_loss(t):
    weights=np.exp(F@t);z=p0@weights;pp=p0*weights/z[:,None]
    return float(np.log(z).mean()-target@t+.1*(t*t).sum()),(pp@F).mean(0)-target+.2*t
   tilt=minimize(tilt_loss,np.zeros(3),jac=True,method='L-BFGS-B',bounds=[(-.2,.2)]*3)
   for blend in protocol['candidateGrid']['blend']:
    rates=np.clip(r0*np.exp(blend*(design@b)),.15,5);pp=grid(rates[splits['selection']],t0[splits['selection']]+blend*tilt.x,rho[splits['selection']]);score=metrics(pp,y[splits['selection']])
    candidates.append({'parameters':{'decayDays':decay,'lookbackDays':730 if kind=='nations' else 365,'blend':blend,'coefficients':b.tolist(),'tilts':tilt.x.tolist()},'ridge':ridge,'converged':bool(fitted.success and tilt.success),'selection':score,'eligible':bool(passes(score,old['selection']) and b[4]+b[5]>1e-6)})
 eligible=[c for c in candidates if c['eligible'] and c['converged']]
 winner=min(eligible or candidates,key=lambda c:c['selection']['logLoss'])
 frozen={'protocolSha256':hashlib.sha256(PROTOCOL.read_bytes()).hexdigest(),'candidates':candidates,'winner':winner}
 selection_path=output/(league+'-selection.json');selection_path.write_text(json.dumps(frozen,indent=2))
 # No later split is consulted until the selected candidate has been persisted.
 p=winner['parameters'];fi=protocol['candidateGrid']['decayDays'].index(p['decayDays']);x=np.array([r['features'][fi] for r in rows]);design=np.zeros((len(rows),2,6));design[:,0,0]=1;design[:,1,1]=1;design[neutral,:,:2]=.5;design[:,:,2:]=x
 rates=np.clip(r0*np.exp(p['blend']*(design@np.array(p['coefficients']))),.15,5);tilts=t0+p['blend']*np.array(p['tilts'])
 evaluation={k:{'baseline':old[k],'candidate':metrics(grid(rates[v],tilts[v],rho[v]),y[v])} for k,v in splits.items()}
 reasons=[k+'_gate_failed' for k,m in evaluation.items() if not passes(m['candidate'],m['baseline'])]
 reasons.extend(k+'_sample_small' for k,n in config['minimumSamples'].items() if sizes.get(k,0)<n)
 if not winner['eligible']:reasons.append('no_selection_eligible_candidate')
 if not winner['converged']:reasons.append('fit_not_converged')
 result={'enabled':not reasons,'reasons':reasons,'parameters':p,'sampleSizes':sizes,'metrics':evaluation,'protocolSha256':frozen['protocolSha256'],'selectionSha256':hashlib.sha256(selection_path.read_bytes()).hexdigest()}
 (output/(league+'-evaluation.json')).write_text(json.dumps(result,indent=2));print(league,result['enabled'],sizes,reasons,flush=True)
 for key,m in evaluation.items():print(key,{k:round(m['candidate'][k]-m['baseline'][k],6) for k in ['logLoss','brier','over25Brier','bttsBrier']},flush=True)

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('leagues',nargs='+');parser.add_argument('--output-dir',type=Path,default=ROOT);args=parser.parse_args()
 for league in args.leagues:run(league,args.output_dir)
