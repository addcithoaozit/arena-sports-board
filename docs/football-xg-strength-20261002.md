# Football xG and opponent-strength update — 2026-10-02

Scope: all five domestic leagues were evaluated. England already uses real Understat xG and prior-day Elo. Spain and France pass this candidate's frozen gates and are promoted. Germany and Italy retain score-market v4 because the new xG candidates fail existing gates. Champions League has Elo but no verified match-level xG source in this integration; Nations League retains its pooled opponent-adjusted model. Neither is represented as xG-enabled.

Features: prior UTC days only, up to 20 games in 365 days; exponential decay selected from 90/180 days; log scored/conceded goals, log real xG for/against, signed prior-day Elo/400. No target-game xG or manually chosen team preference. Home advantage is fitted on historical training data. Require at least five games per team and 80% xG coverage. Missing, stale, ambiguous identity or insufficient xG preserves the existing fallback. No new frontend warning blocks.

Formula: log(lambda_home) = homeIntercept + goalAttack*log(homeGoals+.1) + goalDefense*log(awayConceded+.1) + xgAttack*log(homeXg+.1) + xgDefense*log(awayXgConceded+.1) + elo*ratingDifference/400. Away uses the corresponding opposite inputs and negative rating difference. Neutral sites use the mean intercept. Rates are clipped to [.15,5] and blended with a 90-day, venue-unweighted goal-form baseline. Training-fitted bounded draw/over2.5/BTTS tilts modify one normalized score grid; all probabilities and expected scores use that same grid.

Protocol was written before fitting (docs/football-xg-strength-protocol.json). Training: 2015–2018. Selection: 2021–2022; select the best eligible 1X2 log loss candidate and save it before evaluations. Temporal holdout: 2023–2024. Previously inspected audits: 2025 and available 2026. This is a retrospective study, not prospective proof. Compare against the currently deployed model on the same evaluable fixtures. Every evaluation requires lower log loss, no higher 1X2 Brier, and <=.002 deterioration of over2.5/BTTS Brier. Gates were not changed. Runtime stores all accepted/rejected results.

Results: Spain and France pass. England's candidate fails selection, holdout and 2025 gates (keep existing accepted xG v3). Germany fails 2025; Italy fails holdout, 2025 and 2026. No claims of guaranteed future accuracy; no bootstrap significance claim is made for this candidate.

Reproduce from repository root: `node scripts/football-xg-strength/export.mjs`, then `OPENBLAS_NUM_THREADS=1 python scripts/football-xg-strength/fit.py` (NumPy/SciPy). The export uses production feature functions. Fit writes candidate/selection/evaluation artifacts beside the scripts; these do not auto-publish. Runtime activation requires reviewing the resulting gates and copying an accepted result explicitly.

Verification: five new tests compare all five leagues against independent SciPy score-grid fixtures, confirm real xG/Elo affect probabilities, enforce accepted/expiry gates, and verify production source application/missing-xG fallback. Existing 43 model/source/recommendation tests also pass. Strict TypeScript check passed before deployment.

Alavés–Atlético (401882856), using data captured 2026-10-02: old H/D/A 43.672993/24.341580/31.985427%; new 35.809456/24.480128/39.710416%. Each team has 20 real-xG records. This fixture was checked only after training/selection/evaluation; no coefficients were changed to favor Atlético.

Maya repository could not be read using the currently connected GitHub account. This release targets YJ only; Maya is not claimed updated.
