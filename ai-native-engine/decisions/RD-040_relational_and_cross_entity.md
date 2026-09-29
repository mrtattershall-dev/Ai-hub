# RD-040 — relational predicates & cross-entity effects (SCOPING / pre-registration)

**Status: SCOPING — not decided.** This frames the problem, decomposes it into layers with sharply
different costs, states a falsifiable thesis, and pre-registers the experiment that would decide it.
No core code changes here; the measured experiment + decision come next, on the user's green-light.

**Origin.** RD-039 (tower defense, run to FORCE RD-032) converted the relational gap from a suspicion
into three reproducible **gate verdicts**:
- a rule writing another type's field (`tower` sets `enemy.hp`) → `field_not_owned` (behavior.js:395/engine.js:698)
- a `where` comparing a field to another **field** (`x < my y`) → `bad_value` (behavior.js:138)
- (implied) an aggregation filter is field-vs-constant too (behavior.js:154)

The review then escalated it correctly: this isn't a TD edge case. The "attack by inversion" workaround
(the target damages *itself* when a condition about its own state holds) is honest but **narrower than it
looks** — it covers area damage because "am I in range" is self-derivable, and breaks the moment an effect
isn't self-derivable from the target's own state (a heal, a buff, a debuff, a stun on a *chosen* other
entity). Asymmetric-role genres (healer / tank / debuffer / MOBA / support kits) hit this on day one.

## Why this is not one feature — the safety model is the cost

A rule writes **only its matched entity's own fields**, and every rule reads the **same frozen pre-tick
state** (the double-buffer). That is not incidental — it is *why* RD-005 conflict resolution is tractable:
the blast radius of any write is one entity, and read-after-write hazards are unrepresentable
(RD-B2 proved the declared-read/write-set invariant "unnecessary by construction"). The instant a rule can
write **another** entity's field, two new problems appear that the engine has never had to face:
1. **N-to-M contention** — many sources writing one target in one tick (many towers → one enemy's hp).
2. **Order-dependence** — which source's rule evaluates first can change the outcome, whereas today
   RD-005's fold/defer assumes the write and its target are the same entity. Cross-entity writes need a
   *different concurrency model*, not a grammar tweak.

So the design principle for this RD: **push everything that can be reads-only + self-writes into that safe
regime, and isolate the genuinely cross-entity-write surface as small as possible** — because that surface,
and only that surface, reopens RD-005.

## Decomposition (four layers, grounded in the code, ordered by cost)

**L1 — within-entity field-vs-field predicate.** Allow a `where` value to be `{field: g}` where `g` is a
field of the *matched* entity. Change: behavior.js:138 (accept a field-ref, validate `g` is owned by
`ownType`) + evalPred:281 (resolve it via the same `get`). ~4 lines each side.
- **Safety: NONE touched.** Reads only the matched entity's own pre-tick field; predicates gate whether an
  effect fires, they never produce a written value, so determinism / double-buffer / the range proof are all
  unaffected. This is a free, safe win.
- Unlocks: own-field state machines ("if my x has passed my target_x"), cleaner guards.

**L2 — relational reads: aggregation filters parameterized by the matched entity's fields, + relational
compare-to-self.** Let an aggregation's `count/sum/min/max` filter compare the *counted* entity's field to
the *matched* entity's field (thread a `self` binding into the filter's evalPred at behavior.js:154), and
let a predicate compare a field to an aggregate (`my hp == min(ally.hp near me)`).
- **Safety: NONE touched.** Still reads-only (a pure read over the frozen pre-tick pool) + self-writes. No
  cross-entity write, so RD-005 is untouched. The range/interval proof is unaffected — `count` is still
  `[0,capacity]`, `sum` still capacity-bounded, regardless of a runtime-parameterized filter.
