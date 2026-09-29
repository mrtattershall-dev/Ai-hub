# 025 — RD-B1 Behavior Corpus + Scoring Harness

The **referee** for RD-B1 (behavior representation), the heart of the behavior
arc. RD-B1 asks how an *untrusted, AI-authored behavior* — written once, run every
tick forever — should be represented: **declarative rules vs a total mini-DSL vs
sandboxed code**. The rival representations are authored elsewhere; this folder is
the shared field they compete in — a corpus of behaviors and a harness that scores
any representation on five axes and prints an admissibility verdict.

This is **infrastructure, not a decision.** No RD-B1 verdict lives here. It builds
the negative controls and measurement surface RD-B2 will also lean on.

## Run it

```bash
node corpus.js         # C0: the corpus reproduces every oracle
node harness_test.js   # the calibration proof — ALL PASS (~20-40s)
node harness.js adapters.js NC-trusted-closure   # score one adapter, print its matrix
```

## The five axes

`SAFE / LOCALIZED / EXPRESSIVE / DETERMINISTIC / BOUNDED` — a representation is
**admissible** iff it passes all five. Each is *measured* from a real contained
run, never asserted from the source. See `interface.md` for the exact contract and
`harness.js` for the measurement of each axis.

## Why it's trustworthy: the referee is calibrated first

A scorer you can't trust is worse than none — a referee that passes a fork-bomb
launders a broken representation as sound. So before the harness judges any rival,
`harness_test.js` proves it hands out **known-correct verdicts on deliberately-broken
control adapters** (`adapters.js`), each engineered to fail exactly one axis:

| control | fails | demonstrates |
|---|---|---|
| `NC-noop` | EXPRESSIVE | emits nothing → can't express the reals |
| `NC-nondet` | DETERMINISTIC | correct multiset, `Math.random` order → unstable across repeats |
| `NC-bareerror` | LOCALIZED | returns a bare boolean, no `{at,code,detail}` to repair from |
| `NC-raweval` | SAFE | raw `eval`, no confinement — reads out of scope, reaches host |
| `NC-trusted-closure` | SAFE + BOUNDED | today's trusted-JS system model, unsafe *and* unbounded for untrusted authoring |

And it proves the containment is **load-bearing, not adapter goodwill**:
`NC-raweval`'s infinite loop is hard-killed by `worker.terminate()`, its memory
bomb hits the worker memory cap, its fork-bomb hits the per-tick op cap, and its
host escape is observed via a canary — all while the adapter does nothing to protect
itself. The one contract that separates `NC-raweval` (BOUNDED passes — a `sandbox`
adapter may rely on the harness kill) from `NC-trusted-closure` (BOUNDED fails — an
`inproc` adapter that needs the hard kill did not self-bound) is `execMode`.

## How containment works

All adapter execution runs inside `worker_run.js`, a `worker_threads` Worker the
harness owns. The harness enforces the bound *from outside* the untrusted code:

- **non-termination** → main-thread `setTimeout` → `worker.terminate()` (interrupts
  even a synchronous `while(true)`).
- **memory** → `resourceLimits.maxOldGenerationSizeMb` → worker OOMs and exits.
- **growth** → per-tick emitted-op count cap (`OP_CAP`).
- **host escape** → a per-run canary on the worker's real global; unconfined code
  that reaches ambient state dirties it. A confined representation runs the body
  where `globalThis` is *its* sandbox, not the worker's, and the canary stays clean.
- **scope** → a tripwire view records every field read / type enumeration; SAFE
  checks the actual footprint against the behavior's allowed scope.

(Node's built-in `vm` with the `timeout` option is a documented in-process fallback
for purely-synchronous code; the worker is used here because `terminate()` also
kills async and covers the memory cap.)

## Files

- `corpus.js` — behaviors (6 real / 6 malicious / 1 nondet / 2 malformed), fixtures,
  hand-written oracles + a `selfCheck()` that proves each reference encoding
  reproduces its oracle, the tripwire `makeView`, and op canonicalization.
- `interface.md` — **the adapter contract** an RD-B1 rival implements (start here).
- `worker_run.js` — the containment boundary; runs `compile`/`run` in isolation.
- `harness.js` — `scoreAdapter({ modulePath, name })` → the 5-axis matrix.
- `adapters.js` — the negative-control adapters + their predicted matrices.
- `harness_test.js` — the calibration proof (ALL PASS).
- `rules_adapter.js` + `crosscheck_rules.js` — wraps the DECIDED RD-B1 winner
  (`core/behavior.js` rules) as an adapter and scores it here. Independent verdict:
  **SAFE + BOUNDED + DETERMINISTIC + LOCALIZED pass** (every attack statically
  rejected — range proof, cross-pool, spawn-cap — or unrepresentable), and the
  referee rediscovers RD-B1's expressiveness ceiling on its own (EXPRESSIVE fails
  only on `decay-cascade`, the multi-entity cascade rules can't author; 5/6 expressible).
  `node crosscheck_rules.js` → ALL PASS.

## For the RD-B1 author

1. Read `interface.md`.
2. Add your `sources.<key>` encoding for each real behavior in `corpus.js` (leave
   `ref` untouched — the controls need it).
3. Write your adapter module and score it: `node harness.js your-adapter.js <name>`.
4. Iterate until admissible; the per-behavior `detail` in the matrix pinpoints the
   exact failing case. A representation that reaches **admissible here** is a live
   RD-B1 candidate — score all three rivals, compare, and the winner is RD-B1.

## Known limitations (honest, v1)

- The `reject` tag on malicious `ref` encodings *models* "not expressible in a safe
  notation" — for the controls it is a flag, not a proof. A real declarative/DSL
  rival earns un-expressibility structurally (there is no `while` to write); the
  harness then never receives those sources. The controls exercise the alternative
  path — an unsafe adapter that DOES run the body — and prove the runtime catches it.
- BOUNDED's growth cap is a fixed per-tick op ceiling; a representation with a
  legitimately large but bounded fan-out would need the cap raised (it's one constant).
- Host-escape detection is canary-based (does unconfined code reach ambient state),
  not a full capability audit — sufficient to separate confined from unconfined
  execution, which is the RD-B1 question.
- Determinism is measured behaviorally (repeat + order-invariance). Whether a
  representation can *structurally* observe ambient nondeterminism is reported as
  an informational `observesNondet` flag for RD-B2, deliberately not folded into
  this verdict (doing so would wrongly fail the trusted-closure control, which runs
  deterministic authored systems).
