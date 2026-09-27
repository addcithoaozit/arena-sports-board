# Sparse football history — 2026-09-27

The reported Bundesliga fixture `401884775` (Union Berlin vs SV Elversberg, October 10 Taiwan time) was waiting because Elversberg had only four same-competition results. ESPN's team-specific `all/teams/{id}/schedule?season={year}` endpoints provide its prior Bundesliga 2 results and current official cup results. A reduced, timestamped fixture with source-response hashes is committed in `tests/fixtures/football-recent-form.json`.

## Collection and model behavior

- Keep the existing current/prior-season competition feeds and archive reconciliation.
- For a team with fewer than ten same-competition results, no result within 120 days, or a failed season feed, additionally fetch its current/prior-season all-competition schedules. Requests share the bounded source queue, deduplication, timeouts and cache.
- Verify the team ID and preserve the event's competition. Only identified senior domestic league divisions and the listed official European/domestic cups are accepted. Unknown competitions and friendlies are excluded.
- Reconcile all live feeds together before the archive. Quarantine conflicts by provider event ID; neither another competition nor the archive can reintroduce the conflicted result.
- Continue requiring at least five distinct regulation full-time results per team, no older than 365 days, with a result within 120 days. Future results, the target fixture, incomplete scores, extra time and shootouts remain excluded.
- Supplement only a sparse or stale team's form. Select at most twenty recent results; cross-competition observations receive 0.35 times the ordinary exponential weight, with 90-day decay and the existing 60% venue blend. This factor is a conservative heuristic, not a fitted opponent-strength correction.
- Any prediction actually using cross-competition observations uses `football-recent-form-v1` for both sides and receives no coefficients fitted on same-competition-only features. Its calibration status is baseline/pending; it is not promoted by merely reaching five results. Healthy same-competition forecasts retain their existing parameters and probabilities.
- A failed required season feed is recovered only by a verified successful team-wide feed for that exact team and season. If neither works, probabilities stay absent.

## Display and evidence

Member cards display the matchup, valid estimates and score scenarios. Candidate status, sample warnings, fallback notes and archive/snapshot diagnostics are absent from the cards. A loading icon appears during the first request; unresolved forecasts remain empty, never fabricated. The admin panel's "賽事近況與資料診斷" shows these details for a selected date and fixture.

The pregame ledger records form counts, supplement counts, history mode and quality metadata alongside probabilities. The distinct version keeps supplementary predictions separate from the existing calibration and its historical results.

The captured reported fixture progresses from 4 away-team results to 20, including 16 from other official competitions; the home team keeps its 20 same-league results. Regression checks cover this case, unchanged healthy calibrated forecasts, team identity, friendlies, future/target/extra-time exclusions, conflict quarantine, weighting and source failover.

## Calibration acceptance

Re-running the unchanged nine-candidate experiment and frozen protocol reproduces the same promotion decisions: only La Liga passes. The other five fail specific quality or sample gates, not a lack of computation. No thresholds, production artifacts or enabled flags are changed here.

Cross-competition form is a new feature distribution and has not passed an independent historical audit. A future model should estimate opponent/division strength using a chronological development set and reserve a genuinely unseen evaluation period. The existing 2025/2026 tests have already been inspected and must not be repeatedly tuned until green. New prospective observations are recorded separately; this change does not claim improved future accuracy or implement automatic training/promotion.
