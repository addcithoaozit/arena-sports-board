#!/usr/bin/env python3
"""Collect verified 90-minute xG from public FotMob HTML; never changes models.

Standard library only. No cookies, credentials, private API or anti-bot bypass.
Every result is bound to a fixture ID, competition, kickoff and ordered teams.
"""
import argparse
import collections
import datetime as dt
import hashlib
import json
import math
import pathlib
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
CATALOG = {
    "champions": (42, "champions-league", "uefa.champions"),
    "nations-a": (9806, "uefa-nations-league", "uefa.nations"),
    "nations-b": (9807, "uefa-nations-league-b", "uefa.nations"),
    "nations-c": (9808, "uefa-nations-league-c", "uefa.nations"),
    "nations-d": (9809, "uefa-nations-league-d", "uefa.nations"),
    "nations-b-playoff": (10718, "uefa-nations-league-b-qualification", "uefa.nations"),
    "nations-c-playoff": (10719, "uefa-nations-league-c-qualification", "uefa.nations"),
    "euro": (50, "euro", "uefa.euro"),
    "world-cup": (77, "world-cup", "fifa.world"),
    "euro-qualifying": (10607, "euro-qualification", "uefa.euroq"),
    "world-qualifying-uefa": (10195, "world-cup-qualification-uefa", "fifa.worldq.uefa"),
}
UTC = dt.timezone.utc


class InvalidData(ValueError):
    pass


class AccessStopped(RuntimeError):
    pass


def timestamp(value):
    try:
        result = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        if result.tzinfo is None:
            raise ValueError()
        return result.astimezone(UTC)
    except (ValueError, AttributeError, TypeError):
        raise InvalidData("invalid_timestamp") from None


def number(value, maximum=30, integer=False):
    if isinstance(value, bool) or value is None or value == "":
        raise InvalidData("missing_numeric_value")
    try:
        result = float(value)
    except (TypeError, ValueError):
        raise InvalidData("invalid_numeric_value") from None
    if not math.isfinite(result) or not 0 <= result <= maximum:
        raise InvalidData("invalid_numeric_range")
    if integer and not result.is_integer():
        raise InvalidData("non_integer_score")
    return int(result) if integer else result


def next_data(html):
    match = re.search(r'<script\b[^>]*\bid=["\']__NEXT_DATA__["\'][^>]*>(.*?)</script>', html, re.S)
    if not match:
        raise InvalidData("missing_public_page_data")
    try:
        return json.loads(match.group(1))["props"]["pageProps"]
    except (KeyError, TypeError, ValueError):
        raise InvalidData("invalid_public_page_data") from None


def stat_pair(periods, period, key):
    pairs = []
    for group in periods.get(period, {}).get("stats", []):
        for stat in group.get("stats", []):
            if stat.get("key") != key or stat.get("type") == "title":
                continue
            values = stat.get("stats")
            if not isinstance(values, list) or len(values) != 2:
                raise InvalidData("invalid_stat_pair")
            pairs.append(tuple(number(x, 100 if key == "total_shots" else 20) for x in values))
    if not pairs:
        raise InvalidData("missing_" + key + "_" + period)
    if any(pair != pairs[0] for pair in pairs):
        raise InvalidData("conflicting_stat_values")
    return pairs[0]


