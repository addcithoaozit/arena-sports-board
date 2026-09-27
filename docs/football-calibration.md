# Football calibration and known limitations — 2026-09-27

This change audits all six football competitions. Only La Liga passes the frozen promotion rules and receives the fitted model. The other five keep `football-form-poisson-v1`; the UI names each failed gate. This is a modest improvement in probability scores, not evidence of reliably higher future accuracy or profitable bets.

## Data and time separation

The committed ESPN archive contains 11,033 regulation full-time fixtures across 2021–2026, with per-request provenance and SHA-256. The cutoff is 2026-09-27T12:35:04Z. Future fixtures, missing scores, extra-time/shootout finals and conflicting results are excluded. Fixtures are unique by competition and provider ID. This is a single-provider, retrospectively downloaded archive: supplier corrections are possible and completeness against a second provider has not been established.

2021 supplies warmup history. 2022–2023 fit coefficients, 2024 chooses among nine fixed decay/venue variants, 2025 is a locked holdout, and 2026 is a recent audit. The protocol was recorded before fitting. 8,315 fixtures from 2022 onward have sufficient history. Features are built chronologically using production `footballForm` three hours before kickoff; the target result is added only afterwards. Same-competition history is limited to 365 days and 20 fixtures. Both teams require five results and a last result no more than 120 days old. Calendar-year samples are not full-season counts.

A regularized goal regression learns shared attack/defense slopes, home/away intercepts, and a bounded Dixon–Coles correction to the four low-score cells. The nine candidates combine 60/90/180-day exponential decay and 0/0.3/0.6 venue weights. Neutral matches use the mean intercept and no venue weighting. All displayed markets and score scenarios derive from the same normalized score distribution. Research uses SciPy's Poisson/Skellam functions; committed independent witness cases check parity with the TypeScript grid. The rho bounds enforce positivity of all four corrected cells, including rho < 1. The fit already bounds rho to ±0.2, so the additional general-purpose safety bound does not change fitted results.

Method reference: Dixon & Coles (1997), *Modelling Association Football Scores and Inefficiencies in the Football Betting Market*, DOI https://doi.org/10.1111/1467-9876.00065. This implementation is an adaptation using rolling team features, not a reproduction of that paper's full team-strength model.

## Frozen promotion criteria and results

Minimum training/selection/holdout/recent samples: 180/80/80/60. Log loss must improve on selection, holdout and recent sets. Multiclass Brier must not worsen on holdout or recent sets. Over-2.5 and BTTS Brier may worsen by at most 0.002. No refit or manual parameter change follows inspection of the holdout. Weekly paired bootstrap intervals use 1,000 replicates and a fixed seed; they are descriptive, not a tuning signal.

| League | 2025 N | 2025 baseline → candidate log loss | 2026 N | 2026 baseline → candidate log loss | Decision |
|---|---:|---|---:|---|---|
| Premier League | 364 | 0.990593 → 0.989079 | 230 | 1.085356 → 1.083983 | Keep baseline: holdout BTTS worsens |
| La Liga | 357 | 0.992185 → 0.987591 | 264 | 1.015544 → 1.011070 | Apply candidate, monitor |
| Ligue 1 | 300 | 0.998536 → 0.991359 | 196 | 1.051482 → 1.043893 | Keep baseline: 2024 selection fails |
| Bundesliga | 296 | 1.050911 → 1.053887 | 196 | 0.990203 → 0.978214 | Keep baseline: selection, holdout log loss/Brier fail |
| Serie A | 354 | 1.034967 → 1.016751 | 250 | 0.994056 → 0.995913 | Keep baseline: recent log loss/Brier and holdout BTTS fail |
| Champions League | 114 | 0.999962 → 0.984137 | 78 | 0.994267 → 0.974920 | Keep baseline: training/selection sample sizes, selection log loss, holdout totals fail |

La Liga holdout accuracy falls from 54.34% to 52.38%, despite better probability scores. Recent accuracy increases from 46.97% to 49.24%. Its holdout log-loss change 95% interval is [-0.02264, +0.01594]; the recent interval is [-0.02145, +0.01055]. Both include zero. Do not call this a proven future accuracy improvement. Six-league exploration also limits certainty. Full bin reliability tables, all candidates, sample coverage and every metric are in `data/football/calibration-20260927.json`. Runtime metadata is a smaller derivative of that artifact.

## Runtime safeguards and shortcomings

- Fitted parameters apply only after artifact creation and before 2027-03-26T12:35:04Z; expiry falls back to baseline.
- Live team feeds override old archive rows. Conflicting live records are quarantined rather than silently chosen; they cannot be reintroduced from archive.
- A failed current-season feed suspends analysis. Previous-season failures may use the archive only if the archive cutoff is after that season ends. Archive use/date and low sample warnings are visible.
- A changed kickoff, venue status or team identity invalidates a displayed report immediately. Visibility resume clears the existing poll timer before starting another chain.
- Lineups, injuries, xG, opponent strength, odds and prices remain absent. No ROI claim is possible. Champions League newcomers often have too little same-competition history.
- Scoreboard capture timestamps mean receipt by this service, not provider publication time.

## Prospective evidence

Additive PostgreSQL tables store only public fixture/model data. A validated server-side snapshot must be at least 60 seconds before kickoff and freshly captured. Each fixture/start/version keeps its latest pregame snapshot; post-start writes are rejected. Final scores match on league, provider ID and exact kickoff, excluding extra time/penalties. Different kickoff times do not settle an old prediction. Storage failures are visible and cannot fabricate a success count.

This is view-driven coverage: analysis views save snapshots; visits to completed schedule dates update results. It is not a background collector for every game. The panel shows snapshot counts, per-version paired log loss/Brier/accuracy, or an explicit no-settled-data state. Historical backtests are never inserted into this ledger. There is no automatic online parameter rewrite.

## Reproduction and verification

Node dependencies use the project lockfile. Research additionally needs Python 3 with NumPy and SciPy (used here: NumPy 2.3.5, SciPy 1.17.0).

```
python scripts/collect-football-history.py
node scripts/normalize-football-history.mjs
node scripts/football-features.mjs
python scripts/calibrate-football.py
node --test tests/football.test.mjs tests/football-calibration.test.mjs
npm run build
node tests/football-http-smoke.mjs
```

The checked-in snapshot and protocol provide the reproducible input; re-downloading a live provider at a later date may produce corrections. Re-running calibration updates the artifact creation timestamp, not its fixed audit cutoff. Any future model experiment must reserve a new unseen evaluation period; the present holdout is no longer unseen after this report.
