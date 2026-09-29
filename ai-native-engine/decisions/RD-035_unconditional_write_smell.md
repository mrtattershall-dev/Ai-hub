# RD-035 — the unconditional-write smell (a standing author-time check) + the deftype gate audit

**Status: DECIDED (2026-07-18).** Born from the user's live Pong session and the review that followed it. Two things ship: (1) a NAMED, tested, author-time advisory for the *branchless-conditional-write* pattern, surfaced by the gate and the editor; (2) the adversarial audit of the `deftype` third mutation channel that the prior session skipped "for context", plus a parent-assumption audit across every subsystem. Everything below is measured (`node <file>`), not reasoned.

## The finding: a branchless conditional write is still an unconditional write

Pong's `paddle_move` matched **every** paddle with **no `where` guard** and wrote `y` every tick as `clamp(y + input_dir*speed)`. When `input_dir == 0` (an idle paddle) that is a write of `y`'s **current value** — a no-op *value*, but still a *write*, so it enters RD-005 arbitration. The editor's flagship command "move left paddle down" issues a direct `setfield y=136`; it landed in the same tick as the rule's no-op `y=128` write, RD-005 correctly **deferred both** (two writers, no fold on a position field), and the paddle never moved. The command that `intent2` was built to make work was silently defeated in the very world it was built for.

Measured (`experiments/042_pong/_probe`, folded into `intent2_e2e_pong_test.js`):
```
deferrals on y: [{target:"u0", field:"y", semantics:"defer",
  competing:[{actor:"grace", value:136}, {actor:"sys:rule:paddle_move", value:128}]}]
grace tx: committed with "deferred: y of u0 contested — held for author resolution"
```

This is not a Pong quirk. **Any** rule with a fallback that always assigns a value — even the current value — permanently contests any other writer of that field, silently, invisible except as deferral spam. Given the product's niche ("type a prompt, get a safe rule injected live"), this is exactly the class of bug an AI-authored rule will produce constantly, and a non-technical author cannot diagnose it from a raw deferral message. So the gate now **names it at author time**.

## The fix (the concrete bug)

`paddle_move` gained `where: input_dir != 0` (`!=` is an existing operator). Idle paddles no longer contest `y`, so a direct nudge commits. Same lesson the `vx` bounce rules already carried, one writer over. Pong v1 13/13, v2 22/22, e2e 13/13 ("the committed world moved: left paddle y 128 → 136").

## The standing check (`writeSmells`, core/behavior.js)

`installRule` now returns `warnings: [...]` alongside `ok`/`errors` — an **advisory, never a rejection** (the rule is valid and safe; the gate is behaving correctly). The precise, low-noise signature:

> flag iff **(no `where`/`uuid` guard)** AND **(the target field is non-foldable)** AND **(the effect expression reads that same field)** — i.e. `set F to g(F)` on every entity every tick.

- non-foldable ⇒ concurrent writes DEFER (silent stall) rather than merge, so contention actually hurts.
- reads-self ⇒ this is the *branchless-conditional* shape specifically (write-F-based-on-F, identity in the common case), not a deliberate constant assignment.
- unguarded ⇒ the rule enters arbitration every tick unconditionally.

A second code, `contended_field`, fires when an unguarded write targets a non-fold field **another rule already writes**. Both are surfaced by `m1_server` (`rule-result.warnings`, `propose-result.warnings`) and rendered in the editor as an amber `⚠ advisory` distinct from a red refusal.

**Precision, measured (`experiments/045_write_smell/write_smell_test.js`, 27/27):** on the *fixed* Pong ruleset the smell fires on **exactly** `ball_move_y` — a true, dismissable "physics owns the ball's y, confirm intended" — and is silent on the guarded bounce/reset/score rules. On the *original* unguarded `paddle_move` it fires — the bug caught at author time, before a human ever plays. A foldable field is exempt (contention merges). `writeSmells` is a pure function (never mutates the engine).

