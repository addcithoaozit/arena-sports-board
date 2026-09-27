# External football data experiment, 27 September 2026

Current update: Bundesliga and Serie A passed the separate second-round score model; see [football-market-calibration.md](football-market-calibration.md). This document preserves the first-round findings.

This update adds a second source of match facts and a separate, frozen model experiment. It does not force every league to pass. English Premier League, Ligue 1 and Champions League candidates passed the pre-recorded gates. La Liga keeps its existing accepted v2 model; Bundesliga and Serie A keep their previous baseline / recent-form fallback.

## Sources and identity

- Understat public league pages and their public `getLeagueData/{slug}/{season}` GET endpoint: five domestic leagues, 2014–2026 seasons. We retain completed match scores and actual match xG, never Understat's forecast probabilities. The normal AJAX headers reproduce the public page request. Requests are bounded and cached for 30 minutes; failures do not fabricate freshness.
- OpenFootball Champions League, CC0: https://github.com/openfootball/champions-league at revision `abfaeddc2ee3d14f99ecc163c9ddb46cb4d67cef`, `2011-12/cl.txt` through `2025-26/cl.txt`. Date-only records cannot enter target-day features. Extra time / penalty records are excluded; finals and the 12–23 August 2020 Lisbon final-eight tournament are neutral. The four 7–8 August round-of-16 matches retained home grounds.
- ESPN supplies fixture/team identities, current-season scores and a cross-check of overlapping history. External team IDs use an explicit reviewed mapping. There is no fuzzy name matching at request time.
- Football-Data.co.uk CSVs were not downloaded or used because its published access policy excludes this use.

The pinned normalized archive contains **23,810 matches** from 80 successful source captures. Every capture has a URL, timestamp and SHA-256. The collection cutoff is 2026-09-27T14:47:05.960166Z. The parser reported zero unparsed scored Champions League rows, excluded 24 extra-time/penalty records, 1,603 unplayed records, and two cross-provider conflicts.

Cross-checking recent overlaps found 10,834 matching score fixtures. Two disagreements are quarantined by both team identities and day, including when a third feed would otherwise reintroduce them: Leipzig–PSG in November 2021 and Union Berlin–Bochum in December 2024. We do not choose a preferred score without adjudicating the discrepancy. Quarantining these records changed later Elo audit inputs but did not change any fitted parameters, selected candidates or independent 2019–2020 holdout result.

## Frozen experiment

The protocol was recorded before fitting at 2026-09-27T14:48:16.715869Z in `football-external-protocol.json`.

- Domestic leagues: 2014 warm-up, 2015–2016 fit, 2017–2018 candidate selection.
- Champions League: 2011 warm-up, 2012–2016 fit, 2017–2018 selection.
- New independent historical test: 2019–2020, first inspected in this experiment.
- 2025 and 2026 had been inspected in the earlier experiment; they are disclosed as additional audits, not newly unseen test sets.
- Two decay periods, two venue weights and four baseline blend weights were fixed in advance (16 candidates). Fitted parameters see only training outcomes. Candidate selection sees only 2017–2018.
- Rolling 365-day / maximum 20-match goal and xG form, prior-day Elo with annual shrinkage, venue weighting and joint Poisson / Dixon–Coles score likelihood. No target-match xG, future scores, closing odds or supplier forecasts.
- Both teams need at least five matches and a latest result within 120 days. The xG model also needs at least five xG matches covering 80% of that team's sample. Champions League makes no xG assumption.
- Selection, holdout and both recent audits must improve 1X2 log loss and not worsen multiclass Brier; totals and BTTS Brier may rise by at most the pre-existing 0.002 tolerance. Minimum train/selection/test/audit samples are enforced. La Liga recent audits compare against its already deployed calibrated model.

| League | Training | Selection | Independent test | 2025 audit | 2026 audit | New candidate |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Premier League | 730 | 743 | 686 | 364 | 230 | Accepted |
| Ligue 1 | 732 | 727 | 620 | 300 | 197 | Accepted |
| Champions League | 338 | 129 | 115 | 116 | 78 | Accepted |
| La Liga | 730 | 741 | 718 | 357 | 264 | Rejected: 2025 totals and BTTS Brier |
| Bundesliga | 583 | 601 | 551 | 296 | 196 | Rejected: holdout BTTS Brier |
| Serie A | 749 | 742 | 679 | 354 | 250 | Rejected: 2026 totals Brier |

Weekly block bootstrap intervals (1,000 repetitions, fixed seed) are reported. Several intervals cross zero, especially recent audits and Champions League: gate acceptance is not proof of a reliable future advantage. Historical records may have been corrected after the match. Forward snapshots remain the separate post-deployment evaluation; no profitability claim is made.

## Runtime and fallback

`football-external-v3-20260927-r1` is enabled only for the three accepted leagues, for 90 days. Fresh valid source retrieval, exact current team identity, regulation-only results and feature coverage are checked for every prediction. The entire current UTC day is excluded. Score conflicts are removed, not averaged, and duplicate providers cannot inflate sample counts. Current fixture IDs stay ESPN IDs.

External goals may fill a missing base-model history even when xG coverage is insufficient, without claiming xG validation. Unaccepted, expired, stale, unmapped or insufficient-data cases retain the existing model path. The independent cross-competition fallback remains unvalidated as before. The front match cards receive no new diagnostic text; the admin model panel shows source coverage, actual model used, failures, full metrics and uncertainty. Saved pregame forecasts include external-source metadata and model version.

All sources are fetched on demand with cache and request coalescing. There is no new paid service, background job or automatic retraining/promotion. Lineups, injuries and actual bookmaker markets remain absent. Dates describe retrieval, not the provider's own freshness guarantee.

## Reproduction

The checked-in normalized archive is the reproducible feature input; raw responses are deliberately excluded from Git. Fresh downloads may contain provider corrections and must not silently replace the pinned experiment.

```sh
python scripts/collect-football-external.py
python scripts/normalize-football-external.py
node scripts/football-external-features.mjs
python scripts/calibrate-football-external.py
node --test tests/football-external.test.mjs
```

To reproduce the frozen fit, run the last three commands against the checked-in archive (the feature script creates `.football-research` if needed). Do not use already inspected holdout/audit outcomes to retune failed candidates. A future iteration needs genuinely new prospective observations or another pre-declared untouched test period. See the full calibration artifact, source metadata and protocol hashes for exact values.

## Venue correction after first audit

The original frozen protocol overstated the scope of the August 2020 neutral tournament. UEFA confirmed the four remaining round-of-16 second legs stayed at home grounds: https://www.uefa.com/uefachampionsleague/news/025f-0fd672616416-78aef0820533-1000--round-of-16-venues-confirmed/ . The four labels were corrected together after the initial audit; the original protocol remains intact and `football-external-venue-correction.json` records this erratum. All fitted coefficients, training metrics, selection metrics, candidate choices and thresholds are unchanged. The corrected independent Champions League holdout Log loss is 0.959232 → 0.910497 (115 matches). Recent audits were regenerated as Elo propagates the correction. All acceptance decisions remain unchanged. This is a disclosed data correction after test inspection, not a fresh unseen test. The r1 version preserves the original creation and expiry dates.
