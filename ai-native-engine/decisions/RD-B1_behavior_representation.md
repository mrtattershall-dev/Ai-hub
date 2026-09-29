# RD-B1: Behavior Representation (Closed) — the behavior spine's first expensive decision

**Question:** What does an untrusted AI emit to author *LOGIC* — a system that runs every tick — such that a deterministic validator can gate it **before it runs**? This is RD-018 (free-form vs DSL vs structured-IR) one level up: there the artifact was a data diff; here it is executable behavior, which adds failure modes data cannot have — non-termination, nondeterminism, hidden state, unbounded growth, mid-run partial mutation.

**Why it's the load-bearing decision:** the project's thesis ("agents propose, a deterministic gate disposes") was proven for data. If it cannot be extended to logic, the AI can only ever edit fields in a hardcoded schema — a data editor, not an engine. Chosen wrong, this poisons the whole behavior spine.

## Method
Four rival shapes, all compiled to the same execution point (a phase-0 `stepTick` system, or raw access for the direct rival), measured on real engines against two corpora. `experiments/025_behavior_representation/behavior_representation.js`, 40 assertions, zero deps (node:vm is built-in).

- **RULES (a)** — declarative condition→effect IR (pure data): `{match:{type,where}, every, effects:[{set,to:Expr}|{delete}|{reparent}|{spawn+cap}]}`. Statically validated: field ownership, **interval-arithmetic range proof**, required spawn caps. Loops/RNG/state are *not in the grammar*.
- **DSL (b)** — per-entity stack bytecode, **forward-only jumps** (termination provable by construction). Deliberately thin (the RD-018 DSL discipline): ownership checked, ranges not.
- **SBX-OPS (c2)** — the steelman sandbox: general JS (node:vm, 50ms fuel) that only *emits ops* into the full pipeline.
- **SBX-DIR (c1)** — sandboxed JS with direct world mutation — the industry default (Unity/Roblox/mod-Lua shape). The negative control.

**REAL corpus (R1–R8):** growth, wilt, regen, flee-at-low-hp (structural), reap, spawn-on-timer, cap, aggregate-score. Scored: can the shape state it AND does the sim observably do it (12 ticks, indexes consistent)?
**ADVERSARIAL corpus (A1–A7):** infinite loop, cross-pool write, unbounded spawn, RNG nondeterminism, out-of-range write, hidden state, mid-run crash. Outcome classes, best→worst: UNREPRESENTABLE > STATIC_REJECT > PIPELINE_REJECT > RUNTIME_GUARD > **ADMITTED** (measured corruption/hang/divergence ⇒ inadmissible).

## Proven (measured)

