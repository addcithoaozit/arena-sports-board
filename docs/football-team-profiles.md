# Football team profiles

Team names and logos in football cards, plus team names in recommendations, link to `/teams/football/{league}/{teamId}`. The return link retains the selected competition and Taiwan fixture date. The existing member session gate protects both the page and `/api/football-team`.

Profiles display 5/10/20 recent results, win/draw/loss counts, goals for and against, averages, win rate, clean-sheet rate, both-teams-score frequency and over-2.5 frequency. These are unweighted descriptive statistics from completed regulation-time games in the previous 365 days, not forecast probabilities. Win rate includes draws in its denominator. Home, away and neutral venues are mutually exclusive. Empty samples display no percentage.

ESPN all-competition team schedules supply current/previous-year history. The selected competition's team schedule with `fixture=true` supplies upcoming games for both years, covering seasons that straddle January. Team identity is checked on every feed; conflicting results, missing scores, future results, extra-time/penalty finals and unrelated team families are excluded. National profiles include identified senior international friendlies; club profiles exclude friendlies. Results are deduplicated and sorted before filtering and summaries. Sources reuse the existing bounded cache and request queue.

A failed current history source returns an error instead of showing the previous year as current. An unavailable fixtures feed does not remove verified history. All kickoff times display in Taiwan time, and unconfirmed kickoff times are not presented as confirmed.

Fixtures include actual Armenia, Montenegro and Arsenal data retrieved on 2026-09-28. Regression checks cover identities, Taiwan dates, team perspective, neutral venues, invalid/history conflicts, parameter validation, cached source reuse and source failures. The front end adds no model/calibration diagnostic copy.
