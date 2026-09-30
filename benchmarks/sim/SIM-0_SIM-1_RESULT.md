# SIM-0 / SIM-1 RESULT — the watcher sees the world truthfully, and catches known damage

**2026-09-30.** Prereg `SIM-0_SIM-1_PREREG.md` @ 9633a15a (committed before the harness existed).
Counted runs inside the pinned worker `legasus-worker:1` (`sha256:fa49b576…`), Python 3.14.7,
`--network none`. Subject: vendored `grid.py`, sha256 prefix `b2d4e71c35e38513` (matches provenance).
Cost **$0** — no model. Verdicts: `results/SIM-0.json`, `results/SIM-1.json`.

## SIM-0 — healthy world, observe only: PASS

**0 alarms**, and every invariant was evaluated (none passed vacuously):

| invariant | evaluations |
|---|---|
| I-GEN · I-TRANS · I-HASHFN | 21,600 each |
| I-POP | 25,380 |
| I-RESET | 372 |
| I-PATTERN | 273 |
| I-HASHPAIR | 80 |
| I-KNOWN | 42 |

180 random-soup runs × 120 ticks across all 5 topologies (plane, torus, klein_bottle, mobius_strip,
projective_plane) × 3 rules (B3/S23, B36/S23, B2/S) × 3 sizes, plus API-op sequences, edge-crossing pattern
placements, hash pairs and known-pattern scenarios. 8.2 s. The watcher is observe-only, so 0 edits holds by
construction; the claim that matters is **0 false alarms**.

**The projective_plane corner ambiguity, resolved empirically as pre-declared:** the grid matched reading A
(row crossing first) exclusively 346 times, reading B exclusively **0** times, both 3,974 times (no corner
crossing mattered that tick). The implementation consistently takes the row crossing first. Recorded as
what the grid does — the spec is silent, so this is a clarification, not a defect.

## SIM-1 — eight injected defects: PASS

Every mutant applied exactly once, every mutant was caught by its designated invariant(s), every invariant
caught at least one mutant, no crashes. 3.5 s.

| mutant | fired | first detection |
|---|---|---|
| M1 generation frozen | **I-GEN only** | tick 1 |
| M2 population double-counts | **I-POP only** | tick 1 |
| M3 clear keeps generation | **I-RESET only** | first `clear()` (op #2) |
| M4 torus wrap broken | **I-TRANS + I-KNOWN only** | tick 1; blinker placed across the edge |
| M5 load_pattern stops wrapping | **I-PATTERN only** | first edge-crossing placement |
| M6 hash ignores position | **I-HASHPAIR + I-HASHFN** | first hash pair |
| M7 ages frozen | **I-TRANS only** | tick 1 |
| M8 set_dead leaks population | **I-POP only** | op #22, a `toggle` that calls `set_dead` |

Invariant → mutants that killed it: I-GEN M1 · I-POP M2, M8 · I-TRANS M4, M7 · I-RESET M3 · I-PATTERN M5 ·
I-HASHFN M6 · I-HASHPAIR M6 · I-KNOWN M4.

## Beyond the pass criteria: the alarms localise

Each defect produced a **distinct invariant signature**, with essentially no collateral firing. So the
watcher does not only say "something is wrong" — which invariants fire says *what* is wrong, and therefore
where a patch belongs. That is the diagnosis step SIM-2 needs (detect → localise → scoped patch), now shown
before any model is involved.

## What this does NOT establish

- Anything about a model patching the world — that is SIM-2 (paid).
- The other 192 modes, hex mode, or the curses app.
- Completeness of the invariant set: it is shown truthful (SIM-0) and sensitive to these eight mutations
  (SIM-1), not sensitive to every possible bug. M2/M8 (I-POP) and M4/M7 (I-TRANS) share an invariant, so
  those pairs are distinguished by WHERE they first fire (a step vs an API op; torus vs every topology),
  not by the invariant alone.
