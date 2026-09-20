// LEGASCREEN — AUTO-WITNESS. The construction history of a legitimate invocation, recorded from a run
// that was going to happen anyway.
//
// Slice 2 proved that a counterfactual must be minted upstream, through the production constructor.
// It did not say where the upstream facts come from, so I wrote them by hand - twelve lines of my own
// judgment about what `calculus.derive`'s pre-authority facts ARE. That is why the sound method
// covers one transformation, and writing 250 more drivers would not be progress: it would be 250 more
// chances for the screen author to decide what the subject means.
//
//     THE PRODUCTION RUN ALREADY KNOWS THE RECIPE. RECORD IT INSTEAD OF RESTATING IT.
//
// An existing test calls observe(), observe(), derive(). This records those three calls and the
// IDENTITY relationships between them, yielding a DAG that can be re-executed through the same
// functions. No driver, no forge, no copied token, no test-only constructor.
//
// CLASSIFICATION IS BY IDENTITY, NEVER BY NAME OR SHAPE. That distinction is the whole point:
//
//     DERIVED   this object IS the return value of a recorded call   -> replay that call
//     FOREIGN   the SUBJECT'S OWN brand predicate says it is an authority object, but no recorded
//               call produced it                                     -> cannot be rebuilt, and must
//                                                                       never be treated as data
//     OPAQUE    not plain data and not authority (a function, a Map)  -> held by identity
//     LEAF      plain data                                            -> the only mutable surface
//
// FOREIGN EXISTS BECAUSE OF W-4. A frozen token is a plain object; classifying "plain" as LEAF would
// make an authority object look like mutable raw data, which is precisely the forgery this line of
// work exists to prevent. So the recorder does not guess - it asks the subject's own predicate, the
// same one production asks.
//
// THERE IS NO BACKDOOR. This module wraps and delegates. It exports no mint, no forge, and no
// constructor; replay calls the recorded function itself.

const PLAIN = (v) => {
  if (v === null || typeof v !== 'object') return false;
  const p = Object.getPrototypeOf(v);
  return p === Object.prototype || p === null || Array.isArray(v);
};

export const KIND = { DERIVED: 'DERIVED', FOREIGN: 'FOREIGN', OPAQUE: 'OPAQUE', LEAF: 'LEAF' };