def parse_match(page, fixture, competition, season, now):
    league_id, _, league = CATALOG[competition]
    general, header = page.get("general", {}), page.get("header", {})
    status = header.get("status", {})
    mid = str(fixture.get("id", ""))
    if not mid.isdigit() or str(general.get("matchId")) != mid:
        raise InvalidData("match_id_mismatch")
    parent = str(general.get("parentLeagueId") or general.get("leagueId"))
    # Historical 2023 qualification groups were filed under EURO (50).
    # The enclosing 10607 fixture feed, qualification label, exact match ID,
    # kickoff, ordered teams and final score must all still agree.
    legacy_euro_qualifier = (competition == "euro-qualifying" and season == "2023"
                            and parent == "50"
                            and re.fullmatch(r"EURO Qualification Grp\. [A-J]", general.get("leagueName", "")))
    if parent != str(league_id) and not legacy_euro_qualifier:
        raise InvalidData("competition_mismatch")
    start = timestamp(general.get("matchTimeUTCDate"))
    if start != timestamp(fixture.get("status", {}).get("utcTime")):
        raise InvalidData("kickoff_mismatch")
    if start >= now or general.get("finished") is not True or status.get("finished") is not True:
        raise InvalidData("not_completed")
    if status.get("cancelled") or status.get("awarded"):
        raise InvalidData("cancelled_or_awarded")
    teams = header.get("teams", [])
    if len(teams) != 2:
        raise InvalidData("invalid_teams")
    ids = [str(fixture.get(side, {}).get("id", "")) for side in ("home", "away")]
    if not all(x.isdigit() for x in ids) or ids[0] == ids[1]:
        raise InvalidData("invalid_team_identity")
    if ids != [str(t.get("id")) for t in teams] or ids != [str(general.get(side + "Team", {}).get("id")) for side in ("home", "away")]:
        raise InvalidData("ordered_team_mismatch")
    final_score = [number(t.get("score"), integer=True) for t in teams]
    fixture_score = re.fullmatch(r"(\d+)\s*-\s*(\d+)", fixture.get("status", {}).get("scoreStr", ""))
    if not fixture_score or final_score != [int(x) for x in fixture_score.groups()]:
        raise InvalidData("fixture_score_mismatch")
    content = page.get("content", {})
    periods = (content.get("stats") or {}).get("Periods", {})
    # Read the explicit end-of-regulation marker, not the AET/penalty final score.
    markers = [e for e in (content.get("matchFacts") or {}).get("events", {}).get("events", [])
               if e.get("type") == "Half" and e.get("time") == 90 and e.get("halfStrKey") == "fulltime_short"]
    scores = [[number(e.get("homeScore"), integer=True), number(e.get("awayScore"), integer=True)] for e in markers]
    if not scores or any(s != scores[0] for s in scores):
        raise InvalidData("missing_or_conflicting_90min_score")
    score = scores[0]
    shots = (content.get("shotmap") or {}).get("shots")
    extra = (any(p in periods for p in ("FirstExtraHalf", "SecondExtraHalf"))
             or status.get("reason", {}).get("short") in ("AET", "Pen")
             or bool(status.get("halfs", {}).get("firstExtraHalfStarted"))
             or any(s.get("period") in ("FirstHalfExtra", "SecondHalfExtra", "PenaltyShootout") for s in (shots or [])))
    if (not extra and score != final_score) or any(score[i] > final_score[i] for i in (0, 1)):
        raise InvalidData("regulation_score_mismatch")
    if not isinstance(shots, list):
        raise InvalidData("missing_shotmap")
    split_available = True
    try:
        for period in ("FirstHalf", "SecondHalf"):
            stat_pair(periods, period, "expected_goals")
            stat_pair(periods, period, "total_shots")
    except InvalidData as error:
        if not str(error).startswith(("missing_expected_goals_", "missing_total_shots_")):
            raise
        split_available = False
    if extra and not split_available:
        raise InvalidData("extra_time_without_regulation_xg")
    checked_periods = ("FirstHalf", "SecondHalf") if split_available else ("All",)
    half_xg = [stat_pair(periods, period, "expected_goals") for period in checked_periods]
    seen, xg = set(), [0.0, 0.0]
    for period, totals in zip(checked_periods, half_xg):
        count, sums = [0, 0], [0.0, 0.0]
        expected_counts = stat_pair(periods, period, "total_shots")
        for shot in shots:
            if (shot.get("period") not in ("FirstHalf", "SecondHalf") if period == "All" else shot.get("period") != period) or shot.get("isOwnGoal") is True:
                continue
            sid = shot.get("id")
            if sid is None or sid in seen:
                raise InvalidData("duplicate_or_missing_shot_id")
            seen.add(sid)
            if str(shot.get("teamId")) not in ids:
                raise InvalidData("shot_team_mismatch")
            side = ids.index(str(shot["teamId"]))
            count[side] += 1
            sums[side] += number(shot.get("expectedGoals"), maximum=1)
        if count != list(expected_counts):
            raise InvalidData("incomplete_shotmap")
        xg = [xg[i] + sums[i] for i in (0, 1)]
    # Published team xG can differ from a naive sum of individual shot xG.
    # Use one consistent provider aggregate; preserve raw sums for auditing only.
    regulation_xg = [round(sum(p[i] for p in half_xg), 2) for i in (0, 1)]
    all_xg = stat_pair(periods, "All", "expected_goals")
    all_period_xg = list(regulation_xg)
    for period in ("FirstExtraHalf", "SecondExtraHalf"):
        if period in periods:
            pair = stat_pair(periods, period, "expected_goals")
            all_period_xg = [all_period_xg[i] + pair[i] for i in (0, 1)]
    if any(abs(all_period_xg[i] - all_xg[i]) > .031 for i in (0, 1)):
        raise InvalidData("period_xg_total_mismatch")
    official_xg = regulation_xg if extra else all_xg
    return {
        "id": "fotmob:" + mid, "league": league, "competition": competition,
        "providerLeagueId": league_id, "season": season, "start": start.isoformat().replace("+00:00", "Z"),
        "homeId": "fotmob:" + ids[0], "awayId": "fotmob:" + ids[1],
        "homeName": teams[0].get("name"), "awayName": teams[1].get("name"),
        "homeGoals": score[0], "awayGoals": score[1], "sourceFinalScore": final_score,
        "homeXg": official_xg[0], "awayXg": official_xg[1],
        "shotXg90AuditOnly": [round(x, 8) for x in xg],
        "xgMethod": "published_first_plus_second_half" if extra else "published_regulation_total",
        "period": "regulation_including_stoppage", "hadExtraTimeOrPenalties": extra,
        "neutral": None, "source": "FotMob", "sourceUrl": "https://www.fotmob.com/match/" + mid,
        "retrievedAt": now.isoformat().replace("+00:00", "Z"), "modelEligible": False,
    }


