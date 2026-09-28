# UEFA Nations League

The public football selector includes `uefa.nations` (歐國聯 / 歐洲足總國家聯賽). It uses the existing football match cards, Taiwan-date navigation, 90-minute probabilities, three score scenarios, team logos and floating recommendation sheet. Recommendations consume the same eligible analysis snapshot as the card.

ESPN supplies the scoreboard and national-team schedules. Both source days overlapping the Taiwan date are fetched; event kickoff timestamps determine the displayed day. National-team history requests use the current and previous calendar years because international competitions span multi-year cycles. Requests share the bounded public-data cache and concurrency queue. A failed current-year team feed withdraws probabilities.

National-team history is isolated from club history. Accepted competitions are UEFA Nations League, UEFA EURO and qualifying, FIFA World Cup, and UEFA World Cup qualifying. Friendlies, youth/women's competitions, extra-time or penalty finals, missing scores, conflicting fixtures and future results are excluded. Team IDs must match the requested team.

The existing recent-form method uses at most 20 distinct matches from the previous 365 days, at least five per team, with a latest result within 120 days. The decay is 90 days; venue weight is 60% when enough venue matches exist, and neutral venues do not receive that split. Other eligible national competitions receive 0.35 weight. Nations forecasts use the distinct `football-national-form-v1` version. Club xG and accepted club calibration coefficients are not applied. No independent national-team calibration is claimed; admin audit views show that status and continue collecting forward snapshots.

Regression fixtures contain provider identity, kickoff and score fields retrieved on 2026-09-28, including Belgium–France and both teams' national schedules. Tests cover all 54 participating countries' Chinese names, Taiwan dates, competition isolation, insufficient history, unchanged club behavior, recommendation parity and current-source failure. The UI retains the existing policy of keeping diagnostic/model details in the admin area.
