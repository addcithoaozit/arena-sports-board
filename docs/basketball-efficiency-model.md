# Basketball efficiency and Monte Carlo model

Implements the win-probability portion of the supplied 籃球賽事預估模型與演算法運算規格書.docx. On 2026-09-30 (Taipei), the user explicitly directed WNBA to use the same parameters as NBA. Both use alpha 4, a 2.5 home bonus in projected points per 100 possessions, and normal margin sigma 10.5. There is no home bonus at neutral venues. These are specified parameters, not fitted or calibrated accuracy claims.

## Inputs

For each team, use its latest 20 completed regular/postseason games before the forecast cutoff, with at least 8 required and the latest game no more than 210 days old. Keep NBA and WNBA identities, feeds, and caches separate. Never use a future game, preseason result, or a partially fetched set of recent games to fill an input.

ESPN game summaries supply FGM/FGA, 3PM/3PA, FTM/FTA, offensive rebounds, total turnovers, final scores and period counts. All box scores must reconcile with the schedule's IDs, league, teams, date and final points. Estimated possessions for each game are the average of the two teams' `FGA + 0.44*FTA - OREB + total turnovers`. These are box-score estimates, not NBA.com's proprietary possession counts.

Compute ORtg and DRtg as aggregate points scored/allowed per 100 estimated possessions. Pace is possessions per regulation-game duration: 48 minutes for NBA, 40 for WNBA, removing overtime inflation using five minutes per overtime. Three-point percentage is 3PM/3PA, free-throw rate is FTA/FGA. Three-point attempt rate is recorded for audit; the document's actual adjustment equation uses accuracy only, so attempt rate is not given an extra undocumented coefficient.

Definitions reference: https://www.nba.com/stats/help/glossary and https://jr.nba.com/basictraditional-stats-vs-advanced-stats/ .

## Formula decisions

The document permits standardized or relative differences but does not specify the reference distribution. Use each metric's pooled per-game population standard deviation across the two teams' selected samples. Divide the difference in team aggregate metrics by that standard deviation; use zero when there is no variation. This avoids adding raw efficiency points to fractional shooting percentages. All five nonnegative slider values are normalized to sum to one; reject an all-zero set.

- Projected pace = average of the teams' paces.
- Final pace = projected pace * (1 + (tempo weight - 0.20) * 0.1).
- Home baseline = ((home ORtg + away DRtg)/2 + HCA) * final pace / 100.
- Away baseline = ((away ORtg + home DRtg)/2) * final pace / 100.
- Adjustment = 4 * (offense weight * standardized ORtg difference + defense weight * standardized reverse DRtg difference + three-point weight * standardized accuracy difference + free-throw weight * standardized FT-rate difference).
- Final home = home baseline + adjustment; final away = away baseline - adjustment.

The document computes Final Pace but omits it from its last score equation. Recompute the baseline with Final Pace so the tempo control actually changes scores. Default 20% tempo leaves the original baseline pace unchanged.

## Simulation and presentation

Interpret sigma 10.5 as the standard deviation of final scoring margin. Simulate 10,000 normal margins around the unrounded final-score difference using 5,000 antithetic pairs. A seed based on the league and fixture makes repeated requests stable. Antithetic pairs preserve symmetry and prevent Monte Carlo noise from reversing the expected winner. Report the frequency of positive margins as home win rate, its complement as away win rate, and the margin distribution's 10th/50th/90th percentiles. Do not use the rounded displayed score to compute probability or choose a team.

Both main cards and the floating pane validate the returned normalized-weight key. Hide results immediately when controls change, on stale/started fixtures, or while the required inputs are unavailable. Never fall back to the old recent-results formula when efficiency data fails. Historical pure-model helpers remain only for regression compatibility; the live analysis routes invoke this model.

Completed box-score facts are cached in a bounded shared cache for 24 hours, keyed by league/fixture/final scores; source requests have concurrency, queue, time and body-size limits. Cold analysis requests may need to load up to 40 summaries. Weight changes reuse the validated boxes.

The user's request was to compute win probabilities. Market settlement rules, +EV triggers and Kelly stake sizing in the document are outside this change; existing winner recommendations are not represented as +EV bets.
