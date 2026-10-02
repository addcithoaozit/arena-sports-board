import argparse,json,re,unicodedata,collections,datetime
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]

def key(name):
 name=''.join(c for c in unicodedata.normalize('NFD',name) if unicodedata.category(c)!='Mn').lower().replace('ø','o').replace('ł','l').replace('đ','d')
 return re.sub('[^a-z0-9]','',name)

ALIASES={
 'milan':'acmilan','inter':'internazionale','internazionale':'internazionale',
 'bayernmunchen':'bayernmunich','parissaintgermain':'parissaintgermain','psg':'parissaintgermain',
 'sportingcp':'sportingcp','sporting':'sportingcp','atleticomadrid':'atleticomadrid',
 'manchesterunited':'manchesterunited','newcastleunited':'newcastleunited','newcastle':'newcastleunited',
 'borussiamonchengladbach':'borussiamonchengladbach','borussiamgladbach':'borussiamonchengladbach',
 'redbullsalzburg':'rbsalzburg','fcredbullsalzburg':'rbsalzburg','salzburg':'rbsalzburg',
 'fcporto':'fcporto','porto':'fcporto','celtic':'celtic',
 'clubbrugge':'clubbrugge','clubbruges':'clubbrugge',
 'crvenazvezda':'redstarbelgrade','fkcrvenazvezda':'redstarbelgrade',
 'copenhagen':'fccopenhagen','fckobenhavn':'fccopenhagen',
 'bscyoungboys':'youngboys','shakhtardonetsk':'shakhtardonetsk',
 'shakhtardonetsk':'shakhtardonetsk','dynamokyiv':'dynamokyiv','dynamokiev':'dynamokyiv',
 'zenitstpetersburg':'zenitstpetersburg','zenit':'zenitstpetersburg',
 'viktoriaplzen':'fcviktoriaplzen','plzen':'fcviktoriaplzen',
 'dinamozagreb':'dinamozagreb','gnkdinamozagreb':'dinamozagreb',
 'ferencvaros':'ferencvaros','ferencvarositc':'ferencvaros',
 'basaksehir':'istanbulbasaksehir','istanbulbasaksehir':'istanbulbasaksehir',
 'rb leipzig':'rbleipzig','rbleipzig':'rbleipzig',
 'czechrepublic':'czechia','turkiye':'turkey','republicofireland':'ireland',
 'bosniaandherzegovina':'bosniaherzegovina','northmacedonia':'northmacedonia',
 'unitedstatesofamerica':'unitedstates','usa':'unitedstates','korearepublic':'southkorea',
 'qatar':'qatar','slovakrepublic':'slovakia','fyromacedonia':'northmacedonia',
 'ajax':'ajaxamsterdam','feyenoord':'feyenoordrotterdam','monaco':'asmonaco',
 'fckrasnodar':'krasnodar','fcsheriff':'sherifftiraspol','lask':'lasklinz',
 'royalantwerp':'antwerp','unionberlin':'1fcunionberlin','viking':'vikingfk',
 'wolfsburg':'vflwolfsburg','roma':'asroma','rennes':'staderennais','sturmgraz':'sksturmgraz',
 'pafosfc':'pafos','qarabagfk':'fkqarabag','drcongo':'congodr'
}
def normalized(name):
 k=key(name);return ALIASES.get(k,k)

def venue(g, club_countries):
 if g['neutralVerified']:return g['neutral'],'explicit_source_flag'
 if g['league']=='uefa.champions':
  if g['stage']=='final' or re.search(r',\s*Final$',g['roundLabel']):return True,'designated_competition_final'
  if g['venueId'] and g['venueId']==g['homeVenueId']:return False,'home_club_stadium_id'
  country=normalized(g['venueCountry']);home=club_countries.get(g['home']['id']);away=club_countries.get(g['away']['id'])
  if country and home and country==home:return False,'home_club_country'
  if country and home and away and country!=home and country!=away:return True,'third_country_club_fixture'
  return None,'club_venue_not_verified'
 country=normalized(g['venueCountry']);home=normalized(g['home']['englishName']);away=normalized(g['away']['englishName'])
 if g['venueId'] and g['venueId']==g['homeVenueId']:return False,'home_national_stadium_id'
 if not country or country in ['uk','unitedkingdom']:return None,'country_missing_or_ambiguous'
 if country==home:return False,'home_country'
 if country==away:return None,'away_country_host_requires_reverse_advantage'
 return True,'third_country'