Design note (why not runtime-only): the engine already detects the *event* (a deferral) and the editor already de-spams the feed into `×N`. But the critique's ask was author-time — "Not reject. Just warn. Did you intend this?" — because the diagnosis has to reach the author when they draft, not as spam after. Both now exist.

## The deftype gate audit (the skipped adversarial pass, run as a 10-probe fan-out)

The `deftype` channel is the **third** sanctioned mutation gate (alongside `submit()` and `installRule()`). Every hard-won property ("nothing bypasses validate-before-execute") now has to hold across three gates. The prior session skipped this review for context; it was run here as a workflow of probe-writing auditors, each measuring, not reasoning.

**CLEAN (the load-bearing results):**
- **Reject-path atomicity** — 50 malformed specs (bad names, every reserved field, bad/inverted/overflow ranges, malformed fields/spatial, duplicates), each left the world **byte-identical**; a duplicate never touches the already-defined type. Validation returns before any mutation (engine.js:982). The gate holds.
- **Resource bounds** — the `FIELD_BUDGET = 64` cap added this session (below) bounds the field axis; the 256 Uint8 type cap bounds the other. 65+ fields rejected `field_budget`, byte-identical, zero allocation.
- **Conflict / persistence / indexing on parentless (root) entities** — roots (`parent = -1`) fold, defer, reparent, GC, save/load, and reorder exactly like parented entities. No subsystem assumes `parent != null`; the `-1` sentinel + `>= 0` guards are consistent throughout. **The `sanitizeOps` wire fix was the lone holdout; the engine was always root-clean.**

**Fixed this session, from the audit:**
- **`field_budget` cap** (engine.js `defineType`) — each pooled field eagerly allocates a capacity-sized typed column, so field count *is* allocation. Unbounded before (measured: 3000 fields → ~11.7 MiB in one accepted call; 20000 accepted). Now capped at 64/type (real entities have ≤6). Rejection is byte-identical.

**Fixed after the audit (the two the user ranked highest — each removes a *class*, not a one-off):**
- **#1 tick-clock false-negative — FIXED.** `editor.js worldSig` now signs world state with the logical `tick` excluded ("nothing changed on reject" is a claim about world state, not the submit-cycle counter). The whole engine-layer rejection class (reparent cycle, claim conflict, contract assert) now reads CONFIRMED, and `editor_test.js` T2 exercises it (was untested — only protocol-layer rejections were, and those never advance the clock). `worldSig` exported for the test.
- **#2 no-owner `setfield` throw — FIXED.** The engine's setfield validation now rejects a field no type owns (and not the universal `name`/`orderKey`) with a localized `unknown field` reason, before commit. Protects *every* caller (wire, tick, in-process), not just the wire path where it was reachable. `editor_test.js` T2 proves the localized reject replaces the commit-time throw.

**Remaining open low-severity smells (edge-case hardening, logged — deferred by the "does it remove a *class*?" standard):**
1. **Out-of-range spawn default.** A field whose range excludes 0 with no `init` spawns the default `0` — out of its own declared range (measured on `[-5,-1]`). Violates the range invariant the whole engine rests on, for an edge case no real schema hits. **Fix candidate:** `defineType` requires `init` when `0 ∉ [lo,hi]`.
2. **`deftype` throws on unserializable field-spec extras.** A field spec carrying a BigInt/circular *extra* property passes validation then throws in `makeSchema`'s JSON clone. Contract deviation (throws vs localized error), NOT corruption, NOT wire-reachable (JSON can't carry BigInt/cycles) — in-process callers only. **Fix candidate:** strict field-spec keys (RD-030 pattern).
3. **`'crop'` type-name triggers the farm HUD shim.** `m1_server` snapshot's farm back-compat keys on `TYPE_NAME.includes('crop')`, not on the presence of `water`/`growth`. A non-farm world defining a type named `crop` without those fields emits a farm-shaped `crops` array of undefined values. **Fix candidate:** key the shim on the fields, not the name.

