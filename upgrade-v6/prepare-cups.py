"""Rebuild offline inputs from committed compact public evidence; no network."""
import importlib.util,json
from pathlib import Path
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('cup_join',root/'scripts/football-fotmob/build_history.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
data={'teams':{},'games':[]}
for path in sorted((root/'data/football/cup-fixtures').glob('*.json')):
 d=json.loads(path.read_text());data['teams'].update(d['teams'])
 for g in d['games']:
  g.update(season=int(g['start'][:4]),timeConfirmed=True,statusLabel=g['statusName'],venue='',sourceUrl='https://www.espn.com/soccer/match/_/gameId/'+g['id'])
  for side in ['home','away']:g[side]['name']=g[side]['englishName']
  data['games'].append(g)
data['games'].sort(key=lambda g:(g['start'],g['id']))
reports=[json.loads(p.read_text()) for p in sorted((root/'data/football/fotmob').glob('*.json'))]
out=m.join_games(data,reports,json.loads((root/'data/football/external-team-map.json').read_text()),json.loads((root/'data/football/national-history.json').read_text()))
(root/'upgrade-v6/espn-games.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
(root/'upgrade-v6/joined-cups.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')))
print('Prepared',len(data['games']),'primary fixtures and',len(out['games']),'verified xG matches')