class PublicClient:
    def __init__(self, delay=1.25, evidence_dir=None):
        self.delay, self.last, self.evidence_dir = max(1.0, delay), 0.0, evidence_dir

    def get(self, url):
        parsed = urllib.parse.urlsplit(url)
        if parsed.scheme != "https" or parsed.netloc != "www.fotmob.com":
            raise InvalidData("unexpected_source_host")
        evidence_path = self.evidence_dir / (hashlib.sha256(url.encode()).hexdigest() + ".json") if self.evidence_dir else None
        if evidence_path and evidence_path.exists():
            evidence = json.loads(evidence_path.read_text())
            age = dt.datetime.now(UTC) - timestamp(evidence["capturedAt"])
            page = evidence["page"]
            start = page.get("general", {}).get("matchTimeUTCDate")
            old_final = start and page.get("general", {}).get("finished") is True and timestamp(start) < dt.datetime.now(UTC) - dt.timedelta(days=14)
            if evidence.get("url") == url and (old_final or age < dt.timedelta(hours=6)):
                return page
        time.sleep(max(0, self.delay - (time.monotonic() - self.last)))
        self.last = time.monotonic()
        request = urllib.request.Request(url, headers={"User-Agent": "Maya-YJ-xG-audit/1.0", "Accept": "text/html"})
        try:
            with urllib.request.urlopen(request, timeout=25) as response:
                if urllib.parse.urlsplit(response.url).netloc != "www.fotmob.com":
                    raise InvalidData("unexpected_redirect_host")
                body = response.read(8_000_001)
                if len(body) > 8_000_000:
                    raise InvalidData("page_too_large")
                page = next_data(body.decode("utf-8"))
                if evidence_path:
                    atomic_json(evidence_path, {"url": url, "capturedAt": dt.datetime.now(UTC).isoformat(), "page": page})
                return page
        except urllib.error.HTTPError as error:
            if error.code in (401, 403, 429):
                raise AccessStopped("source_http_" + str(error.code)) from None
            raise InvalidData("source_http_" + str(error.code)) from None


def atomic_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n")
    temporary.replace(path)


