'use strict';
// =============================================================================
// NEGATIVE-CONTROL ADAPTERS — the calibration fixtures for the referee. NONE of
// these is an RD-B1 rival; each is a deliberately-broken (or status-quo) adapter
// engineered to fail EXACTLY ONE axis (or, for the two unsafe ones, the exact
// pair the plan predicts). If the harness scores any of them off-target, the
// harness is wrong and gets fixed before it judges a real representation — the
// RD-021 fuzzer-vs-engine discipline applied to the scorer.
//
// The seam (interface.md): { name, execMode, sourceKey, compile, run, declaredScope }.
// All controls consume the corpus `ref` encoding: { fn, code, scope, reject? }.
//   - fn:   a trusted JS closure (view) -> ops        (used by closure-based controls)
//   - code: an equivalent raw-JS string               (used by the raw-eval control)
//   - scope: the behavior's declared read/write set
//   - reject: present iff the behavior is not expressible in a safe/total notation
//
// A CONFINED control (noop/nondet/bareerror) honors `reject` — it refuses the
// construct at compile, so it is SAFE and BOUNDED by construction and only ever
// runs the real behaviors. An UNSAFE control (raweval/trusted-closure) ignores
// `reject` and runs the body raw; the harness catches it at runtime.
//
// Predicted matrices (asserted by harness_test.js):
//   NC-noop            E✗  S✓ D✓ B✓ L✓   (expressiveness bites)
//   NC-nondet          E✓  S✓ D✗ B✓ L✓   (determinism bites; == NC-ref but shuffled)
//   NC-bareerror       E✓  S✓ D✓ B✓ L✗   (localization bites)
//   NC-raweval         E✓  S✗ D✓ B✓ L✓   (safety bites; BOUNDED held by harness kill/cap)
//   NC-trusted-closure E✓  S✗ D✓ B✗ L✓   (status quo: unsafe AND unbounded for untrusted authoring)
// =============================================================================

// shared localized compile: reject malformed + unrepresentable constructs with
// { at, code, detail } — the protocol.js err(opIndex, code, detail) shape.
function confinedCompile(source) {
  if (source && source.__malformed__)
    return { ok: false, errors: [{ at: 'source', code: 'parse_error', detail: `cannot parse behavior: ${source.__malformed__}` }] };
  if (source && source.reject)
    return { ok: false, errors: [{ at: 'behavior', code: 'unrepresentable', detail: source.reject }] };
  return { ok: true, behavior: { fn: source.fn, code: source.code, scope: source.scope } };
}

const scopeOf = (behavior) => behavior.scope || { reads: ['*'], writes: ['*'], spawns: ['*'], deletes: true };

// --- NC-noop: compiles everything a confined rep would, but emits nothing. ----
const noop = {
  name: 'NC-noop', execMode: 'inproc', sourceKey: 'ref',
  compile: confinedCompile,
  run() { return { ops: [] }; },
  declaredScope: scopeOf,
};

// --- NC-nondet: identical to a correct confined rep EXCEPT it emits its ops in
// a Math.random order. The op MULTISET is correct (EXPRESSIVE passes), but two
// runs on identical state differ in ORDER (the determinism repeat-check fails).
// This is the cleanest isolation: NC-nondet and a correct reference differ ONLY
// in output ordering, so ONLY their DETERMINISTIC verdict may differ.
const nondet = {
  name: 'NC-nondet', execMode: 'inproc', sourceKey: 'ref',
  compile: confinedCompile,
  run(behavior, view) {
    const ops = behavior.fn(view) || [];
    for (let i = ops.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ops[i], ops[j]] = [ops[j], ops[i]]; }
    return { ops };
  },
  declaredScope: scopeOf,
};

