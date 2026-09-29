NBA source captures, 2026-09-29

These are public ESPN JSON responses with unused presentation fields removed.
Root: `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/`

- `today`: `scoreboard?dates=20260929`
- `future`: `scoreboard?dates=20261008&limit=100`
- `historical`: `scoreboard?dates=20260503`
- `calendar`: `scoreboard?dates=20261029&limit=100`
- `current`: `teams/2/schedule?season=2027&seasontype=1`
- `team-{id}-{year}-{phase}`: `teams/{id}/schedule?season={year}&seasontype={phase}&limit=200`

The HTTP and source tests deliberately return empty scoreboards for unrecorded
dates and narrow the calendar to October 8. This is an isolated fixture, not a
claim of a complete live NBA schedule. The production source additionally passed
a live September 29 next-date lookup (Taiwan October 4), an October 9 schedule
lookup, and ready analyses using twenty completed games per team.

`nba-recent-results-v1` is a recent-score baseline, not a fitted or calibrated
model. It uses up to twenty completed regular/postseason games per team, no games
after the prediction cutoff, within 400 days. At least eight games and a latest
result within 210 days are required. Scoring rates use exponential recency and a
modest venue weight. Empirical margin variance supplies the probability scale;
small samples, offseason age and preseason fixtures shrink the margin. Injuries,
roster changes and bookmaker lines are not inputs. No sportsbook quotes, total
thresholds or calibrated-accuracy claims are synthesized.

Regression tests: `node --test tests/nba*.test.mjs`

Authenticated HTTP smoke after `npm run build`:
`node tests/nba-http-smoke.mjs`

The HTTP preload is explicitly test-only and uses in-memory PGlite accounts.
Never enable its environment variables on a deployed service.
