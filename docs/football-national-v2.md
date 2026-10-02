# National football opponent model, 2026-10-02

Scope: national football analysis in both YJ and Maya. Club-league calibrated models are unchanged. Maya's BBC fallback resolves senior-country identities exactly before using the same model. UI layout and already-frozen free-trial forecasts are unchanged.

The previous fallback gave a three-match venue split 60% weight and did not adjust for opponents. The replacement jointly fits team attack/defence and a home effect using regularized independent Poisson goal models:

- log(home goals) = intercept + homeEffect / 2 + attack(home) + defence(away)
- log(away goals) = intercept - homeEffect / 2 + attack(away) + defence(home)
- Neutral venues remove both homeEffect terms.
- Maximum two-year window; exponential 180-day decay; official matches weight 1, senior friendlies 0.2.
- Ridge penalty 5 per team parameter; homeEffect penalty 10 toward zero. Parameters fixed before the evaluation below. No team-specific adjustments or bookmaker odds are used.
- At least 100 pool matches/20 teams, each target team at least five matches, effective sample >=3, and latest result within 120 days. Exclude future results, target fixture, non-regulation finals and conflicting IDs.

Initial public ESPN snapshot contains 643 regulation-time results from 54 UEFA team schedules (115 countries including opponents), as of 2026-10-02 12:48 UTC. Source schedules are bounded histories, not a claim to contain every international. Pool refreshes on request after six hours with six concurrent requests and a twelve-second overall deadline. Partial refresh cannot renew freshness; source failure uses a snapshot for at most 48 hours, then withholds probabilities. Current target-team history must also succeed. Maya retains its existing source-denial circuit breaker.

## Retrospective evaluation

58 available 2026 Nations League matches, rolling kickoff cutoffs (only earlier fixtures used), comparing the existing recent-form baseline after neutral-venue correction with the fixed candidate:

| Metric | Recent-form baseline | Opponent model |
|---|---:|---:|
| Log loss | 1.034209 | 0.999468 |
| Multiclass Brier | 0.626543 | 0.597010 |
| Most-likely result accuracy | 48.28% | 51.72% |

This uses currently available source history, not archived pregame snapshots. The small sample and potentially incomplete older schedules do not establish independent calibration or future profitability. The new version retains baseline/ongoing-validation status and a separate forecast ledger version. No market-blending weight was chosen from a single match.

France–Italy, at the audit cutoff: expected goals 1.971 / 1.238; home/draw/away 54.42% / 21.82% / 23.76%. This is a reproducibility example, not a hardcoded outcome. Inputs changing can change the forecast.

## Verification

Run `node tests/football-national-model.test.mjs`, `node tests/football-national-pipeline.test.mjs`, and `node tests/football.test.mjs`. Coverage includes duplicate/conflicting/future data, thin samples, neutral venue symmetry, bookmaker-independent country-name invariance, BBC identities, source outage, and withdrawal on current-team feed failure. New model/source pass strict TypeScript checking. Deployment must pass the full Next.js build in each repository.
