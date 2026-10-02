import copy
import datetime as dt
import importlib.util
import json
import pathlib
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("fotmob_sync", ROOT / "scripts/football-fotmob/sync.py")
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)
NOW = dt.datetime(2026, 10, 2, tzinfo=dt.timezone.utc)


def sample(name="nations-final"):
    return json.loads((ROOT / "tests/fixtures/fotmob" / (name + ".json")).read_text())


def parse(data):
    return sync.parse_match(data["page"], data["fixture"], data["competition"], data["season"], NOW)


class FotmobTests(unittest.TestCase):
    def test_regulation_excludes_extra_time_and_shootout(self):
        result = parse(sample())
        self.assertEqual([result["homeGoals"], result["awayGoals"]], [2, 2])
        self.assertEqual([result["homeXg"], result["awayXg"]], [.59, 1.93])
        self.assertTrue(result["hadExtraTimeOrPenalties"])
        self.assertFalse(result["modelEligible"])
        self.assertIsNone(result["neutral"])

    def test_historical_champions_final(self):
        result = parse(sample("champions-final"))
        self.assertEqual(result["id"], "fotmob:4446291")
        self.assertEqual([result["homeGoals"], result["awayGoals"]], [0, 2])
        self.assertEqual([result["homeXg"], result["awayXg"]], [2.08, 1.13])
        self.assertNotEqual(round(result["shotXg90AuditOnly"][0], 2), result["homeXg"])

    def test_latest_head_to_head_response_is_rejected(self):
        data = sample("champions-final")
        data["page"]["general"]["matchId"] = "4685780"
        with self.assertRaisesRegex(sync.InvalidData, "match_id_mismatch"):
            parse(data)

    def test_reversed_teams_date_and_competition_are_rejected(self):
        for case in ("teams", "date", "league"):
            data = sample()
            if case == "teams":
                data["page"]["header"]["teams"].reverse()
            elif case == "date":
                data["fixture"]["status"]["utcTime"] = "2025-06-09T19:00:00Z"
            else:
                data["page"]["general"]["parentLeagueId"] = 42
            with self.subTest(case=case), self.assertRaises(sync.InvalidData):
                parse(data)

    def test_missing_xg_is_never_zero(self):
        data = sample()
        data["page"]["content"]["shotmap"]["shots"][0]["expectedGoals"] = None
        with self.assertRaisesRegex(sync.InvalidData, "missing_numeric_value"):
            parse(data)

    def test_incomplete_and_duplicate_shots_rejected(self):
        for duplicate in (False, True):
            data = sample()
            shots = data["page"]["content"]["shotmap"]["shots"]
            if duplicate:
                shots.append(copy.deepcopy(shots[0]))
            else:
                shots.pop(0)
            with self.subTest(duplicate=duplicate), self.assertRaises(sync.InvalidData):
                parse(data)

    def test_final_score_cannot_replace_missing_90min_score(self):
        data = sample()
        data["page"]["content"]["matchFacts"]["events"]["events"] = []
        with self.assertRaisesRegex(sync.InvalidData, "90min_score"):
            parse(data)

    def test_conflicting_published_period_xg_rejected(self):
        data = sample("champions-final")
        for group in data["page"]["content"]["stats"]["Periods"]["All"]["stats"]:
            for stat in group["stats"]:
                if stat.get("key") == "expected_goals":
                    stat["stats"][0] = "2.50"
        with self.assertRaisesRegex(sync.InvalidData, "period_xg_total_mismatch"):
            parse(data)

    def test_score_correction_invalidates_old_cache(self):
        data = sample()
        cached = parse(data)
        cached["sourceFinalScore"] = [1, 1]
        calls = []
        class Client:
            def get(self, url):
                calls.append(url)
                if "/leagues/" in url:
                    return {"details": {"id": 9806, "selectedSeason": "2024/2025"}, "fixtures": {"allMatches": [data["fixture"]]}}
                return data["page"]
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / "nations-a-2024-2025.json"
            path.write_text(json.dumps({"games": [cached]}))
            report = sync.sync(Client(), "nations-a", "2024-2025", pathlib.Path(directory))
            self.assertTrue(any("/match/4679454" in url for url in calls))
            self.assertEqual(report["games"][0]["sourceFinalScore"], [2, 2])

    def test_future_and_awarded_rejected(self):
        data = sample()
        data["page"]["header"]["status"]["awarded"] = True
        with self.assertRaisesRegex(sync.InvalidData, "awarded"):
            parse(data)
        data = sample()
        with self.assertRaisesRegex(sync.InvalidData, "not_completed"):
            sync.parse_match(data["page"], data["fixture"], data["competition"], data["season"], dt.datetime(2024, 1, 1, tzinfo=sync.UTC))

    def test_access_denial_keeps_previous_dataset(self):
        data = sample()
        class Client:
            def get(self, url):
                if "/leagues/" in url:
                    return {"details": {"id": 9806, "selectedSeason": "2024/2025"}, "fixtures": {"allMatches": [data["fixture"]]}}
                raise sync.AccessStopped("source_http_429")
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / "nations-a-2024-2025.json"
            path.write_text('{"games":[],"sentinel":true}')
            with self.assertRaises(sync.AccessStopped):
                sync.sync(Client(), "nations-a", "2024-2025", pathlib.Path(directory))
            self.assertTrue(json.loads(path.read_text())["sentinel"])


if __name__ == "__main__":
    unittest.main()
