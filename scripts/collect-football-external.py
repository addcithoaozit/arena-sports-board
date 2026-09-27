"""Capture public external match data; retain request hashes and cutoff.

Understat endpoint is the GET used by its public league page's league.min.js.
Only factual match results/xG are retained, not its predicted probabilities.
OpenFootball is pinned to a CC0 repository revision. No Football-Data CSVs
are used: that provider's current terms exclude this automated product use.
"""
import concurrent.futures,datetime,gzip,hashlib,json,pathlib,urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1]
RAW=ROOT/'.football-research/external-raw';RAW.mkdir(parents=True,exist_ok=True)
LEAGUES={'eng.1':'EPL','esp.1':'La_liga','ita.1':'Serie_A','ger.1':'Bundesliga','fra.1':'Ligue_1'}
REVISION='abfaeddc2ee3d14f99ecc163c9ddb46cb4d67cef'
CUTOFF=datetime.datetime.now(datetime.timezone.utc).isoformat()

def get(item):
 provider,league,season=item
 if provider=='understat':
  slug=LEAGUES[league];url=f'https://understat.com/getLeagueData/{slug}/{season}'
  headers={'X-Requested-With':'XMLHttpRequest','Referer':f'https://understat.com/league/{slug}/{season}'}
  path=RAW/f'understat-{league}-{season}.json'
 else:
  url=f'https://raw.githubusercontent.com/openfootball/champions-league/{REVISION}/{season}-{str(season+1)[-2:]}/cl.txt'
  headers={};path=RAW/f'openfootball-cl-{season}.txt'
 if not path.exists():
  with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=40) as response:raw=response.read()
  if raw[:2]==b'\x1f\x8b':raw=gzip.decompress(raw)
  if provider=='understat':
   d=json.loads(raw)
   if not isinstance(d.get('dates'),list) or not d['dates']:raise ValueError(f'Empty match collection {url}')
  path.write_bytes(raw)
 raw=path.read_bytes()
 record={'provider':provider,'league':league,'season':season,'url':url,'sha256':hashlib.sha256(raw).hexdigest(),'capturedAt':datetime.datetime.fromtimestamp(path.stat().st_mtime,datetime.timezone.utc).isoformat(),'path':str(path.relative_to(ROOT))}
 if provider=='understat':
  d=json.loads(raw);record['events']=len(d['dates'])
 print(json.dumps({k:record[k] for k in ['provider','league','season']}),flush=True)
 return record

if __name__=='__main__':
 jobs=[('understat',league,year) for league in LEAGUES for year in range(2014,2027)]+[('openfootball','uefa.champions',year) for year in range(2011,2026)]
 results=[];errors=[]
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
  future={pool.submit(get,j):j for j in jobs}
  for f in concurrent.futures.as_completed(future):
   try:results.append(f.result())
   except Exception as e:errors.append({'job':future[f],'error':str(e)});print(json.dumps(errors[-1]),flush=True)
 (RAW.parent/'external-sources.json').write_text(json.dumps({'cutoff':CUTOFF,'openfootballRevision':REVISION,'sources':results,'errors':errors},indent=2)+'\n')
 print(json.dumps({'collected':len(results),'failed':len(errors)}),flush=True)
 if errors:raise SystemExit(1)
