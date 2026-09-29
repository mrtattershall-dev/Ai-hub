# RD-018: AI↔Engine Protocol (Closed) — spine decision #4

**Question:** What does a model emit to change the world — free-form output, a structured IR, or a constrained DSL — given that the model is an UNTRUSTED emitter that produces malformed JSON, hallucinated UUIDs, undeclared fields, out-of-range values, and multi-op proposals where one op is bad?

**Why it's the load-bearing boundary:** the project's whole thesis (RD-014: "agents propose, a deterministic gate disposes") is enforced *here*, at the wire between model and engine. If the protocol lets bad output through, every downstream guarantee (RD-002 validation, RD-017 atomic indexes) is defending a door that's already open.

## Method
Three rival shapes run against a corpus of the failure modes a model actually produces (no live model needed — user runs ~1.1B no-VRAM; the honest move is to enumerate the failure classes and measure each shape against them). Three computed properties: **SAFE** (bad input → zero mutation; valid input → exact apply; assert-violating input → never commits), **LOCALIZED** (rejection names op-index + code, so it's re-promptable), **EXPRESSIVE** (can carry the real intents). `core/protocol_test.js`, `core/protocol.js`, zero deps.

- **FREE-FORM** — parse JSON, best-effort apply op-by-op (no atomicity), silently skip unknowns, CLAMP out-of-range, ignore asserts.
- **STRUCTURED IR** — typed op list + optional structured `asserts`; a pure validator produces a safe batch or a localized error list; nothing reaches the engine until it validates.
- **CONSTRAINED DSL** — a restricted line grammar; illegal verbs/fields are unrepresentable.

## Proven (measured)
- **FREE-FORM is INADMISSIBLE — UNSAFE.** It mutated on bad input in 2/7 cases: it silently **clamped** `water=999`→255 (the model's intent corrupted with no signal) and **partial-applied** a multi-op batch whose middle op was a hallucinated UUID (no atomicity). It surfaces **zero** localized feedback — nothing to re-prompt with. This is the RD-002 immediate-mutation / RD-005 LWW failure, reincarnated at the wire.
- **STRUCTURED IR is ADMISSIBLE and the winner** — SAFE 7/7, a localized `(opIndex, code, detail)` error for every one of its 6 rejections, and uniquely **expressive**: it carries structured `asserts` that `compileContract()` turns into the RD-014 goal-contract gate. The model states its own postcondition; the gate enforces it; machine-checkable, no NL-goal parsing.
- **CONSTRAINED DSL is ADMISSIBLE but weaker** — SAFE 7/7, but on one case (`set <crop>.hp = ...`) *only because the engine invariant backstops it*: the thin grammar has no type awareness, so a field/type mismatch parses clean and is caught late (a cross-pool write, blocked at the engine). The IR catches the same mismatch at the protocol phase, before submit. And the DSL grammar **cannot express** the structured asserts the RD-014 gate needs — the expressiveness gap.

## Decision
- **Structured IR is the AI↔engine protocol.** A model emits a typed op list (`setfield`/`delete`/`reparent`/`createChild`/`claim`) plus optional structured `asserts`; `parseProposal()` validates shape, verbs, field/type ownership, target liveness (RD-004.6 explicit absence), and value ranges into a safe `submit(batch)` — or returns a localized, re-promptable error list. Nothing reaches the engine until it validates.
- **Asserts compile to contracts.** The proposal's postcondition is carried in-band and compiled to the RD-014 deterministic gate — closing the "agents propose, gate disposes" loop at the wire.
- **Ownership is an engine invariant, not just a protocol check** (found during this card): `setfield` to a field the target's type doesn't own is rejected in the engine too (defense in depth), because a cross-pool write silently corrupts an unrelated entity's row. The protocol gives the *earlier, better-localized* rejection; the engine is the backstop.

## Transferable principle
The boundary with an untrusted generator must be the narrowest, most-validated surface in the system — structured enough to check every field before it acts, and rich enough to carry the generator's own stated intent so the intent can be enforced rather than trusted. Free-form is fast to accept and impossible to trust; an over-thin DSL is safe only until it meets a case its grammar can't see.

## What remains open
- Repair loop: the localized errors are designed to be fed back to a model, but the actual propose→reject→repair→re-propose loop needs a live model to measure (ties to RD-014's unmeasured quality questions).
- The IR is JSON today; a token-minimal wire form (RD-007 legibility constraints apply in reverse — model *emits* here rather than *reads*) is unexplored.
- `asserts` currently cover field comparisons + destroyed; structural postconditions (parent/child shape) aren't yet expressible.
