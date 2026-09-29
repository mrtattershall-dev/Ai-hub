# INVARIANTS — the core's guarantees, indexed by invariant (not by path)

> **Draft companion to [MUTATION_PATHS.md](MUTATION_PATHS.md) (2026-07-18).** `MUTATION_PATHS` asks, per *ingress*,
> "does this path check everything?" This inverts it: per *invariant*, "where is this actually enforced, and where is
> it merely true because every input so far happened to satisfy it?" The thesis it operationalizes: **every bug this
> project has found was an invariant that was true by _convention_ (a prior example satisfied it) rather than by
> _construction_ (nothing could violate it) or by _enforcement_ (a check rejects violations).** A genre, a fuzzer, or a
> corrupt save is just a cheap way to build the first input that breaks a convention. This page is the list of
> conventions still standing.

## Status legend
- **CONSTRUCTION** — cannot be violated by how the code is built (e.g. a monotonic counter). No check needed; note *what assumption keeps it constructional* — that assumption is the real invariant.
- **ENFORCED** — a check rejects violations, with a localized reason, at a cited line. Never clamps/wraps (RD-018).
- **CONVENTION** — relied on by downstream code, but no check and not constructional. **This is a latent hole**: the next input that violates it corrupts state. Promote to ENFORCED or document why it can't be reached.
- **BY DESIGN** — deliberately not guaranteed (e.g. `name` is unranged); listed so it's never mistaken for a hole.

Each row also carries a **direction** note where relevant: enforcement has *two* failure modes — rejecting a bad world (does the check exist?) and rejecting a *legal* world (is the check too strong?). Both are tested separately.

---

## M0 (meta-invariant) — every ENFORCED invariant needs an ingress-coverage audit

Four times now, a safety property has held on the path exercised first and silently failed to cover a sibling path reaching the *same underlying state*. This is the failure mode this page exists to catch, and it is more load-bearing than any single row below.

| # | Property | Built on | Was missing on | Sub-shape |
|---|---|---|---|---|
| 1 | field range | wire / `submit` | `createChild` / spawn-effect props | (a) missing propagation |
| 2 | per-tick work bound | engine `tickOpsBudget` | multiplayer server ingestion | **(b) wrong tool** |
| 3 | budget cap | type count | field count (`defineType`) | (a) missing propagation |
| 4 | range **+ identity + acyclicity** | `submit` | `P.load` | (a) — range fixed 2026-07-18; **identity + acyclicity still open** |

Two distinct sub-shapes, with **different fixes** — do not conflate them:
- **(a) Missing propagation** — an identical check exists on path A and is simply absent on sibling B. Fix: add the same check. (createChild, deftype field cap, `P.load` identity/structure.)
- **(b) Wrong tool** — the *concern* spans paths but the correct enforcement is path-specific; copying A's check to B is incorrect or harmful. The server flood guard is deliberately **not** `engine.tickOpsBudget` — that sorts txs by actor name, so `sys:rule:*` sorts late and a client flood would starve the system rules and freeze the sim (`experiments/036_multiplayer/m1_server.js:272`). The right fix was a separate ingestion cap, `pendingOpsCap`. Fix: build a path-appropriate guard; don't copy.

**M0: every ENFORCED invariant on this page must enumerate the ingress paths that reach the state it protects, and confirm each path enforces it — by the same check (a) or a path-appropriate one (b). Assume at least one sibling path is uncovered until the paths have been listed.** That audit, not any single row, is the deliverable. (Concretely: the state most reached by multiple paths is *entity creation + parent wiring* — `spawn` [trusted], `submit`/`createChild` [gated], `P.load` [untrusted], `undo`/`redo` [trusted-from-journal]. I3/I4/S1 above are exactly where that enumeration already found `P.load` uncovered.)

---

## Identity (RD-004 / RD-004.6)

