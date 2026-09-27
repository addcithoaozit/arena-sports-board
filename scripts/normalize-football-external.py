"""Normalize Understat and pinned CC0 OpenFootball results without forecasts."""
import collections,datetime,hashlib,json,pathlib,re,unicodedata
ROOT=pathlib.Path(__file__).resolve().parents[1]
manifest=json.loads((ROOT/'.football-research/external-sources.json').read_text())
cutoff=datetime.datetime.fromisoformat(manifest['cutoff'])
games={};teams={};rejects=collections.Counter();coverage=collections.Counter();parse_audit=[]
MONTHS={m:i for i,m in enumerate(['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],1)}
ALIASES={'internazionalemilano':'inter','internazionale':'inter','sportingclubedeportugal':'sporting','sportinglisboa':'sporting','sportinglisbon':'sporting','sportlisboaebenfica':'benfica','benficalisboa':'benfica','atleticodemadrid':'atleticomadrid','clubatleticodemadrid':'atleticomadrid','bayer04leverkusen':'bayerleverkusen','rb':'rb','olympiakospiraeus':'olympiacos','olympiakos':'olympiacos','olympiacosfc':'olympiacos','dinamozagreb':'dinamozagreb','zenitstpetersburg':'zenit','zenitsankt-peterburg':'zenit','redbullsalzburg':'salzburg','lilleosc':'lille','valenciacf':'valencia','malagacf':'malaga','realbetisbalompie':'realbetis','sevillafc':'sevilla','brestois29':'brest','stadebrestois29':'brest','shakhtardonetsk':'shakhtardonetsk','borussiavflmonchengladbach':'borussiamonchengladbach','borussiamonchengladbach':'borussiamonchengladbach','parissaintgermain':'parissaintgermain','bolog na1909':'bologna','bologna1909':'bologna','psveindhoven':'psv','feyenoordrotterdam':'feyenoord','copenhag en':'kobenhavn','copenhagen':'kobenhavn','redstarbelgrade':'crvenazvezda','slaviapraha':'slaviapraha'}
ALIASES.update({'rbsalzburg':'salzburg','lazioroma':'lazio','sslazio':'lazio','sportingbraga':'braga','sportingclubedebraga':'braga','realsociedaddefutbol':'realsociedad','qarabagagdam':'qarabag','olympiquedemarseille':'olympiquemarseille','paeolympiakossfp':'olympiacos','bormonchengladbach':'borussiamonchengladbach','racingclubdelens':'lens'})
def club(name,country):
 name=name.strip();plain=''.join(c for c in unicodedata.normalize('NFKD',name) if not unicodedata.combining(c)).lower()
 tokens=re.sub(r'[^a-z0-9]+',' ',plain).split()
 drop={'fc','cf','afc','sc','ssc','ac','as','fk','sk','nk','gnk','kv','cp','sl','bsc','bc'}
 tokens=[t for t in tokens if t not in drop]
 key=''.join(tokens);key=ALIASES.get(key,key)
 country='FRA' if country=='MCO' else country
 return 'of:'+country+':'+key
def add_team(id,name):
 teams.setdefault(id,[])
 if name not in teams[id]:teams[id].append(name)
def add(row):
 key=row[0]
 if key in games and games[key]!=row:raise ValueError('conflicting source ID '+key)
 if not all(isinstance(v,int) and 0<=v<=30 for v in row[5:7]):rejects['invalid_score']+=1;return
 if datetime.datetime.fromisoformat(row[2].replace('Z','+00:00'))>=cutoff:rejects['future_result']+=1;return
 games[key]=row
for src in manifest['sources']:
 raw=(ROOT/src['path']).read_bytes()
 if hashlib.sha256(raw).hexdigest()!=src['sha256']:raise ValueError('Source hash mismatch')
 if src['provider']=='understat':
  for m in json.loads(raw)['dates']:
   if m.get('isResult') is not True:rejects['not_final']+=1;continue
   try:
    start=datetime.datetime.strptime(m['datetime'],'%Y-%m-%d %H:%M:%S').replace(tzinfo=datetime.timezone.utc).isoformat().replace('+00:00','Z')
    h,a=m['h'],m['a'];hg,ag=int(m['goals']['h']),int(m['goals']['a']);hx,ax=float(m['xG']['h']),float(m['xG']['a'])
    if not 0<=hx<=20 or not 0<=ax<=20:raise ValueError('xG out of range')
    hid,aid='us:'+str(h['id']),'us:'+str(a['id'])
    add_team(hid,h['title']);add_team(aid,a['title'])
    add(['us:'+str(m['id']),src['league'],start,hid,aid,hg,ag,hx,ax,False])
   except (KeyError,ValueError,TypeError):rejects['malformed_understat']+=1
 else:
  season=src['season'];date=None;section='';n=0;excluded=0;unparsed=[]
  for line in raw.decode('utf-8-sig').splitlines():
   if line.strip().startswith('▪'):section=line.strip().lstrip('▪').strip();continue
   dm=re.match(r'^\s*(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+([A-Z][a-z]{2})\s+(\d{1,2})(?:\s+(\d{4}))?',line)
   if dm:
    month=MONTHS[dm[1]];group=bool(re.search('Group|League|Matchday',section,re.I))
    year=int(dm[3]) if dm[3] else season if group and month>=7 else season+1
    date=datetime.date(year,month,int(dm[2]));continue
   if not re.search(r'\s+v\s+',line):continue
   if re.search(r'a\.e\.t\.|\baet\b|\bpen\.',line,re.I):excluded+=1;rejects['extra_time_or_penalties']+=1;continue
   m=re.match(r'^\s*(?:\d{1,2}:\d{2}\s+)?(.+?)\s+\(([A-Z]{3})\)\s+v\s+(.+?)\s+\(([A-Z]{3})\)\s+(\d+)\s*-\s*(\d+)(?:\s|$)',line)
   if not m or date is None:
    if re.search(r'\d\s*-\s*\d',line):unparsed.append(line.strip())
    else:rejects['unplayed_openfootball']+=1
    continue
   hn,hc,an,ac,hg,ag=m.groups();hid,aid=club(hn,hc),club(an,ac)
   add_team(hid,hn.strip());add_team(aid,an.strip())
   neutral=bool(re.match(r'^Final\b',section,re.I)) or (season==2019 and datetime.date(2020,8,12)<=date<=datetime.date(2020,8,23))
   start=date.isoformat()+'T12:00:00Z'
   key='of:'+hashlib.sha256(('|'.join([src['league'],date.isoformat(),hid,aid])).encode()).hexdigest()[:20]
   add([key,src['league'],start,hid,aid,int(hg),int(ag),None,None,neutral]);n+=1
  parse_audit.append({'season':season,'parsed':n,'extraTimeExcluded':excluded,'unparsed':unparsed})
  if unparsed:rejects['unparsed_openfootball']+=len(unparsed)
quarantine=json.loads((ROOT/'data/football/external-quarantine.json').read_text())['matches'] if (ROOT/'data/football/external-quarantine.json').exists() else []
excluded={q['id'] for q in quarantine}
rejects['cross_provider_conflicts']=sum(id in games for id in excluded)
rows=sorted((g for id,g in games.items() if id not in excluded),key=lambda r:(r[2],r[0]))
for r in rows:coverage[r[1]+':'+r[2][:4]]+=1
artifact={'schema':1,'cutoff':manifest['cutoff'],'columns':['id','league','start','homeId','awayId','homeGoals','awayGoals','homeXg','awayXg','neutral'],'sources':[{k:v for k,v in s.items() if k!='path'} for s in manifest['sources']],'teams':teams,'games':rows,'coverage':dict(sorted(coverage.items())),'rejections':dict(rejects),'openfootballParsing':parse_audit}
artifact['sha256']=hashlib.sha256(json.dumps(rows,separators=(',',':')).encode()).hexdigest()
out=ROOT/'data/football/external-history-20260927.json';out.write_text(json.dumps(artifact,ensure_ascii=False,separators=(',',':'))+'\n')
print(json.dumps({'games':len(rows),'teams':len(teams),'coverage':artifact['coverage'],'rejections':dict(rejects),'openfootballParsing':parse_audit},ensure_ascii=False,indent=2))
