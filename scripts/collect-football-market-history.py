"""Capture regular league scoreboard history; report coverage, never test metrics."""
import concurrent.futures,datetime,hashlib,json,pathlib,urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1];RAW=ROOT/'.football-research/market-raw';RAW.mkdir(parents=True,exist_ok=True)
cutoff=datetime.datetime.now(datetime.timezone.utc).isoformat()
def get(job):
 league,year=job;p=RAW/f'{league}-{year}.json';probe=ROOT/'.football-research/v4-probe'/p.name
 url=f'https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/scoreboard?dates={year}&limit=1000'
 if not p.exists():
  raw=probe.read_bytes() if probe.exists() else urllib.request.urlopen(url,timeout=35).read();p.write_bytes(raw)
 raw=p.read_bytes();d=json.loads(raw)
 if not isinstance(d.get('events'),list) or len(d['events'])>=1000 or not any(l.get('slug')==league for l in d.get('leagues',[])):raise ValueError('Incomplete or wrong league feed '+url)
 return {'league':league,'year':year,'url':url,'path':str(p.relative_to(ROOT)),'sha256':hashlib.sha256(raw).hexdigest(),'capturedAt':datetime.datetime.fromtimestamp(p.stat().st_mtime,datetime.timezone.utc).isoformat(),'events':len(d['events'])}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:sources=list(pool.map(get,[(l,y) for l in ['ger.1','ita.1'] for y in range(2004,2027)]))
(ROOT/'.football-research/market-sources.json').write_text(json.dumps({'cutoff':cutoff,'sources':sources},indent=2)+'\n');print(json.dumps({'sources':len(sources),'events':sum(s['events'] for s in sources)}))
