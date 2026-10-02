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
cookies, browser impersonation, proxy rotation or private signed APIs. HTTP 401/403/429
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
GitHub Actions scheduling is best effort. Each run collects current-season xG,
refreshes ESPN identity and venue evidence, cross-checks both providers and
rebuilds `data/football/cup-xg-history.json`. Tests run before the job commits
only generated data to main; Render can then deploy that data through the
existing automatic deployment. A concurrent main change causes a safe push
failure rather than an overwrite. No credentials or cookies are needed.

HTTP denial, transport failure or an exhausted request budget stops publication.
Historical source records and compact primary fixture evidence are committed so
Actions caches are not required for continuity. Missing xG and unresolved venues
stay excluded. EURO 2023 qualification has a narrowly scoped legacy parent
mapping; an ordinary EURO match cannot pass that exception.

`lib/football-cup-xg-source.ts` attaches source evidence to the existing analysis
response for Champions League and Nations League. Its `modelApplied` field is
always false. This enrichment does not alter probabilities, recommendations,
model versions or the user-facing screen. Raw averages describe available
verified matches, not a calibrated forecast or a claim of complete coverage.

The four v6 candidates were evaluated under the frozen protocol in
`docs/football-xg-opponent-v6-protocol.json`. Full results are in
`docs/football-opponent-xg-v6-results.json`. Germany, Italy, Champions League and
Nations League remain disabled because at least one fixed gate failed.
The existing EPL/Spain/France xG models and other active models remain in place.
Do not reinterpret successful collection or unit tests as statistical validation.

National xG history pools Nations League, EURO, World Cup and UEFA qualifying
fixtures while preserving each original competition. Friendlies are not added
as substitute xG. Regulation time excludes extra time and penalty shootouts.
Away-country tournament hosts remain excluded because they require a reverse
home-advantage treatment rather than a neutral flag.

User-provided HAR files, cookies, full HTML and raw ESPN responses are not
included in the repository. Compact public match and fixture data are retained
for reproducibility. Local cache pages are never uploaded.
