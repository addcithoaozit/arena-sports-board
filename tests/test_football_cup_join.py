import copy,importlib.util,json,pathlib,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('cup_join',ROOT/'scripts/football-fotmob/build_history.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class JoinTests(unittest.TestCase):
 def inputs(self):
  data={'teams':{'478':'France','162':'Italy'},'games':[{'id':'1','league':'uefa.nations','start':'2026-09-01T18:45:00Z','home':{'id':'478','englishName':'France'},'away':{'id':'162','englishName':'Italy'},'homeScore':2,'awayScore':1,'state':'final','neutralVerified':False,'neutral':False,'venueCountry':'France','venueId':'','homeVenueId':'','stage':'','roundLabel':''}]}
  r={'id':'fotmob:1','league':'uefa.nations','start':'2026-09-01T18:45:00Z','homeName':'France','awayName':'Italy','homeId':'fotmob:10','awayId':'fotmob:20','sourceFinalScore':[2,1],'homeGoals':2,'awayGoals':1,'homeXg':1.8,'awayXg':.7,'sourceUrl':'https://www.fotmob.com/match/1','hadExtraTimeOrPenalties':False,'retrievedAt':'2026-10-02T00:00:00Z'}
  return data,[{'games':[r]}],{'teams':{}},{'teams':{}}
 def test_exact_cross_provider_match_and_home_venue(self):
  d=self.inputs();out=m.join_games(*d);self.assertEqual(len(out['games']),1);self.assertFalse(out['games'][0]['neutral']);self.assertEqual(out['games'][0]['venueProof'],'home_country')
 def test_reversed_teams_score_date_conflicts_and_ambiguous_venues_rejected(self):
  for case in ['score','date','teams','venue']:
   d=self.inputs();g=d[0]['games'][0]
   if case=='score':g['homeScore']=3
   elif case=='date':g['start']='2026-09-01T19:45:00Z'
   elif case=='teams':g['home'],g['away']=g['away'],g['home']
   else:g['venueCountry']='Italy'
   with self.subTest(case=case):self.assertEqual(len(m.join_games(*d)['games']),0)
 def test_third_country_is_neutral_and_final_is_explicit(self):
  d=self.inputs();d[0]['games'][0]['venueCountry']='Germany';self.assertTrue(m.join_games(*d)['games'][0]['neutral'])
  g={'neutralVerified':False,'league':'uefa.champions','stage':'final','roundLabel':''};self.assertEqual(m.venue(g,{}),(True,'designated_competition_final'))
if __name__=='__main__':unittest.main()
