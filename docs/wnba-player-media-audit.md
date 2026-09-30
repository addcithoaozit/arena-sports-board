# WNBA player media and data audit

Checked 2026-10-01 (Asia/Taipei). Source: https://www.wnba.com/players

All 221 players in 15 ESPN team rosters matched unique official WNBA player identities. ESPN IDs and WNBA IDs are different and are kept separate. 21 existing ESPN headshot URLs returned 404. 15 official headshots and 3 official draft portraits repair 18 of them. Six official headshot responses returned the same 12,531-byte silhouette; HTTP 200 alone was not counted as a real photograph.

## Repaired missing photos

- Ornella Bankole
- Maria Conde
- Ndjakalenga Mwenentanda
- Shyanne Sellers
- Matilde Villa
- Juste Jocyte
- Alicia Florez
- Raquel Carrera
- Marine Fauthoux
- Michelle Onyiah
- Jordan Harrison
- Teja Oblak
- Nell Angloma
- Valeriane Ayayi
- Shay Ciezki
- Kara Dunn
- Jovana Nogic
- Saylor Poffenbarger

## No real headshot located on checked official player/team/draft pages

- Elena Buenavida — https://www.wnba.com/player/1643825/elena-buenavida
- Aminata Gueye — https://www.wnba.com/player/1643832/aminata-gueye
- Morgan Maly — https://www.wnba.com/player/1642835/morgan-maly

## Data enrichment

Official directory fills 38 missing weight values and 12 school/previous-affiliation values. Country, draft year and current-season points/rebounds/assists appear where supplied. 63 weights, 32 school/affiliation entries and 2 countries remain absent from both checked feeds; these are not inferred. One roster entry (Eliska Joklova) has no official team assignment, so current team statistics are withheld.

Stable identity/bio snapshots keep photos available during official source failures. Live statistics require matching season and team and never fall back to the snapshot. Default CDN headshots use official IDs; three reviewed draft portraits have explicit source URLs in data/wnba-player-identities.json. The UI uses returned photo/link fields and retries the alternative real-photo provider after image load failure.
