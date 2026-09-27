# Render football analysis

Render-only feature: `/?league=FOOTBALL`. Covers Premier League, La Liga,
Serie A, Bundesliga, Ligue 1 and UEFA Champions League. No GPT Sites changes.

The authenticated `/api/football` route uses public ESPN football scoreboard
and team schedule responses. Source requests allow only the six league codes,
validated dates and numeric event IDs. Analysis resolves the event through the
selected day before fetching team history. No credentials or betting accounts
are passed to ESPN. Source requests are deduplicated, capped at four concurrent
requests and cached for 30 seconds (scoreboard) / one hour (history).

ESPN's soccer scoreboard accepts a single source day. The app queries the two
source dates overlapping a Taiwan day, deduplicates event IDs and filters by
actual kickoff in Asia/Taipei. No fabricated zero scores before kickoff.
An empty day offers a next-match-day lookup using the source calendar, or a
bounded 31-day lookup when the calendar contains tournament phases.

## Model v1

- Before both current time and kickoff, use the last year of same-competition
  regulation-time finals, capped at the latest 20 matches per team.
- Exclude missing scores, AET and penalty finals, other leagues, future matches,
  target event and duplicate IDs. Require five matches per team and a result
  within 120 days.
- Weight observations by `exp(-ageDays / 90)`. Blend venue 60% / overall 40%
  when at least three venue observations exist; otherwise use overall.
  Neutral fixtures use overall rates.
- Expected goals are the mean of own scoring and opponent conceding rates,
  bounded to 0.15–5. Independent Poisson distributions (0–20 goals, normalized)
  produce home/draw/away, over/under 2.5, BTTS and top three score scenarios.
- This is an uncalibrated baseline. It excludes lineups, injuries, actual xG,
  opponent strength and market prices. UI identifies these limits. The fixed
  2.5-goal comparison is not an imported bookmaker line. No bet placement,
  odds integration, handicap recommendation or parlay is claimed.
- Once kickoff arrives or a match is delayed/finished, hide pregame predictions.
  Failures are distinct from empty schedules; stale schedules suspend analysis.

Run `node --test tests/football.test.mjs` and `npm run build` before deployment.
Existing request-gate authentication covers the new API without exceptions.