def join_games(data, reports, mapping, national_seed):

 names=collections.defaultdict(set)
 for tid,name in data['teams'].items():names[normalized(name)].add(tid)
 mapping=mapping["teams"]
 COUNTRIES=dict(zip('AUT AZE BEL BLR BUL CRO CYP CZE DEN ENG ESP FRA GER GRE HUN ISR ITA KAZ MDA NED NOR POL POR ROU RUS SCO SRB SUI SVK SVN SWE TUR UKR'.split(),['Austria','Azerbaijan','Belgium','Belarus','Bulgaria','Croatia','Cyprus','Czechia','Denmark','England','Spain','France','Germany','Greece','Hungary','Israel','Italy','Kazakhstan','Moldova','Netherlands','Norway','Poland','Portugal','Romania','Russia','Scotland','Serbia','Switzerland','Slovakia','Slovenia','Sweden','Turkey','Ukraine']))
 club_countries={tid:normalized(COUNTRIES[item['openfootball'].split(':')[1]]) for tid,item in mapping.items() if item.get('openfootball') and item['openfootball'].split(':')[1] in COUNTRIES}
 for tid,item in mapping.items():names[normalized(item['name'])].add(tid)
 for tid,item in national_seed['teams'].items():names[normalized(item['englishName'])].add(tid)
 byday=collections.defaultdict(list)
 for g in data['games']:byday[(g['league'],g['start'][:10])].append(g)
 accepted=[];rejected=[];identities={};source_count=0
 for report in reports:
  for r in report['games']:
   source_count+=1
   hs=names[normalized(r['homeName'])];aws=names[normalized(r['awayName'])]
   candidates=[g for g in byday[(r['league'],r['start'][:10])] if g['home']['id'] in hs and g['away']['id'] in aws]
   if len(candidates)!=1:
    rejected.append({'id':r['id'],'home':r['homeName'],'away':r['awayName'],'reason':'identity_or_fixture_ambiguous','homeCandidates':sorted(hs),'awayCandidates':sorted(aws)});continue
   g=candidates[0]
   if g['start'].replace('.000Z','Z')!=r['start'] or [g['homeScore'],g['awayScore']]!=r['sourceFinalScore'] or g['state']!='final':
    rejected.append({'id':r['id'],'reason':'date_status_or_score_conflict'});continue
   neutral,proof=venue(g, club_countries)
   if neutral is None:
    rejected.append({'id':r['id'],'reason':proof});continue
   eid=lambda side: (mapping.get(g[side]['id'],{}).get('openfootball') or 'espn:'+g[side]['id']) if r['league']=='uefa.champions' else g[side]['id']
   for side in ['home','away']:
    old=identities.get(r[side+'Id'])
    if old and old['espnId']!=g[side]['id']:raise ValueError('provider_id_reassigned')
    identities[r[side+'Id']]={'espnId':g[side]['id'],'name':r[side+'Name'],'canonicalId':eid(side)}
   accepted.append({'id':'espn:'+g['id'],'league':r['league'],'start':r['start'],'homeId':eid('home'),'awayId':eid('away'),'homeGoals':r['homeGoals'],'awayGoals':r['awayGoals'],'homeXg':r['homeXg'],'awayXg':r['awayXg'],'neutral':neutral,'sourceMatchId':r['id'],'sourceUrl':r['sourceUrl'],'espnId':g['id'],'venueProof':proof,'hadExtraTimeOrPenalties':r['hadExtraTimeOrPenalties'],'sourceRetrievedAt':r['retrievedAt']})
 accepted.sort(key=lambda g:(g['start'],g['id']))
 out={'asOf':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceCount':source_count,'games':accepted,'identities':identities,'rejected':rejected,'rejectedReasons':dict(collections.Counter(g['reason'] for g in rejected))}
 return out

COLUMNS=['id','league','start','homeId','awayId','homeGoals','awayGoals','homeXg','awayXg','neutral','sourceMatchId','venueProof','sourceRetrievedAt','hadExtraTimeOrPenalties']
def main():
 parser=argparse.ArgumentParser(description='Cross-check FotMob against ESPN identities, scores, dates and venues.')
 parser.add_argument('--root',type=Path,default=ROOT)
 args=parser.parse_args();root=args.root
 fixture_files=list((root/'data/football/cup-fixtures').glob('*.json'))
 if not fixture_files:raise ValueError('missing_primary_fixtures')
 data={'teams':{},'games':[]};freshness=[]
 for path in fixture_files:
  item=json.loads(path.read_text());data['teams'].update(item['teams']);data['games'].extend(item['games']);freshness.append(item['refreshedAt'])
 reports=[json.loads(p.read_text()) for p in sorted((root/'data/football/fotmob').glob('*.json'))]
 if not reports:raise ValueError('missing_xg_sources')
 out=join_games(data,reports,json.loads((root/'data/football/external-team-map.json').read_text()),json.loads((root/'data/football/national-history.json').read_text()))
 target=root/'data/football/cup-xg-history.json'
 value={'schemaVersion':1,'builtAt':out['asOf'],'sourceUpdatedAt':min(max(freshness),max(r['capturedAt'] for r in reports)),
        'sourceCount':out['sourceCount'],'verifiedCount':len(out['games']),'identities':out['identities'],
        'columns':COLUMNS,'rows':[[g.get(k) for k in COLUMNS] for g in out['games']],
        'rejectedReasons':out['rejectedReasons']}
 if len({r[0] for r in value['rows']})!=len(value['rows']):raise ValueError('duplicate_primary_match')
 if not value['rows']:raise ValueError('no_verified_xg')
 # An access failure or loss of an entire competition cannot publish an empty replacement.
 if target.exists():
  old=json.loads(target.read_text())
  for league in {r[1] for r in old['rows']}:
   if not any(r[1]==league for r in value['rows']):raise ValueError('competition_disappeared:'+league)
 temporary=target.with_suffix('.json.tmp');temporary.write_text(json.dumps(value,ensure_ascii=False,separators=(',',':'))+'\n');temporary.replace(target)
 report=root/'docs/football-cup-source-quality.json'
 report.write_text(json.dumps({k:v for k,v in out.items() if k not in ['games','identities']},ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'verified':len(out['games']),'collected':out['sourceCount'],'rejectedReasons':out['rejectedReasons']}))
if __name__=='__main__':main()
