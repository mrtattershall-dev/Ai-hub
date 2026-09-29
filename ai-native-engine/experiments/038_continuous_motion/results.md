# RD-023 results — continuous motion vs. the gate (measured 2026-07-16)

Apparatus: `motion_system.js` (ungated x/y/vx/vy in Float64Arrays, Euler + bounce,
sweep-based AABB), `gated_events.js` (events → one-tx-per-entity through the REAL
`Engine.stepTick`), `frame_budget_bench.js` (same-process arms per N; 200 frames/arm),
`h2_corruption_probe.js`. All `node <file>`, zero deps, no GPU. Laptop absolute
timings vary ~3× run-to-run (pinned project finding) — conclusions ride on
same-process ratios; absolute ms are indicative.

## The numbers

| N | A: ungated motion | B: motion+200 gated ev/frame | C: ALL motion gated (control) | control/A |
|---|---|---|---|---|
| 100  | 0.034ms* | 0.169ms | 0.164ms | 4.8×* |
| 500  | 0.005ms | 0.364ms | 0.685ms | 136× |
| 1000 | 0.007ms | 0.425ms | 1.83ms | 248× |
| 2000 | 0.014ms | 0.312ms | 3.40ms | 245× |
| 5000 | 0.039ms | 0.414ms | (not run) | — |

*N=100 pays first-arm JIT warmup; ratios there are noise, kept for honesty.
Frame budget 16.6ms (60fps): **0% of frames over budget in ANY arm at ANY N.**
Even the deliberately-naive control (every entity's motion through the full
Claim→Schedule→Validate→Commit pipeline every frame) holds 60fps through
N=2000 (mean 3.4ms, p95 6.8ms); linear extrapolation puts its 16.6ms wall
near N≈10,000. Gated-event cost in the layered arm: ~0.3–0.4ms for 200
events/frame — ~2.5% of budget. `unsafe = 0` across every arm (index
consistency + uuid/destroyed sweep after every run).

## Hypothesis verdicts

- **H1 (layering holds): SUPPORTED.** Ungated motion + gated discrete events
  stays orders of magnitude under budget at 25× the card's realistic counts
  (20 racers / 200 projectiles), with engine invariants intact throughout.
- **H2 (gate load-bearing even for motion): SPLIT, and the split lands on
  H1's side.** Probe: (a) *held-input* conflicting writes (re-asserted every
  frame) — LWW loss is unfair but bounded and self-consistent; no hidden
  accumulation. (b) *Impulse/one-shot* writes (knockback fired once) — the
  loss is **permanent, silent, divergent: the Crop-#142 class at 60fps.**
  Impulses must be gated — and impulses are by nature discrete events, i.e.
  exactly the traffic H1 already routes through the gate. The gated path is
  provably order-independent where the ungated path is arrival-order LWW
  (`crop.water` fold=max: AB and BA both → 200), and opaque conflicts defer
  (name: 1 deferral surfaced). The boundary rule that falls out: **anything
  fired once must go through the gate; only state re-derived every frame may
  live outside it.**
- **H3 (frame budget kills it): NOT SUPPORTED** at or far above realistic
  counts. The crossover is ~5× beyond the card's realistic entity counts even
  for the naive arm.

## Decision-rule branch (pre-registered, section 6 of the card)

Branch 1 fires: **layering decision — motion ungated by design, discrete
events keep the existing gate unchanged. No rewrite.** The external claim
("you'll have to redo all your work to support racing/action") is falsified
at these scales: the existing spine is the event layer of a layered
architecture, unmodified.

## Honest caveats

- The control writes quantized position into `crop.water` (the engine has no
  position fields — the vocabulary wall). This measures pipeline COST per
  gated write, which is the architecture question; it does not give motion
  real semantics. Real x/y fields await schema authoring.
- AABB is deliberately minimal; multi-body resolution, rotation, friction are
  physics-design questions out of scope per the card (§7).
- Order-independence was probed directly (AB/BA swap), not the full RD-021
  P1–P5 permutation battery; rendering, input devices, and network sync are
  untouched (§7).
- Single machine, Node 24, 200 frames/arm; absolute numbers are indicative,
  ratios are the finding.
