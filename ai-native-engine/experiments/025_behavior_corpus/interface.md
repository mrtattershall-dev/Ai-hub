# The Adapter Interface — the RD-B1 seam

This is the contract an RD-B1 rival representation (declarative rules / total
mini-DSL / sandboxed code) implements so the scoring harness can judge it. The
corpus + harness are the **referee**; your representation is a **player**. You
build the player; you never touch the referee.

An adapter is a **CommonJS module**. The harness runs your adapter's `compile`
and `run` *inside a worker_threads Worker it controls* (so it can kill a
non-terminating `run`, cap its memory, and observe host escape). Your module is
`require`d fresh inside that worker — so it must be self-contained and cheap to load.

## The object

```js
module.exports = {
  name: 'RB1-rules',            // display name
  execMode: 'inproc' | 'sandbox',
  sourceKey: 'rules',           // which corpus encoding you consume (see below)

  // compile(source): load an UNTRUSTED authored artifact into a runnable behavior,
  //   OR return localized errors. NEVER throws on bad input — it returns errors.
  compile(source) {
    return { ok: true, behavior } // opaque to the harness; you define its shape
        || { ok: false, errors: [{ at, code, detail }] };
  },

  // run(behavior, view, budget): produce ONE tick's ops from a read-only view.
  //   Returns { ops } or a bare ops[] array. May throw — a throw is caught and
  //   treated as an empty tick (but see SAFE/BOUNDED for what the harness observes).
  run(behavior, view, budget) { return { ops } },

  // declaredScope(behavior): the read/write footprint your behavior PROMISES.
  //   Not scored by THIS harness (it's the RD-B2 surface), but required for the
  //   seam and printed in the report. Be honest — RD-B2 will check declared ⊆ allowed.
  declaredScope(behavior) {
    return { reads: ['crop.water', 'crop.*'], writes: ['crop.growth'], spawns: ['crop'], deletes: false };
  },
};
```

Multiple adapters may be exported as `module.exports = { adapters: { 'name': adapter, ... } }`;
score one with `scoreAdapter({ modulePath, name })`.

### `execMode` — this changes how BOUNDED is scored

- **`sandbox`** — you accept that the *harness* contains you. If a `run` never
  returns, the harness hard-kills the worker; if it allocates without bound, the
  memory cap fires; if it emits more than `OP_CAP` ops, the growth cap fires. Any
  of these counts as **contained → BOUNDED passes**. Use this if your
  representation executes host-level code (a real sandbox).
- **`inproc`** — you claim your representation *cannot* run away by construction
  (a declarative table can't loop; a total DSL's interpreter honors `budget.steps`).
  The harness still contains you as a backstop, but **needing the hard kill / cap
  is a BOUNDED failure** — you promised to self-bound and didn't. Use this for
  declarative / total-DSL representations.

## `source` — what `compile` receives

Each corpus behavior carries a `sources` map keyed by `sourceKey`. This repo ships
the `ref` key (a trusted JS closure `fn` + an equivalent raw-JS `code` string) used
by the calibration controls. **You add your own key.** For a declarative rival:

```js
// in corpus.js, alongside the existing sources.ref, add per behavior:
sources: { ref: { fn, code }, rules: { /* your rule-table for THIS behavior */ } }
```

Then set your adapter's `sourceKey: 'rules'`. Malformed-source probes arrive as
`{ __malformed__: '<reason>' }` — your `compile` must detect that and return
localized errors (that's the LOCALIZED axis).

Malicious behaviors' `ref` encodings additionally carry `reject: '<reason>'` — the
stand-in for *"this construct is not expressible in a safe/total notation."* If
your representation genuinely can't express host access or unbounded loops, you
won't have a `sources[yourKey]` for those behaviors at all, and the natural move
is to have `compile` reject or the harness simply never hands them to you. (A safe
representation is *supposed* to make the malicious behaviors unrepresentable.)

## `view` — the read-only world (RD-007 `_systemView` shape)

```
view.tick                       // number
view.allOfType('crop')          // [uuid]         (records a `crop.*` read)
view.field(uuid, 'water')       // value|undefined (records a `crop.water` read)
view.typeOf(uuid)               // 'crop' | ...
view.nameOf(uuid) / parentOf / childrenOf   // structural (always permitted)
```

Reads COMMITTED tick-start state only. Every `field`/`allOfType` call is recorded
by the tripwire — that record is what SAFE checks against the behavior's allowed
scope, so **reads are measured, not inferred from your source.**

## `ops` — the engine op shape (drops straight into `stepTick`)

```
{ kind: 'setfield', target: uuid, field, value }
{ kind: 'createChild', type: <TYPE int>, parent: uuid, props: {...} }
{ kind: 'delete', target: uuid }
{ kind: 'reparent', target: uuid, parent: uuid }
{ kind: 'move', target: uuid, after: uuid|null }
```

Emission order carries no meaning (the pipeline schedules) — EXPRESSIVE compares
the canonical **multiset** against the oracle. But DETERMINISTIC compares **raw
ordered output** across repeated identical runs, so your `run` must be a pure
function of `(behavior, view)`: no `Math.random`, no clock, no ambient state.

## The five axes (what makes an adapter admissible)

| Axis | Passes iff |
|---|---|
| EXPRESSIVE | every real behavior compiles and its op multiset equals the oracle |
| SAFE | every scope/escape probe is rejected at compile OR its run stays within the behavior's allowed scope and leaves the host canary clean |
| DETERMINISTIC | every real behavior yields byte-identical ops across repeats and is invariant to input enumeration order |
| BOUNDED | every non-termination / growth / memory probe is contained (per your `execMode` rules above); real behaviors self-bound |
| LOCALIZED | malformed sources yield `[{ at, code, detail }]` with real string detail |

`admissible = all five`. See `harness.js` for the exact measurement of each.

## Plugging in

```bash
node harness.js path/to/your-adapter.js RB1-rules   # prints the matrix, exits 0 if admissible
```

Or programmatically:

```js
const { scoreAdapter, formatMatrix } = require('./harness.js');
const m = await scoreAdapter({ modulePath: '/abs/path/your-adapter.js', name: 'RB1-rules' });
console.log(formatMatrix(m));
```

The controls in `adapters.js` are worked examples of the seam (each deliberately
broken on one axis). `NC-trusted-closure` is the closest to a naive "just run the
code" adapter — read it first, then build the confinement your representation needs.