| # | Invariant | Live pipeline | Persistence (`P.load`, UNTRUSTED) |
|---|---|---|---|
| I1 | UUIDs are never recycled | **CONSTRUCTION** — `_mintUuid` is monotonic `_uuidSeq++` (`engine.js:199`); delete only tombstones, the row is never cleared (`engine.js:739`). | see I4 |
| I2 | Resolution returns explicit absence (live/deleted/missing), never a value | **ENFORCED** — `resolve()` (`engine.js:204`), `liveEntity → -1` (`engine.js:201`). | ✅ rebuilt from authoritative data |
| I3 | One uuid ↦ at most one live entity (`byUuid` is a function) | **CONSTRUCTION** in-process (monotonic mint) | **CONVENTION — MEASURED HOLE.** pass 1 does `byUuid.set(ent.uuid, e)` with no uniqueness check (`persistence.js:118`). A save with two rows sharing a uuid loads a *ghost live row* that `liveEntity()` can never return. |
| I4 | `uuidSeq` ≥ every uuid present (the high-water mark) | **CONSTRUCTION** (only mint advances it) | **CONVENTION — MEASURED HOLE.** restored verbatim `w._uuidSeq = obj.uuidSeq` (`persistence.js:187`), no check it exceeds live/tombstone ids. A rewound seq makes the next spawn recycle a live uuid — the RD-004 freelist bug *via save/load*. |

## Structure (RD-005.2)

