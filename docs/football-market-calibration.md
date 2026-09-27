# Second-round Bundesliga and Serie A calibration

`football-market-v4-20260928` is accepted for Bundesliga and Serie A under the same numeric gates as the prior experiment. EPL, Ligue 1 and Champions League retain external v3; La Liga retains its existing v2. The rejected v3 candidates remain documented, not relabeled as accepted.

## Problem and model change

Bundesliga v3 failed 2019–2020 BTTS Brier: +0.002063 versus the allowed +0.002. Serie A v3 failed 2026 over-2.5 Brier: +0.004444. Mean-goal improvement alone did not deliver adequate probability distributions across all displayed markets.

V4 uses score history and Elo with an adaptive league scoring level, without depending on xG availability. Prior-year league home/away scoring rates provide rate offsets; team goal form is normalized to the corresponding venue-weighted league expectation. This adapts to changes in league scoring and home advantage without learning from future outcomes.

Optional bounded over-2.5, BTTS and draw factors exponentially tilt one joint Poisson/Dixon–Coles score distribution. All market probabilities, expected goals and displayed scorelines come from that same normalized distribution. The German selection chose zero tilts; Italy selected nonzero tilts. There are no contradictory per-market probability patches.

## Sources and data quality

46 ESPN public annual scoreboards, 2004–2026, were captured with URL, timestamp and SHA-256. `market-history-20260928.json` contains 15,508 regulation league finals, in native ESPN team identity space. This is a separate overlapping archive, not 15,508 net-new matches in addition to v3.

- `season.slug` and competition notes exclude playoffs, relegation playoffs and qualifying phases.
- Non-finals, invalid/missing scores, AET and penalties are excluded.
- Duplicate fixture identities within a league/season and conflicting event IDs are quarantined, not arbitrarily preferred. Three fixture keys are excluded, including the previously unresolved Union Berlin–Bochum awarded/on-field discrepancy.
- 7,285 mapped overlaps agree with the existing Understat score archive. Earlier ESPN records are not claimed to be independently cross-checked where there is no second mapped source.
- No odds, provider forecasts, lineups, synthetic missing xG or post-match target xG enter the model.

## Frozen selection and independent test

`football-market-protocol.json` was written before fitting. Selection is a separate command from audit; the chosen candidate file was hashed before the audit opened.

| Stage | Dates | Germany | Italy |
| --- | --- | ---: | ---: |
| Warm-up | 2004 | — | — |
| Training | 2005–2009 | 1,457 | 1,833 |
| Parameter selection | 2010–2011 | 592 | 726 |
| New independent holdout | 2012–2013 | 587 | 745 |
| Previously inspected audit | 2019–2020 | 551 | 679 |
| Previously inspected audit | 2025 | 296 | 354 |
| Recent audit | 2026 to cutoff | 196 | 250 |

The new holdout was not used in earlier domestic-league experiments. All fitting years precede it. The 2019–2020 and 2025/2026 data have already been inspected and are explicitly additional audits. Their failure diagnostics informed the general model design, but they were not used to select among the new candidates.

Each league had 96 predeclared combinations: two decay periods, two venue weights, three regularization strengths, optional market tilts and four fitted/base blend weights. Only training outcomes fit coefficients. On 2010–2011 selection data, candidates must satisfy all gates; choose one by the equal-weight sum of candidate/base ratios for 1X2 log loss, 1X2 Brier, over-2.5 Brier and BTTS Brier. The selected file SHA-256 is `a566d5cda5eee18cb61dcb2cfc85e1de2f34c22c961c15b461fe0252347113c4`.

Every selection, holdout and audit period must improve 1X2 log loss, not worsen 1X2 Brier, and increase either binary Brier by no more than 0.002. Minimum sample sizes remain train 180, selection 80, holdout 160 and each audit 60. Both leagues passed all gates with the first locked candidates; no second candidate was tried after opening the holdout.

| League / period | Log loss change | 1X2 Brier change | Over-2.5 Brier change | BTTS Brier change |
| --- | ---: | ---: | ---: | ---: |
| Germany 2012–2013 | -0.020864 | -0.013804 | -0.006859 | -0.001946 |
| Germany 2019–2020 | -0.015806 | -0.010124 | -0.000764 | +0.000389 |
| Germany 2025 | -0.033655 | -0.023492 | -0.002450 | -0.005844 |
| Germany 2026 | -0.016411 | -0.009257 | -0.005042 | -0.001348 |
| Italy 2012–2013 | -0.025295 | -0.016309 | -0.006396 | -0.004216 |
| Italy 2019–2020 | -0.019852 | -0.012969 | -0.003740 | -0.005784 |
| Italy 2025 | -0.034766 | -0.023226 | -0.007840 | -0.004227 |
| Italy 2026 | -0.012865 | -0.008272 | -0.000025 | -0.001658 |

Lower errors are better. The German 2019–2020 BTTS increase is within the pre-existing tolerance, not an improvement over baseline. Italy's 2026 totals improvement is extremely small; do not describe it as a proven predictive edge. Weekly block bootstrap intervals use 1,000 resamples and a fixed seed, are disclosed in the admin UI/artifact and are not optimization targets. Acceptance is not a guarantee of future accuracy or profitability.

## Runtime

Runtime uses the same regular-phase parser, exact IDs, prior-UTC-day cutoff, 365-day/20-match form, Elo, league-rate offsets, parameter blend and score distribution. At least five recent matches per side (latest <=120 days) and 180 league matches are required. The current fixture must agree with a fresh full annual feed on both identities, kickoff and scheduled state. Annual source fetches are cached for 30 minutes and bounded to two concurrent requests; missing/invalid current feeds cannot activate the model from the static archive alone.

The runtime preserves the established base/recent-form analysis for unsupported, expired, stale or sparse cases. A passed league model is not a guarantee every fixture has enough data. Source failures, individual coverage and full audit records are confined to the admin panel. No new diagnostic copy is added to front match cards. Existing pregame snapshot storage already records the new version and source metadata.

## Reproduction and verification

Use the checked-in normalized archive to reproduce the frozen experiment. Recollecting mutable provider responses may produce corrected results and requires a new study, not silent replacement.

```sh
node scripts/football-market-features.mjs
python scripts/calibrate-football-market.py --select
python scripts/calibrate-football-market.py --audit
node --test tests/football-market.test.mjs
```

For a fresh source capture, run `python scripts/collect-football-market-history.py` and `node scripts/normalize-football-market-history.mjs`. Test and audit sets must not be repeatedly used to tune future versions. The two-stage command layout is intentional.

Validation includes analytic partition probabilities against direct independent SciPy score-grid summation at 40 fixed random parameter settings; TS runtime against SciPy fixtures; normalization, neutrality, future-day exclusion, validity windows, exact fixture identity, source outage fallback, duplicate quarantine and all fixed acceptance gates. The broader football regression suite and admin-only HTTP smoke are also run before deployment.