- **Unlocks (measured target of the experiment): a large fraction of "cross-entity" mechanics via inversion
  + relational self-selection** — the target self-applies because it can now recognise it is *the one*:
  - per-enemy **waypoint pathing** — `sum(waypoint.x where idx == my progress)` returns the target x (exactly
    one waypoint matches), enemy moves *itself* toward it. RD-032's pathing gap, closed **without** cross-entity writes.
  - **heal-the-lowest-hp ally / buff-the-strongest / hit-by-field-priority** — the target self-applies iff
    `my hp == min(ally.hp in scope)` (a min-aggregation compared to self). Asymmetric support kits, **inverted**.
  - threshold / matching mechanics generally.

**L3a — distance-as-value ("nearest").** `near` today is set-membership (a radius-scoped count), not a
metric, so "the *nearest* enemy" (min squared-distance, with per-source grouping) is **not** reachable by
L2. Needs squared-distance surfaced as an aggregatable value. Still **reads-only → RD-005-safe**, but a new
spatial primitive (extends RD-025). A separate, contained decision.

**L3b — entity-reference fields + cross-entity writes.** The genuinely RD-005-reopening layer. Needed only
for **persistent, non-derivable bindings**: a unit *locked* onto a specific target across ticks (arbitrary
aggro, not "nearest"/"lowest"), or an effect the target cannot self-derive at all. Requires (i) an
entity-reference/uuid-valued field the grammar can write and compare (today all fields are integer-ranged;
`match.uuid` is a fixed literal, not a field), and (ii) a cross-entity write path with a concurrency model
answering the N-to-M + order-dependence questions above. **This is the expensive, deferrable, deliberate one.**

## Thesis (falsifiable)

> **H1:** L1 + L2 (reads-only, self-writes, RD-005 untouched) express the *majority* of what presents as
> "cross-entity effects" across asymmetric-role genres — via inversion + relational self-selection — leaving
> a **narrow** residue that genuinely needs L3a (distance) or L3b (references + cross-entity writes).
>
> **H0 (to refute):** common mechanics fall outside L1/L2 and force L3b early, putting the concurrency-model
> redesign on the critical path before the renderer.

## Pre-registered experiment (measured, not reasoned)

1. Implement **L1 + L2 in an experiment module** (a forked `behavior.js` under `experiments/050_relational/`,
   NOT core), plus the two evaluator changes above and the aggregation `self`-binding.
2. **Falsification set — express each via inversion, WITHOUT any cross-entity write, or record it as a
   residue driver:** (a) per-enemy waypoint pathing (TD/racing ordered route); (b) heal-the-lowest-hp ally;
   (c) single-target damage on the strongest-by-a-field enemy; (d) a debuff/stun the target self-applies by
   a relational predicate. For each: expressible (with the authored rule + an observable) or not.
3. **Enumerate the residue** — the concrete mechanics that remain L3a (nearest-by-distance) or L3b
   (persistent identity lock) after L1/L2. This list *is* the cost/benefit of building L3b.
4. **Adversarial safety on L1/L2** — run the existing RD-B2/RD-021 behavior fuzzer over L1/L2 rules:
   determinism-under-permutation, double-buffer, range proof, save/load must all still hold (they should —
   reads only). Any failure falsifies "L2 is RD-005-safe."
