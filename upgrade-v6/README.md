# Opponent-adjusted xG v6 audit

All four candidates failed at least one frozen gate. These files do not enable
any production model. `*-evaluation.json` and `*-selection.json` are the original
2026-10-02 evaluation/selection records. Do not overwrite them or lower gates.
Domestic outcomes had already been examined in previous versions; those audits
are regression checks, not pristine holdouts.

Source refreshes after the audit can change regenerated inputs. Keep a new run
in a separately named output directory and label its data date. Do not repeatedly
select parameters using the same holdout results.

Reproduce feature preparation from repository root (Node 24, TypeScript 5.9):

    python upgrade-v6/prepare-cups.py
    node upgrade-v6/export-cups.mjs uefa.champions uefa.nations
    node upgrade-v6/export-domestic.mjs

Fit in a new output directory with Python, numpy and scipy:

    python upgrade-v6/fit.py --output-dir /tmp/football-v6-new-audit ger.1 ita.1 uefa.champions uefa.nations

The complete chronological protocol is in
`docs/football-xg-opponent-v6-protocol.json`; its SHA-256 is included in each
result. The national cross-competition feature scope was recorded before its
first fit in `national-data-scope.json`. Goals, xG and opponent history are all
strictly from earlier UTC dates. No live odds or present-match results are used.
