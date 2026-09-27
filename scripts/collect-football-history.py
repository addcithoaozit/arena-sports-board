"""Download public ESPN calendar-year scoreboards for reproducible backtests.

Raw responses are temporary. The committed normalized dataset records source
URLs, SHA-256 hashes, capture time and rejection counts; normalization uses the
same TypeScript parser as production (scripts/normalize-football-history.mjs).
"""
import concurrent.futures, datetime, hashlib, json, pathlib, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
RAW = ROOT / '.football-research' / 'raw'
RAW.mkdir(parents=True, exist_ok=True)
LEAGUES = ['eng.1', 'esp.1', 'ita.1', 'ger.1', 'fra.1', 'uefa.champions']

def capture(pair):
    league, year = pair
    path = RAW / f'{league}-{year}.json'
    url = f'https://site.api.espn.com/apis/site/v2/sports/soccer/{league}/scoreboard?dates={year}&limit=1000'
    if path.exists():
        body = path.read_bytes()
    else:
        with urllib.request.urlopen(url, timeout=45) as response:
            body = response.read()
        data = json.loads(body)
        if not isinstance(data.get('events'), list) or not data['events']:
            raise ValueError(f'Empty or invalid source: {url}')
        if len(data['events']) >= 1000:
            raise ValueError(f'Potential source truncation: {url}')
        path.write_bytes(body)
    data = json.loads(body)
    record = dict(league=league,year=year,url=url,path=str(path.relative_to(ROOT)),sha256=hashlib.sha256(body).hexdigest(),events=len(data['events']),capturedAt=datetime.datetime.fromtimestamp(path.stat().st_mtime, datetime.timezone.utc).isoformat())
    print(json.dumps({k:record[k] for k in ['league','year','events']}), flush=True)
    return record

if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        sources = list(pool.map(capture, [(l,y) for l in LEAGUES for y in range(2021,2027)]))
    (RAW.parent/'sources.json').write_text(json.dumps(sources, indent=2))
