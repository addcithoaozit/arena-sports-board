# FotMob historical xG source

The public match route `/match/{matchId}` returns the requested historical game
in server-rendered `__NEXT_DATA__`. No Cookie or authentication is needed in the
verified environment. The team-pair URL ending in `#matchId` is **not** a safe
server-side source: the fragment is not sent over HTTP and the response can be
the latest meeting of those teams. Even adding a `matchId` query to that URL did
not select the requested historical game in the 2026-10-02 check.

## Collection

```sh
python -m unittest discover -s tests -p test_football_fotmob.py -v
python scripts/football-fotmob/sync.py --competitions champions --seasons 2023-2024
python scripts/football-fotmob/sync.py --competitions nations-a nations-b nations-c nations-d nations-b-playoff nations-c-playoff --seasons 2024-2025
python scripts/football-fotmob/sync.py --seasons latest
```

Output: `data/football/fotmob/<competition>-<season>.json`. `--limit` bounds new
match requests per competition/season and reports deferred records as incomplete.
The collector uses Python's standard library, one request at a time with at
least 1.25 seconds between starts. It does not use cloudscraper, access tokens,
cookies, browser impersonation, proxies or private signed APIs. HTTP 401/403/429
stops the run without replacing the last saved dataset. A failed-run report is
saved separately. There is no automatic retry around access denials.

Each accepted row must match the public season fixture's match ID, competition,
exact kickoff, ordered team IDs and final score. Awarded, cancelled, unfinished,
future, ambiguous and incomplete matches are excluded with a reason. A changed
date, ordered team identity or final score invalidates a cached record.

## Regulation time

The end-of-regulation event is required to establish the 90-minute result.
For ordinary full-time matches, xG uses the provider's published total. For
extra time/penalties, it uses the sum of the published first- and second-half
values, including stoppage time. Extra-time periods and penalty shootouts are
excluded. Period xG values must reconcile to the published total within rounding
tolerance. A missing value is never converted to zero.

Shot counts are checked against period statistics to detect incomplete shotmaps.
Individual shot xG sums are retained as audit fields, not substituted for the
provider's team xG. These can differ: the 2024 Champions League final publishes
Dortmund 2.08 xG, whereas the retrieved individual shots sum to about 2.1520.
The source parser preserves the published aggregate consistently.

Verified examples:

- 4446291, Dortmund–Real Madrid, 2024-06-01: 0–2, published xG 2.08–1.13.
- 4679454, Portugal–Spain, 2025-06-08: regulation 2–2, regulation xG 0.59–1.93.
  The full-match xG 1.00–2.14 includes extra time and is not used as 90-minute xG.

## Daily job and model boundary

`football-fotmob-sync.yml` requests a run at 20:25 UTC / 04:25 Asia/Taipei.
GitHub Actions scheduling is best effort. It refreshes current-season source
data, reuses verified older records and saves quality reports as Actions
artifacts. It has read-only repository permissions and does not write to main,
deploy Render, alter production predictions or enable model candidates.

All rows have `modelEligible: false`; the dataset has `modelEnabled: false`.
Provider IDs must still be mapped and checked against the production fixture
identities. Neutral venue is explicitly unknown (`null`) until verified; it is
never assumed false. Qualification/playoff competitions remain separately
identified. Neither a successful download nor a high coverage percentage is a
model-validation result.

Before production use, collect sufficient earlier seasons, join identities and
neutral venues, freeze a chronological fitting/selection/holdout protocol, and
compare the candidate against the currently deployed competition model. Do not
enable a failed candidate or tune repeatedly on the holdout set. In particular,
this source addition does not change the failed Germany/Italy candidate gates.

User-provided HAR files and full page HTML are not included in the repository.
Test fixtures contain only the public match data needed to verify the parser.