export function recorder() {
  const byResult = new WeakMap();      // returned object -> node id. IDENTITY, not shape.
  const nodes = [];
  const opaques = [];                  // things held by reference because they cannot be rebuilt
  const brands = [];                   // predicates exported BY THE SUBJECT
  let depth = 0;

  const isBranded = (v) => brands.some((b) => { try { return !!b(v); } catch { return false; } });

  // Encode one argument as a template. Recorded objects become references; everything else is
  // classified by what it IS, and the classification is recorded so nothing is inferred later.
  function encode(v, seen) {
    if (v !== null && typeof v === 'object') {
      if (byResult.has(v)) return { __ref: byResult.get(v) };
      if (isBranded(v)) { opaques.push(v); return { __foreign: opaques.length - 1 }; }
      if (seen.has(v)) { opaques.push(v); return { __opaque: opaques.length - 1, cyclic: true }; }
      if (!PLAIN(v)) { opaques.push(v); return { __opaque: opaques.length - 1 }; }
      seen.add(v);
      const out = Array.isArray(v) ? v.map((x) => encode(x, seen))
        : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, encode(x, seen)]));
      seen.delete(v);
      return Array.isArray(v) ? { __array: out } : { __object: out };
    }
    if (typeof v === 'function') { opaques.push(v); return { __opaque: opaques.length - 1 }; }
    return { __leaf: v };
  }

  // Rebuild from a template, re-running referenced nodes through their OWN recorded functions.
  function decode(t, memo, mut, state) {
    if (Object.hasOwn(t, '__leaf')) return t.__leaf;
    if (Object.hasOwn(t, '__ref')) return run(nodes[t.__ref], memo, mut, state);
    if (Object.hasOwn(t, '__foreign') || Object.hasOwn(t, '__opaque')) {
      return opaques[t.__foreign ?? t.__opaque];
    }
    if (Object.hasOwn(t, '__array')) return t.__array.map((x) => decode(x, memo, mut, state));
    return Object.fromEntries(Object.entries(t.__object)
      .map(([k, x]) => [k, decode(x, memo, mut, state)]));
  }

  // Re-execute one node. Memoized per replay, so two premises that were the SAME object stay the same
  // object and two that were distinct stay distinct - the sharing structure is part of the recipe.
  //
  // `mut` replaces ONE node's argument template. The intervention therefore lands on FACTS, before
  // any constructor runs, and every object downstream of it is minted by the production path from the
  // perturbed world. Nothing here copies, edits or constructs an authority object.
  function run(node, memo, mut, state) {
    if (memo.has(node.id)) return memo.get(node.id);
    const tpl = (mut && mut.node === node.id) ? mut.args : node.args;
    const args = tpl.map((a) => decode(a, memo, mut, state));
    let r;
    try { r = node.fn(...args); } catch (e) {
      if (state) { state.threwAt = node.id; state.error = e.message; }
      throw e;
    }
    memo.set(node.id, r);
    if (state) state.results.set(node.id, r);
    return r;
  }

  const api = {
    // The subject's own authority predicate. Supplied by the subject, never written here.
    brand(pred) { if (typeof pred === 'function') brands.push(pred); return api; },

    instrument(op, fn) {
      if (typeof fn !== 'function') return fn;
      return function instrumented(...args) {
        const at = depth;
        // ENCODED AT ENTRY, NOT AT EXIT. A subject that mutates its own arguments would otherwise be
        // recorded as having been called with the mutated values, and the replay would issue a call
        // that never happened - silently, and only for subjects that mutate. Recording the call means
        // recording what was PASSED.
        const seen = new Set();
        const encoded = args.map((a) => encode(a, seen));
        depth++;
        let result, threw;
        try { result = fn.apply(this, args); } catch (e) { threw = e; } finally { depth--; }
        const node = { id: nodes.length, op, root: at === 0, fn, args: encoded,
          threw: threw ? String(threw && threw.message) : undefined };
        nodes.push(node);
        // THE OUTERMOST PRODUCER WINS. When a recorded function returns another recorded call's
        // value unchanged - a validating wrapper, say - the first version kept the INNER producer,
        // and replay then rebuilt the value by calling the inner function directly. The wrapper's
        // own refusal was silently skipped, so a perturbation it would have rejected sailed through
        // and was scored. Calls complete inner-first, so overwriting keeps the call closest to the
        // consumer, which is the one the consumer actually got the value from.
        if (!threw && result !== null && typeof result === 'object') {
          byResult.set(result, node.id);
        }
        node.result = threw ? undefined : result;
        if (threw) throw threw;
        return result;
      };
    },

    nodes: () => nodes.slice(),
    // A witness is a ROOT call plus everything reachable from it. Reachability is by recorded
    // identity, so an edge exists only where one call actually consumed another call's value.
    witnesses(op) {
      return nodes.filter((n) => n.root && (op === undefined || n.op === op))
        .map((n) => ({ root: n, ...closure(n) }));
    },
    replay(w) { return replay(w); },
    leaves(w) { return w.leaves; },
    clear() { nodes.length = 0; opaques.length = 0; depth = 0; },

    // ---- the surface AUTO-CF-1 builds on. None of it can construct anything: `rebuild` re-runs the
    // recorded functions, and `argsOf` decodes a template into the values that would be passed.
    node: (id) => nodes[id],
    isAuthorityObject: (v) => isBranded(v),
    argsOf(node, tpl) {
      const state = { results: new Map() };
      try { return { ok: true, args: (tpl || node.args).map((a) => decode(a, new Map(), null, state)) }; }
      catch (e) { return { ok: false, why: e.message }; }
    },
    rebuild(w, mut) {
      const state = { results: new Map(), threwAt: null, error: null };
      try { return { ok: true, result: run(w.root, new Map(), mut, state), state }; }
      catch { return { ok: false, state }; }
    },
  };

  function closure(root) {
    const ids = new Set();
    const leaves = [];
    const foreign = [];
    // `keys` is the addressable route to the leaf - the argument index, then the object keys and
    // array indices to reach it. A path STRING is for reading; the keys are what an intervention
    // navigates, so no part of this addresses anything by the name it happens to share with an output.
    const walk = (t, id, path, keys) => {
      if (Object.hasOwn(t, '__leaf')) { leaves.push({ node: id, path: path.join(''), keys }); return; }
      if (Object.hasOwn(t, '__ref')) { visit(nodes[t.__ref]); return; }
      if (Object.hasOwn(t, '__foreign')) { foreign.push({ node: id, path: path.join('') }); return; }
      if (Object.hasOwn(t, '__opaque')) return;
      if (Object.hasOwn(t, '__array')) {
        t.__array.forEach((x, i) => walk(x, id, [...path, '[' + i + ']'], [...keys, i])); return;
      }
      for (const [k, x] of Object.entries(t.__object)) walk(x, id, [...path, '.' + k], [...keys, k]);
    };
    const visit = (n) => {
      if (ids.has(n.id)) return;
      ids.add(n.id);
      n.args.forEach((a, i) => walk(a, n.id, ['arg[' + i + ']'], [i]));
    };
    visit(root);
    const ord = [...ids].sort((a, b) => a - b);
    return { ids: ord, list: ord.map((i) => nodes[i]), leaves, foreign };
  }

  // BASELINE REPLAY. A recipe that cannot reproduce its own result is not a recipe, and nothing may
  // be measured against it.
  function replay(w) {
    if (w.foreign.length) {
      return { ok: false, reason: 'FOREIGN_INPUT',
        why: 'the call consumed ' + w.foreign.length + ' authority object(s) that no recorded call'
          + ' produced (' + w.foreign.map((f) => f.path).join(', ') + '), so its construction history'
          + ' is incomplete and no legitimate rebuild exists' };
    }
    let out;
    try { out = run(w.root, new Map(), null, null); } catch (e) {
      return { ok: false, reason: 'REPLAY_THREW', why: 'replaying the recorded recipe threw: ' + e.message };
    }
    const a = semantic(w.root.result);
    const b = semantic(out);
    if (a !== b) {
      return { ok: false, reason: 'DIVERGED', result: out,
        why: 'the rebuild did not reproduce the original result, so no later difference could be'
          + ' attributed to an intervention rather than to the rebuild' };
    }
    return { ok: true, result: out };
  }

  return api;
}