// --- NC-bareerror: correct + confined + deterministic, but its compile returns
// a bare boolean on malformed input instead of a located, re-promptable error
// list. A weak model gets nothing to repair from (the RD-018.1 failure mode).
const bareerror = {
  name: 'NC-bareerror', execMode: 'inproc', sourceKey: 'ref',
  compile(source) {
    if (source && source.__malformed__) return { ok: false, errors: true }; // the defect: not localized
    if (source && source.reject) return { ok: false, errors: [{ at: 'behavior', code: 'unrepresentable', detail: source.reject }] };
    return { ok: true, behavior: { fn: source.fn, scope: source.scope } };
  },
  run(behavior, view) { return { ops: behavior.fn(view) || [] }; },
  declaredScope: scopeOf,
};

// --- NC-raweval: a 'sandbox'-mode adapter that just eval()s the raw-JS source
// with NO confinement. It IGNORES `reject`. Expressive and deterministic, but it
// reads out of scope and reaches host state (SAFE fails), and its runaway is
// stopped ONLY by the harness's external kill/cap (BOUNDED held by the harness,
// not the adapter — the whole point). Runs in the worker; a real host escape is
// contained to the worker process the harness terminates.
const raweval = {
  name: 'NC-raweval', execMode: 'sandbox', sourceKey: 'ref',
  compile(source) {
    if (source && source.__malformed__) return { ok: false, errors: [{ at: 'source', code: 'parse_error', detail: `cannot parse behavior: ${source.__malformed__}` }] };
    return { ok: true, behavior: { code: source.code } }; // note: ignores `reject`
  },
  run(behavior, view) {
    // eslint-disable-next-line no-new-func — deliberate: this is the unsafe control
    const f = new Function('view', `return (${behavior.code})(view);`);
    return { ops: f(view) || [] };
  },
  declaredScope() { return { reads: ['*'], writes: ['*'], spawns: ['*'], deletes: true }; },
};

// --- NC-trusted-closure: today's registerSystem model — a raw trusted JS closure
// run in-process. EXPRESSIVE + DETERMINISTIC for the real behaviors (it is how
// tick_test.js's systems work), but for UNTRUSTED authoring it is unsafe (runs
// any closure, reaches host, reads anything) AND unbounded (an inproc closure has
// no budget; a non-terminating one needs the harness's HARD kill — which, for an
// inproc adapter that CLAIMED to self-bound, is a BOUNDED failure). This control
// is why trusted JS cannot be the RD-B1 answer, and it motivates the whole card.
const trustedClosure = {
  name: 'NC-trusted-closure', execMode: 'inproc', sourceKey: 'ref',
  compile(source) {
    if (source && source.__malformed__) return { ok: false, errors: [{ at: 'source', code: 'parse_error', detail: `cannot parse behavior: ${source.__malformed__}` }] };
    return { ok: true, behavior: { fn: source.fn } }; // note: ignores `reject`
  },
  run(behavior, view) { return { ops: behavior.fn(view) || [] }; },
  declaredScope() { return { reads: ['*'], writes: ['*'], spawns: ['*'], deletes: true }; },
};

const adapters = { 'NC-noop': noop, 'NC-nondet': nondet, 'NC-bareerror': bareerror, 'NC-raweval': raweval, 'NC-trusted-closure': trustedClosure };

// predicted matrices — the calibration target. axes: E S D B L (true = PASS).
const EXPECTED = {
  'NC-noop':            { EXPRESSIVE: false, SAFE: true,  DETERMINISTIC: true,  BOUNDED: true,  LOCALIZED: true },
  'NC-nondet':          { EXPRESSIVE: true,  SAFE: true,  DETERMINISTIC: false, BOUNDED: true,  LOCALIZED: true },
  'NC-bareerror':       { EXPRESSIVE: true,  SAFE: true,  DETERMINISTIC: true,  BOUNDED: true,  LOCALIZED: false },
  'NC-raweval':         { EXPRESSIVE: true,  SAFE: false, DETERMINISTIC: true,  BOUNDED: true,  LOCALIZED: true },
  'NC-trusted-closure': { EXPRESSIVE: true,  SAFE: false, DETERMINISTIC: true,  BOUNDED: false, LOCALIZED: true },
};

module.exports = { adapters, EXPECTED };