| # | Invariant | Status |
|---|---|---|
| S1 | Parent graph is acyclic | **ENFORCED on reparent** — walk-up cycle check (`engine.js:722`). **CONSTRUCTION on spawn** (a new node has no children). **CONVENTION — MEASURED HOLE on load** — pass 2 wires parents with a bare `w.parent[e] = materialize(pu)` and never re-runs the cycle check (`persistence.js:181`). Load accepts a 2-cycle. |
| S2 | No silent orphan — a deleted parent's children are surfaced, not cascaded | **ENFORCED-as-surface** (`engine.js:753`). *By design* a note, not a rejection. |
| S3 | Divergent same-node reparent → defer, never double-list | **ENFORCED** (`engine.js:541`). (Was RD-021 fuzz bug #2.) |
| S4 | Capacity is never exceeded; rows are monotonic and never reused | **ENFORCED** — spawn throws (`engine.js:263`), createChild counts staged creates (`engine.js:763`), load sizes headroom + throws on stub overflow (`persistence.js:108,170`). |

## Range / Schema (RD-B2 / RD-024) — *the invariant the 2026-07-18 audit fully closed*

| # | Invariant | Status |
|---|---|---|
| R1 | Every pooled field value satisfies its declared range | **ENFORCED at every ingress** — submit/fold (`engine.js:500`), createChild props (`engine.js:770`), protocol wire (`protocol.js:177`), **load (`persistence.js:132`)**, engine backstop for in-process callers. Never wraps. |
| R2 | No cross-pool write (a field a type doesn't own) | **ENFORCED** — `engine.js:697`, `protocol.js:167`. |
| R3 | Integer-typed fields reject non-integers | **ENFORCED** — `engine.js:524` (typed arrays silently floor otherwise). |
| R4 | `orderKey` is finite | **ENFORCED** — `engine.js:511` (non-finite corrupts sibling order + doesn't survive JSON). |
| R5 | `name` is unranged / unvalidated | **BY DESIGN** — cosmetic, display-only (`MUTATION_PATHS.md` small print). Listed so it's never mistaken for a hole. |

## Determinism / Time (RD-003) — *the invariant that makes turn-based work*

| # | Invariant | Status |
|---|---|---|
| D1 | Committed state is independent of cross-actor arrival order | **ENFORCED** — deterministic total order in the scheduler (`engine.js:454`) and in tick-budget admission (`engine.js:416`). (Within-actor op order is preserved by design.) |
| D2 | No wall-clock or nondeterminism enters committed state | **CONSTRUCTION — MEASURED.** grep of `core/` finds **zero** `Date.now`/`performance.now`/`new Date`/`Math.random`/`hrtime` in the mutation path; `this.tick` is a logical counter (`engine.js:371`). Every `async`/`await` in `core/` is the *pre-gate* model-call or REPL layer (`live_loop`, `editor`, `repair`) — it produces a proposal string that then flows through synchronous `submit()`. **This is why the tick is a heartbeat and turn-based needs zero core edits: committed state is a pure function of the ordered transaction sequence.** The assumption keeping it constructional: *nothing in the gate path ever reads a clock.* |
| D3 | Fold is deterministic and order-independent | **CONSTRUCTION** — `max/min/additive/set-union` are commutative + associative (`engine.js:130`), keyed by `type.field` (`engine.js:81`). |

## Transaction / Index (RD-017)

| # | Invariant | Status |
|---|---|---|
| T1 | Derived indexes are consistent with authoritative data | **ENFORCED** — staged + committed atomically with data; `rebuildIndexes` oracle (`engine.js:212`); load rebuilds, never stores (`persistence.js:192`). |
| T2 | Atomicity — a rejected or contract-dropped tx contributes nothing | **ENFORCED** — staging plan + `dropTx` (`engine.js:838`). |
| T3 | A late-rejected tx pollutes no other tx's validation scratch | **ENFORCED** — validation fixpoint (`engine.js:675`). (Was RD-021 fuzz bug #5.) |

## Resource / Liveness

| # | Invariant | Status |
|---|---|---|
| L1 | Claim TTL is capped (no unbounded denial-of-progress) | **ENFORCED** — `engine.js:809`, `protocol.js:136`. |
| L2 | Per-tx and per-tick op budgets bound the work a tick admits | **ENFORCED** — `engine.js:391` (per-tx), `engine.js:412` (per-tick, greedy-fit, zero-footprint reject). |

## Reentrancy / Interaction — *the cross-path axis MUTATION_PATHS can't show*

| # | Invariant | Status |
|---|---|---|
| X1 | No two mutation paths interleave mid-operation ("save during GC", "save during destroy") | **CONSTRUCTION today, held by CONVENTION.** `submit`/`spawn`/`gcTombstones`/`P.load`/`P.save` are all synchronous and run-to-completion; the grep in D2 confirms none of them `await`. So the interleavings the audit worried about *cannot happen* — **but only because no mutation path yields.** Nothing enforces that. The day any of these paths gains an `await` (async persistence, a streamed load, a yield inside GC), run-to-completion breaks silently and the entire interaction cross-product opens at once. This is the single assumption to guard before any mutation path goes async. |

---

## The three MEASURED load holes (actionable)

Reproduced by execution, not argument (`scratchpad/load_invariant_probe.js`, all three ACCEPTED a corrupt save):

1. **Acyclic parent graph not re-checked on load** (S1) — load accepts a live 2-cycle `submit()` would reject.
2. **UUID uniqueness not checked on load** (I3) — load accepts duplicate uuids → a ghost live row unreachable by `liveEntity`.
3. **`uuidSeq` not validated against world contents** (I4) — a rewound seq recycles a live uuid on the next spawn.

All three are `P.load`, already classified **UNTRUSTED** by `MUTATION_PATHS.md` (a save file is corruptible/tamperable/synced). The fix shape mirrors the range fix already there: one validation pass in `load()` that **rejects the save WHOLE with a localized reason** — never repairs — asserting (a) no duplicate uuid across entities+tombstones, (b) `uuidSeq > max(all seqs present)`, (c) acyclicity after pass-2 parent wiring. This is the answer to *"can persistence create a world the live engine never could?"* → **yes, on identity + structure**; range was closed, these are not.

## The other-direction question (enforcement that's too strong)

Enforcement rejecting a *legal* world is a distinct failure from failing to reject a bad one, and the range fix creates one candidate:

- **R1-on-load under a narrowed schema.** `load` validates field values against the **current** schema's range (`persistence.js:132`). A save written when `crop.water` was `[0,255]`, reloaded after the schema author narrowed it to `[0,100]`, is rejected as `corrupt save` — though it was a fully legal world when saved. `SCHEMA_VERSION` gates the *format*, not per-field range evolution, and there is no migration step. **OPEN** — not a bug today (no narrowing path exists yet), but the moment `defineType` can narrow an existing field's range, load-of-old-save needs a migration/versioning answer, or it will reject worlds it should accept.

## How to use this page

For every **CONVENTION** row: either promote it to ENFORCED (a rejecting check with a localized reason) or write down why it's unreachable. For every **CONSTRUCTION** row: name the assumption that keeps it constructional (D2's "nothing reads a clock", X1's "nothing awaits") — those assumptions are the actual invariants, and they break silently. When any new capability lands, add its invariants here *and* check the other direction: does its new rejection ever fire on a world the engine should legally reach?