| shape | expressive | A1 loop | A2 cross-pool | A3 unbounded spawn | A4 RNG | A5 range | A6 hidden state | A7 mid-run crash | verdict |
|---|---|---|---|---|---|---|---|---|---|
| **RULES** | 7/8 | unrepresentable | static | static (cap req'd) | unrepresentable | **static (interval proof)** | unrepresentable | safe-by-emission | **ADMISSIBLE — 0 admitted** |
| DSL | 6/8 | static (fwd-jump proof) | static | **ADMITTED (8→1028 in 8 ticks)** | unrepresentable | **ADMITTED (999→231 silent)** | unrepresentable | safe-by-emission | inadmissible |
| SBX-OPS | 8/8 | runtime-guard only | pipeline (late) | ADMITTED | **ADMITTED (replicas diverge)** | ADMITTED | **ADMITTED (save/load changes the future)** | safe-by-emission | inadmissible |
| SBX-DIR | 8/8 | runtime-guard only | **ADMITTED (silent corruption)** | ADMITTED | ADMITTED | ADMITTED | ADMITTED | **ADMITTED (partial writes persist)** | inadmissible |

- **RULES is the only shape with zero admitted attacks.** The worst logic failures (loops, RNG, hidden state) are *unrepresentable* — rejected by the grammar's existence, not detected by analysis. The rest are rejected statically with localized `(rule, where, code, detail)` errors. Its unique capability: the **interval-arithmetic range proof** — even the subtle case (unclamped `growth+5`, reachable 260 > 255) is provably rejected *before running*, forcing the author to *state* the clamp (`min(growth+5,255)`) instead of the engine silently truncating. Measured ceiling: aggregation (R8) is inexpressible.
- **DSL proves termination** (forward-only jumps ⇒ pc strictly increases) **but is inadmissible**: it admits exponential growth (A3: 8→1,028 entities in 8 ticks, nothing statically bounds per-entity SPAWN) and silent range truncation (A5: 999→231 in the Uint8 pool). The RD-018 "thin grammar is safe only until it meets a case it can't see" failure, one level up. Also inexpressible: structural ops (no uuid operands) and aggregation.
- **Sandboxing guards the HOST, not the SEMANTICS.** SBX-OPS (the steelman) inherits op-level atomicity/ownership from the pipeline (A2 caught late, A7 crash = zero ops) — but ADMITS everything the pipeline cannot see: the hang is only runtime-killable (50ms burned *every tick*), RNG makes two replicas running the *same behavior* diverge (the P2P split-brain bug, self-inflicted), and hidden script state breaks RD-019's proven guarantee — a save/load roundtrip *changes the future* because the world is no longer the whole state.
- **SBX-DIR (the industry default) reproduces the project's entire corruption suite at the behavior layer:** silent cross-pool writes, partial mutation persisting after a mid-run crash (RD-002's immediate-mutation bug), plus all of the above.
- **Meta-finding (honest):** the first draft of this harness held the vm timeout wrong (evaluated the function under timeout, called it outside) and A1 hung the *experiment itself*. Runtime guards are easy to hold wrong; static rejection has no such failure mode.
- **Engine gap found (the RD-018 pattern recurring):** `engine.js` has **no range invariant on submit()** — protocol.js checks ranges but systems don't cross the protocol, so an in-process op with `water=999` silently truncates to 231 in the typed array. Range must become an engine invariant (defense in depth, exactly as FIELD_OWNER did in RD-018). → RD-B2.

## Decision
- **Behavior is DATA: declarative condition→effect rules (structured behavior-IR), interpreted by the engine.** Not emitted code — emitted *rules*, validated field-by-field before they ever run, with the same localized-error discipline as RD-018.
- **Safety-by-unrepresentability over safety-by-detection** wherever possible: the grammar simply lacks loops, RNG, and state. What the grammar must allow (writes, spawns) is gated by proofs: interval arithmetic for ranges, declared caps for growth.
- **Rules compile to phase-0 systems** — they flow through the unmodified Claim→Schedule→Conflict-resolve→Validate→Commit pipeline, so determinism-under-permutation, RD-005 fold/defer against players, RD-017 atomic indexes, and RD-020 one-tick-one-undo are *inherited, not reimplemented*.
- The **expressiveness ceiling is the accepted cost**, recorded honestly: aggregation (R8) — and by extension entity-to-entity interaction rules — need *bounded, statically-checkable primitives* (e.g. `count(type where pred)`), not an escape hatch to general code. That is a future card, and the direction is fixed: extend the checkable grammar, never punch a code-shaped hole in it.

## Transferable principle
For an untrusted generator authoring *logic*, prefer a representation whose dangerous constructs are **unrepresentable** to one whose dangers are detected, guarded, or sandboxed. A sandbox protects the host; it cannot make foreign code deterministic, bounded, or stateless — the three properties a replicated, undoable, persistent world actually needs from behavior.

## What remains open
- **Aggregation / interaction primitives** (the R8 ceiling): bounded `count`/`sum`/`nearest` expressions — statically checkable, adds real power. Highest-value extension.
- **Range proof precision:** interval arithmetic is conservative (a reachable-in-theory bound can reject a practically-safe rule); measure false-reject rate on a live model's output (→ RD-B3).
- **Per-tick op budget** for rules matching huge populations (cap × matched-count is bounded per rule but not yet globally budgeted) → RD-B2.
- **Engine range invariant** (the A5 gap) → RD-B2.
- Whether a *weak* model can emit valid rule-IR at all, and whether localized rule errors teach it (the RD-018.1 question for behavior) → RD-B3.