// Semantic identity of a result. Plain structure is compared by value; anything else by identity, so
// two distinct unrecordable objects never compare equal just because they print the same.
const IDS = new WeakMap();
let nextId = 1;
export function semantic(v) {
  const seen = new Set();
  const walk = (x) => {
    if (x === null || typeof x !== 'object') return typeof x === 'function' ? '<fn>' : JSON.stringify(x) ?? 'undefined';
    if (seen.has(x)) return '<cycle>';
    if (!PLAIN(x)) { if (!IDS.has(x)) IDS.set(x, nextId++); return '<obj#' + IDS.get(x) + '>'; }
    seen.add(x);
    const s = Array.isArray(x) ? '[' + x.map(walk).join(',') + ']'
      : '{' + Object.keys(x).sort().map((k) => JSON.stringify(k) + ':' + walk(x[k])).join(',') + '}';
    seen.delete(x);
    return s;
  };
  return walk(v);
}

// A readable recipe. This is what replaces the hand-written driver, and it is derived, not authored.
export function describe(w) {
  const short = (t) => {
    if (Object.hasOwn(t, '__leaf')) return JSON.stringify(t.__leaf);
    if (Object.hasOwn(t, '__ref')) return '#' + t.__ref;
    if (Object.hasOwn(t, '__foreign')) return '<FOREIGN authority>';
    if (Object.hasOwn(t, '__opaque')) return '<opaque>';
    if (Object.hasOwn(t, '__array')) return '[' + t.__array.map(short).join(', ') + ']';
    return '{' + Object.entries(t.__object).map(([k, x]) => k + ': ' + short(x)).join(', ') + '}';
  };
  return w.list.map((n) => '#' + n.id + '  ' + n.op + '(' + n.args.map(short).join(', ') + ')'
    + (n.threw ? '   THREW ' + n.threw : ''));
}