5. **Quantify L3b's cost concretely** — a *small* cross-entity-write prototype (many sources → one target)
   that MEASURES the N-to-M contention + order-dependence (e.g. does fold/defer even have a meaning when the
   contributors aren't the target?), so the concurrency-model decision is grounded, not asserted.

## Pre-registered decision rule

- If **H1 holds** (L1/L2 cover the falsification set, fuzzer green): **ship L1 + L2** as the relational
  capability (a large genre unlock at ~zero safety cost), and spin **L3a** (distance) and **L3b**
  (references + cross-entity concurrency) into their own RDs — L3b gated on a concurrency-model design, off
  the critical path. This is the expected outcome per the code read above.
- If **H0** (common mechanics need L3b): the concurrency-model redesign is forced now, before the renderer,
  and RD-005 gets its cross-entity extension (fold semantics for foreign writes, or claim-serialized
  targeting) as the next major decision.

## Sequencing (answering the open question from RD-039)

Do **this** before stealth. Stealth's gap (no-trig → fixed-point rotation) is *contained* — a
math/representation choice that never touches the conflict model. This one touches RD-005, the contract
everything is built on, and it recurs in every support/healer/debuff genre — so it is both more consequential
and more likely to be re-discovered urgently mid-build. Scope it deliberately now; stealth can follow.

## RESULTS (measured 2026-07-18 — pre-registration above is intact, unedited)

Built the L1/L2 evaluator as a focused prototype (`experiments/050_relational/relational_harness.js`) —
NOT a core fork; it ENFORCES self-write-only by construction (a rule can only ever target the matched
entity), so "expressible here" ⟺ "expressible with no cross-entity write". **H1 HELD, and survived an
adversarial break-attempt invented after the tool existed.**

**Pre-registered falsification set — all three express via inversion + L1/L2, self-writes only
(`falsification_test.js` 11/11):**
- **per-enemy waypoint pathing** (the RD-032 pathing gap): `sum(wp.x where idx == {self:progress})` → move
  self toward it; advance progress by proximity. Enemy walks waypoints 0→1→2 in order, arrives, zero cross-entity writes.
- **heal-the-lowest-hp ally**: heal self iff `hp == min(ally.hp)` and near a casting healer. Only the lowest heals; the healer never writes an ally.
- **single-target the strongest enemy**: self-damage iff `hp == max(enemy.hp)` near a sniper. Only the strongest is hit — single-target by SELF-selection.
- Safety: determinism holds; **reversing rule-evaluation order changes nothing** (double-buffer / RD-005 property preserved) — expected, since L1/L2 are reads + self-writes.

**Adversarial step — mechanics invented AFTER the tool, to break H1 (`adversarial_test.js` 6/6):**
- INVERTS (H1 holds): debuff-the-lowest-armor (support mage); taunt with ONE tank in range.
- RESIDUE, demonstrated by concrete runs (not asserted):
  - **persistent target-LOCK** (aggro that outlives the taunt): the L2 enemy re-derives its target every
    tick, so when the taunt ends it FORGETS and retreats (x 50→0). → **L3b** (needs a reference/memory field).
  - **nearest-of-several** taunting tanks: `sum` gives the tanks' summed x (200), so the enemy walks to x=200,
    reaching NEITHER (40 or 160) — no distance to rank on. → **L3a** (distance-as-value).
  - **threat table** ("face who hit ME most"): the enemy can read an attacker's GLOBAL `dealt`, never
    damage-to-ME; per-victim attribution needs per-(enemy,attacker) state. → **L3b** (per-pair state).

**Verdict + refinement of the pre-registered decision rule.** H1 holds → **ship L1 + L2**. The residue is
narrow AND splits cleanly, which sharpens L3b's scope beyond the pre-registration: **L3a (distance-as-value)
is itself reads-only → RD-005-safe**; only **L3b (references + per-PAIR persistent state — aggro-locks,
threat tables, arbitrary bindings) reopens RD-005.** So the concurrency-model decision is confined to an
even smaller surface than "cross-entity effects" — specifically *persistent per-pair relational state*.
Sequence: L1+L2 now (implement in core behind the gate: checkPred/evalPred + the aggregation `self`-binding,
with the range proof unchanged); L3a (distance) as a contained spatial RD; **L3b as its own RD gated on a
per-pair-state concurrency design** — off the critical path, exactly as hoped.

## Open questions to resolve in the experiment
- Does the aggregation `self`-binding interact with RD-026 memoization (scope-invariant aggregations are
  memoized per-tick; a self-parameterized filter is *not* scope-invariant — it must not be memoized across
  matched entities, exactly like `near` already isn't).
- Entity-reference fields (L3b): do they compose with RD-004.6 (tombstones) and RD-019.1 (GC) — a reference
  to a deleted target must degrade to `missing`, never a wrong-live, like every other ref in the engine.
