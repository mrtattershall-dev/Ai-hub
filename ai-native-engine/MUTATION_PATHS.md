# MUTATION_PATHS — every state transition into the engine, on one page

> **Why this exists (2026-07-18).** The engine proves "every value satisfies its schema" — but that proof
> lived in `submit`/`installRule`/`defineType` and silently did NOT cover two transitions BETWEEN components:
> `createChild` props and `P.load`. Both were real holes (out-of-range values wrapped into the pools). The
> lesson (reviewer's): every individual component was correct; a *transition* wasn't. So this is the map of
> EVERY way world/schema/rule/claim state can change. **The rule: a mutation path not on this page is
> tomorrow's bug. Any new ingress must be added here and pass every column before it ships.**

## The invariant checklist (columns)
- **RANGE/SCHEMA** — does it reject a value/op that violates the declared schema (range, type-ownership, structure)? never wrap/clamp (RD-018).
- **DET** — deterministic + order-independent across actors (RD-003)?
- **PERSIST** — does the change round-trip through save/load, or is it correctly ephemeral by design?
- **INDEX** — leaves derived indexes + identity consistent (RD-017/004.6)?
- **TRUST** — is the path reachable from UNTRUSTED input (a network client, a save file, an AI-authored rule), or trusted-internal only?

## The paths

| Path | Trust | RANGE/SCHEMA | DET | PERSIST | INDEX | Notes |
|---|---|---|---|---|---|---|
| **`submit(batch)`** — ops: `setfield`/`createChild`/`delete`/`reparent`/`move`/`claim` | UNTRUSTED | ✅ range on setfield; **✅ createChild props (fixed 2026-07-18)**; type-ownership; cross-pool; parent liveness; capacity; acyclicity | ✅ RD-003 | ✅ ops journal → undo | ✅ RD-017 staged | THE gated pipeline. `move`→orderKey setfield; `reparent` cycle-checked. Unknown-field setfield **rejected (fixed 2026-07-18)**, was a commit-time throw. |
| **`stepTick(extra)`** — system rules → ops | mixed (rules UNTRUSTED via `installRule`; extra = client txs) | ✅ inherits `submit` | ✅ | ✅ one tick = one undo step | ✅ | Rules author ops that flow through `submit` — inherits everything. |
| **`spawn(type, props)`** — direct entity creation | **TRUSTED-ONLY** | ⚠️ **NO range check in `spawn` itself** — writes props straight to pools | ✅ | ✅ | ✅ | The createChild hole's ROOT. Safe ONLY because untrusted creation now routes through `createChild` (which validates props BEFORE calling spawn). **If any future path calls `spawn()` directly with untrusted props, that is a hole — this is the line to watch.** |
| **`P.load(snapshot)`** — reconstruct a world from a save | UNTRUSTED (a save file: corruptible / tamperable / synced) | **✅ field ranges (fixed 2026-07-18)**; orderKey finiteness (RD-B6.1); parent re-materialization | ✅ fork-deterministic (RD-B6.1 P6) | — (is the load) | ✅ rebuilt on load (RD-019) | Was a real hole: `hp=999` loaded as `231`. Now rejects a corrupt save WHOLE with a localized reason. |
| **`defineType(spec)`** — author the SCHEMA | UNTRUSTED (wire `deftype`, AI) | ✅ name/field/range/fold/spatial/init + **FIELD_BUDGET(64)** + 256-type cap; atomic, reject-byte-identical | ✅ | ✅ schema travels in save | ✅ | RD-024. |
| **`installRule(src)`** — author BEHAVIOR | UNTRUSTED (wire `rule`, AI propose) | ✅ THE RANGE PROOF over effects; type/aggregation; **✅ spawn-effect props (fixed 2026-07-18)**; + RD-035 write-smell warnings | ✅ | ✅ rule SOURCE persists, re-validated on load (RD-B6) | ✅ | Rejected rule never registers. |
| **`uninstallRule(name)`** | UNTRUSTED (wire `uninstall`) | ✅ localized error if absent | ✅ | ✅ | ✅ | Removes system + source. |
| **`releaseActor(actor,{grace})`** — claims | trusted (disconnect) | ✅ RD-022 grace | ✅ | claims ephemeral by design | ✅ | — |
| **`gcTombstones()`** | TRUSTED (server tick) | n/a (drops only, reachability-checked) | ✅ | ✅ | ✅ RD-019.1 refcount | Never drops a referenced tombstone. |
| **`undo()`/`redo()`** | TRUSTED (from the engine's own journal) | n/a (replays validated inverse deltas) | ✅ | history ephemeral by design | ✅ identity-preserving RD-020 | Delete-undo resurrects the SAME uuid. |
| **wire: `sanitizeOps`→`submit`** | UNTRUSTED (network) | ✅ shape-check → `submit` (inherits all above); **✅ per-tick client-op cap (flood guard, fixed 2026-07-18)** | ✅ | ✅ | ✅ | 32 ops/message; `pendingOpsCap` bounds the tick. |

## Universal (non-pooled) fields — the small print
`name` (string, cosmetic — unranged), `parent` (validated: liveness/cycle), `orderKey` (validated finite, RD-B6.1),
`uuid`/`refs`/`type` (RESERVED — cannot be a schema field). `name` is the one field a setfield writes without a
range/type check; it is display-only, but worth noting it is unvalidated.

## Status after the 2026-07-18 stress-audit
**Every UNTRUSTED ingress now validates field ranges** — the "every value satisfies its schema" invariant holds
across `submit`, `createChild`, `installRule`/spawn-effects, `defineType`, `P.load`, and the wire. The three
transitions that broke it (createChild props, spawn-effect props, load) are closed and regression-tested
(`experiments/051_safety_patches/patch_test.js`). The one path to keep watching: **direct `spawn()` is trusted-only
and unchecked** — never route untrusted input to it; use `createChild`.

## How to use this in a future audit
For every row ask: does it validate? is it deterministic? does it persist/replay? does it keep indexes+identity
consistent? Any NEW message type, op kind, or public method that mutates state MUST be added as a row and answer
every column. If it can't, it's the next bug — find it here, not in production.
