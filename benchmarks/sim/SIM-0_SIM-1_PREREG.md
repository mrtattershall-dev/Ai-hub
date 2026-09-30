# SIM-0 / SIM-1 — can the watcher see a running world truthfully? FROZEN before the harness is written.

**Frozen 2026-09-30.** $0 — no model is involved. Harness `benchmarks/sim/sim_watch.py` (written after
this file). Subject: the `Grid` core of life-simulator (MIT, Changkun Ou), vendored unmodified under
`vendor/life/` — see `vendor/PROVENANCE.md`.

## The question

Before the watcher deserves model edits: **can it observe a healthy running world without hallucinating
damage (SIM-0), and does it catch known damage when it appears (SIM-1)?** An observer that raises false
alarms would make a later patching loop edit working code; an observer that misses damage would let a
later patching loop keep broken code. Both are ruled out here, before any spend.

## Doctrine: observe from outside

The checker never asks the possibly-broken program whether it is broken. It reads only the raw world state
(`grid.cells`) and the declared configuration (`rows`, `cols`, `topology`, `birth`, `survival`), and
computes every expected value with its OWN implementation written from the spec — the class docstrings and
comments — not by calling or copying `Grid` methods. Pattern shapes (`life/patterns.py`) are data and are
read directly.

## Environment

The counted runs execute inside the pinned Docker worker (`legasus-worker:1`,
`sha256:fa49b576…08a8c3`, Python 3.14.7, `--network none`), stdlib only. Development runs on the laptop
do not count.

## Invariants (the watcher's declared contract)

| id | invariant | checked |
|---|---|---|
| **I-GEN** | `generation` increases by exactly 1 per `step()` | every tick |
| **I-POP** | `population` equals the checker's own count of live cells | every tick and after every API op |
| **I-TRANS** | the post-step world equals the checker's own next-state computation (B/S rule, topology wrap, ages: survivors +1, births 1) | every tick |
| **I-RESET** | after `clear()`: generation 0, population 0, no live cells | every `clear()` |
| **I-PATTERN** | `load_pattern(name, dr, dc)` on an empty grid places exactly `{((r+dr) mod rows, (c+dc) mod cols)}` | every placement, including edge-crossing offsets |
| **I-HASHFN** | `state_hash()` is a function of the live-cell positions: equal sets → equal hash, different sets → different hash (tracked over each run) | every tick |
| **I-HASHPAIR** | two grids with equal population and different positions hash differently; equal positions with different ages hash equally | dedicated scenario |
| **I-KNOWN** | on the torus: blinker has period 2, block is still, glider returns to its own shape translated by (±1,±1) after 4 steps, placed so it crosses an edge | dedicated scenarios |

**Non-vacuity:** SIM-0 reports how many times each invariant was EVALUATED. An invariant with zero
evaluations is not a clean pass and fails SIM-0.

**Spec ambiguity — decided now, not after seeing data.** The `projective_plane` docstring ("both axes
wrap with a flip on the opposite axis") does not say what happens when a neighbour is outside BOTH axes at
once (a corner crossing). The checker computes both readings (row-first, column-first) and I-TRANS passes
if the grid matches either; which one it matched is recorded. `klein_bottle` and `mobius_strip` have no such
ambiguity (klein's two orders coincide; mobius has hard row edges).

## SIM-0 — healthy world, observe only

Unmodified Grid. All 5 topologies × 3 rules (B3/S23 Conway, B36/S23 HighLife, B2/S Seeds) × sizes 8×8,
9×14, 16×16 × random soups (fixed seeds) × 120 ticks, plus API-op scenarios (set_alive / set_dead / toggle /
load_pattern with edge-crossing offsets / clear, interleaved with steps) and the I-HASHPAIR / I-KNOWN
scenarios.

**PASS iff: 0 alarms, and every invariant evaluated > 0 times.** The watcher has no edit capability in
SIM-0, so "0 edits" holds by construction; the claim that matters is 0 false alarms.

A disagreement is reported with the exact coordinates and the two values — never tuned away. If it traces
to the checker, the checker is wrong and SIM-0 fails until fixed and re-run; if it traces to the Grid, it
is a real defect finding.

## SIM-1 — injected damage

Each mutant is a single exact text substitution in a copy of `grid.py`; the harness asserts the anchor
occurs **exactly once** (a mutant that did not apply cannot "escape"). Each runs the SIM-0 battery at
reduced size.

| mutant | substitution | MUST be caught by |
|---|---|---|
| M1 generation frozen | `self.generation += 1` in `step()` removed | I-GEN |
| M2 population double-counts | survivors `pop += 1` → `pop += 2` | I-POP |
| M3 clear keeps generation | `self.generation = 0` removed from `clear()` | I-RESET |
| M4 torus wrap broken | torus branch `r % rows, c % cols` → clamp to the edge | I-TRANS and I-KNOWN |
| M5 load_pattern stops wrapping | `(r + offset_r) % self.rows …` → unwrapped | I-PATTERN |
| M6 hash ignores position | `alive.append(r * self.cols + c)` → `alive.append(0)` | I-HASHPAIR (and I-HASHFN) |
| M7 ages frozen | survivors `self.cells[r][c] + 1` → `self.cells[r][c]` | I-TRANS |
| M8 set_dead leaks population | `self.population -= 1` removed | I-POP |

M7 and M8 exist so that every invariant is shown able to fail by at least one mutant.

**PASS iff:** every mutant is caught by its designated invariant(s); every invariant catches at least one
mutant; and SIM-0 (the clean control) raised 0 alarms. Also recorded: every invariant that fired per mutant
(collateral detection), and detection latency — the first tick or op at which the designated invariant
fired. Latency is telemetry, not a pass criterion.

## What SIM-0/SIM-1 do NOT establish

- Anything about a model patching the world (that is SIM-2, which is paid).
- The other 192 modes, hex mode, or the curses app.
- That the invariant set is COMPLETE. It is shown to be truthful (SIM-0) and sensitive to these eight
  mutations (SIM-1) — not sensitive to every possible bug.