Every item (fixed and open) is **non-corrupting and does not bypass the gate** (safety intact across all 10 probes); they are robustness / DX / thesis-presentation issues.

## Follow-up (2026-07-18b) — two REAL safety holes found in a stress-audit pass, FIXED

A wide stress-audit (`experiments/051_safety_patches/`) surfaced two genuine holes (both verified by probe, both violating a core invariant — not the low-sev smells above):

- **#1 createChild / spawn-effect props BYPASSED the range proof (HIGH — silent corruption).** `spawn()` writes props straight into the typed pools (`pools[type][f][row] = props[f] ?? init ?? 0`) with no range check, and the `createChild` validate path only checked parent + capacity. Measured: `createChild{hp:999}` on a `[0,100]` field **committed**, storing `hp=231` (Uint8 wrap); same via a **rule spawn effect** (install accepted, mob spawned at 231). Reachable on THREE untrusted paths (player tx, the wire via `sanitizeOps`, a rule's spawn effect). **FIXED**: (a) engine validate layer rejects any out-of-range createChild prop — covers all untrusted paths, rejected-not-wrapped (engine.js createChild branch); (b) `parseRule` statically rejects out-of-range / unknown spawn-effect props so the gate TEACHES rule authors (behavior.js spawn effect). `patch_test.js` proves both + the wire path. NOTE: the low-sev "out-of-range DEFAULT when 0∉range" (open smell above) is a distinct, narrower case (no prop given, default `0` used) and remains open.
- **#2 the server had NO per-tick client-op cap (MEDIUM — tx-flood DoS).** `engine.tickOpsBudget` defaults to null and the server never set it, so a client could send unlimited 32-op messages between ticks, growing `pending` unboundedly and stalling the tick for everyone. **FIXED** by capping the client queue at ingestion (`pendingOpsCap`, default 4096). Deliberately NOT `engine.tickOpsBudget`: it sorts txs by actor name and `sys:rule:*` sorts LATE, so a client flood would starve the system rules and freeze the simulation — capping the client queue leaves rules untouched. `patch_test.js` proves the cap + per-tick recovery.

## Pre-existing test breakage found by the full regression (NOT from this session's changes)

Confirmed by disabling this session's edits and re-running — identical failures — so these predate the work here, left by the mid-session RD-024/025 generalization:
- **`rule_persistence.js` T5 — FIXED.** A pre-RD-024 stub engine had no `w.schema`; RD-024's `parseRule` now reads it. Gave the stub the real world's schema. 28/28.
- **`behavior_invariants.js` I1 negative control — open.** The control does `delete FIELD_RANGE.water` on the *module global*, which RD-024 demoted to a boot-value; the instance enforces its own `w.schema` range, so "disable guard → wrap reappears" can no longer fire. The engine is correct (arguably safer); the control needs reworking or retiring.
- **`reload_composition.js` T3 — open.** A `maxGrowth` value assertion (60/90) that shifted, likely from RD-025/026/028 oracle/aggregation changes. Needs its own look.

## Files
- `core/behavior.js` — `referencesFieldNamed`, `writeSmells` (exported), `installRule` attaches `warnings`.
- `core/engine.js` — `defineType` `FIELD_BUDGET = 64` field cap.
- `experiments/042_pong/pong_rules_v2.js` — `paddle_move` guarded with `input_dir != 0`.
- `experiments/036_multiplayer/m1_server.js` — `rule-result`/`propose-result` carry `warnings`.
- `experiments/037_ai_native_editor/editor.html` — amber `⚠ advisory` in the propose preview + install result.
- `experiments/037_ai_native_editor/intent2_e2e_pong_test.js` — the served bundle × real Pong world × real gate (13/13).
- `experiments/045_write_smell/write_smell_test.js` — the smell's precision + the field cap (27/27).
- `experiments/030_rule_persistence/rule_persistence.js` — stub schema fix (28/28).