def sync(client, competition, season, output, limit=None):
    now = dt.datetime.now(UTC)
    lid, slug, _ = CATALOG[competition]
    url = f"https://www.fotmob.com/leagues/{lid}/overview/{slug}"
    if season != "latest":
        if not re.fullmatch(r"\d{4}(?:-\d{4})?", season):
            raise InvalidData("invalid_season")
        url += "?season=" + season
    page = client.get(url)
    details = page.get("details", {})
    selected = str(details.get("selectedSeason", "")).replace("/", "-")
    if str(details.get("id")) != str(lid) or not re.fullmatch(r"\d{4}(?:-\d{4})?", selected) or (season != "latest" and selected != season):
        raise InvalidData("season_identity_mismatch")
    fixtures = page.get("fixtures", {}).get("allMatches")
    if not isinstance(fixtures, list) or len(fixtures) > 2000 or (not fixtures and int(selected[:4]) <= now.year):
        raise InvalidData("invalid_fixture_list")
    ineligible = collections.Counter()
    for fixture in fixtures:
        status = fixture.get("status", {})
        if status.get("cancelled"):
            ineligible["cancelled"] += 1
        elif status.get("awarded"):
            ineligible["awarded"] += 1
        elif status.get("finished") is not True:
            ineligible["not_completed"] += 1
        elif timestamp(status.get("utcTime")) >= now:
            ineligible["future_timestamp"] += 1
    finished = [f for f in fixtures if f.get("status", {}).get("finished") is True
                and not f["status"].get("cancelled") and not f["status"].get("awarded")
                and timestamp(f["status"].get("utcTime")) < now]
    ids = [str(f.get("id", "")) for f in finished]
    if len(set(ids)) != len(ids) or not all(i.isdigit() for i in ids):
        raise InvalidData("duplicate_or_invalid_fixture_id")
    path = output / f"{competition}-{selected}.json"
    old = json.loads(path.read_text()) if path.exists() else {}
    previous = {r["id"].removeprefix("fotmob:"): r for r in old.get("games", [])}
    games, rejected, requested = [], [], 0
    stopped = None
    for fixture in finished:
        mid, status = str(fixture["id"]), fixture["status"]
        cached = previous.get(mid)
        score_text = re.fullmatch(r"(\d+)\s*-\s*(\d+)", status.get("scoreStr", ""))
        cached_score_agrees = score_text and cached and cached.get("sourceFinalScore") == [int(x) for x in score_text.groups()]
        if cached_score_agrees and timestamp(cached["start"]) == timestamp(status["utcTime"]) and timestamp(cached["start"]) < now - dt.timedelta(days=14) and [cached["homeId"], cached["awayId"]] == ["fotmob:" + str(fixture[s]["id"]) for s in ("home", "away")]:
            games.append(cached)
            continue
        if limit is not None and requested >= limit:
            stopped = "request_budget_deferred"
            rejected.append({"id": mid, "reason": "request_budget_deferred"})
            break
        requested += 1
        try:
            data = client.get("https://www.fotmob.com/match/" + mid)
            row = parse_match(data, fixture, competition, selected, now)
            # Keep the first capture date on an unchanged record.
            if cached and {k:v for k,v in row.items() if k != "retrievedAt"} == {k:v for k,v in cached.items() if k != "retrievedAt"}:
                row = cached
            games.append(row)
        except AccessStopped as error:
            stopped = str(error)
            rejected.append({"id": mid, "reason": stopped})
            break
        except (InvalidData, KeyError, TypeError, urllib.error.URLError, TimeoutError) as error:
            reason = str(error) if isinstance(error, InvalidData) else type(error).__name__
            rejected.append({"id": mid, "reason": reason})
            if isinstance(error, (urllib.error.URLError, TimeoutError)) or reason.startswith("source_http_"):
                stopped = reason
                break
        if requested % 20 == 0:
            print(json.dumps({"competition": competition, "season": selected, "requested": requested, "accepted": len(games)}), flush=True)
    reasons = dict(collections.Counter(r["reason"] for r in rejected))
    report = {"schemaVersion": 1, "source": "FotMob public HTML", "competition": competition,
              "season": selected, "sourceUrl": url, "capturedAt": now.isoformat(),
              "fixtures": len(fixtures), "completedFixtures": len(finished), "accepted": len(games),
              "ineligibleFixtures": dict(ineligible),
              "coverage": len(games) / len(finished) if finished else None,
              "rejectedReasons": reasons, "rejected": rejected, "games": games,
              "status": "access_stopped" if stopped else "collected",
              "modelEnabled": False, "pending": ["cross_provider_identity_and_neutral_venue", "temporal_model_validation"]}
    if stopped:
        # Never replace a last good dataset with a rate-limited/blocked partial run.
        atomic_json(output / "reports" / (path.stem + "-failed.json"), report)
        raise AccessStopped(stopped)
    atomic_json(path, report)
    print(json.dumps({k: report[k] for k in ("competition", "season", "accepted", "completedFixtures", "rejectedReasons")}), flush=True)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--competitions", nargs="+", choices=CATALOG, default=list(CATALOG))
    parser.add_argument("--seasons", nargs="+", default=["latest"])
    parser.add_argument("--output", type=pathlib.Path, default=ROOT / "data/football/fotmob")
    parser.add_argument("--limit", type=int, help="Maximum new match requests per competition/season")
    parser.add_argument("--evidence-dir", type=pathlib.Path, help="Optional local cache of public pages for reproducible audits")
    args = parser.parse_args()
    if args.limit is not None and args.limit < 1:
        parser.error("--limit must be positive")
    client = PublicClient(evidence_dir=args.evidence_dir)
    try:
        for competition in args.competitions:
            for season in args.seasons:
                sync(client, competition, season, args.output, args.limit)
    except (AccessStopped, InvalidData, urllib.error.URLError, TimeoutError) as error:
        print(type(error).__name__ + ": " + str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
