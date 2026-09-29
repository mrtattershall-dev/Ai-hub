'use strict';
// =============================================================================
// BEHAVIOR WIRE (RD-B1/B2) — the rule-IR an untrusted model emits to author
// LOGIC, validated BEFORE IT RUNS. The behavior-layer sibling of protocol.js:
// protocol.js gates a model's DATA diffs; this gates a model's BEHAVIORS.
// =============================================================================
// RD-B1 measured four shapes (rules / terminating DSL / sandboxed-ops /
// sandboxed-direct) against real+adversarial corpora: RULES was the only shape
// with zero admitted attacks — loops, RNG and hidden state are UNREPRESENTABLE
// in the grammar, cross-pool writes and unprovable ranges are STATICALLY
// rejected with localized errors, spawns require a declared per-tick cap.
//
// A rule (what the model emits, as JSON):
//   { "name": "wilt",
//     "match": { "type": "crop", "uuid":"u2", "where": {"field":"water","cmp":"==","value":0} },
//     "every": 1,                              // optional: run each N ticks
//     "effects": [ {"set":"growth","to":{"max":[{"sub":[{"field":"growth"},2]},0]}} ] }
//   `match.uuid` is optional exact identity scoping. It composes with `where`:
//   both must match. It is deliberately a first-class selector rather than a
//   pseudo-field (e.g. `where: {field:"id"...}`), because UUID identity is not
//   component data and must be resolved through RD-004's live/deleted/missing
//   boundary before the behavior can ever run.
//   Pred   = {field,cmp,value} | {all:[Pred..]} | {any:[Pred..]}
//   Effect = {set,to:Expr} | {delete:true} | {reparent:{to:uuid}}
//          | {spawn:{type,props?,cap}}         // cap 1..16, statically required
//   Expr   = number | {field:f} | {add|sub|mul|min|max:[Expr,Expr]}
//            RD-028: `mul` + SIGNED field ranges are what make branchless
//            conditionals authorable: `v + cond * delta` where cond is a
//            0/1 count. Interval-provable (4 corner products); no new safety
//            surface (loops/RNG/hidden state remain unrepresentable).
//          | {count:{type, where?:Pred, of?}}  // RD-B2/B4 BOUNDED aggregation —
//            closes RD-B1's ceiling (R8) by extending the checkable grammar
//            instead of escaping to code. Interval [0, capacity].
//          | {sum:{field, type, where?:Pred, of?}}  // RD-B7: bounded SUM of a
//            numeric field. Interval [0, capacity*max] — capacity-aware, so the
//            author must clamp when it can overflow.
//          | {min:{...}} | {max:{...}}  // RD-B7.1: min/max of a field over
//            matching entities (OBJECT arg — distinct from the binary min/max
//            OPERATORS which take an ARRAY {min:[e,e]}). Interval = the field's
//            own [min,max] (empty pool -> 0).
//          `of` (RD-B7/B7.1): "all" (default, global) | "children" (direct
//            children) | "subtree" (transitive descendants) — the containment
//            graph's "spatial" scope. All bounded by capacity; the range proof
//            is unchanged. Scoped aggregation reads self via the matched uuid.
//
// A valid rule compiles to a phase-0 system (pure fn of the pre-tick view ->
// ops) and inherits the whole pipeline: RD-003 determinism, RD-005 fold/defer
// against players and other rules, RD-017 atomic staging, RD-020 one-tick-one-
// undo, RD-B2 range/budget/capacity backstops. Deterministic + terminating BY
// CONSTRUCTION (one pass over matched entities; exprs are total arithmetic).
// Zero deps.
// =============================================================================
const { TYPE, TYPE_NAME, FIELD_OWNER, FIELD_RANGE } = require('./engine.js');

const SPAWN_CAP_MAX = 16;
const CMPS = { '<': (a,b)=>a<b, '<=': (a,b)=>a<=b, '==': (a,b)=>a===b, '>=': (a,b)=>a>=b, '>': (a,b)=>a>b, '!=': (a,b)=>a!==b };
// field metadata derived from the ENGINE's own invariants (single source):
// owner type name + integer range. `name` is universal/string (no range).
// RD-024: the vocabulary is now per-WORLD (instance schema). parseRule swaps
// these module bindings from the engine's schema at entry — safe because Node
// is single-threaded and validation is fully synchronous; the default farm
// tables are only the boot value.
// Per-TYPE field namespace (paddle.y and ball.y coexist, RD-024): lookups are
// (ownType, field); 'unknown_field' = no type owns it, 'field_not_owned' =
// some OTHER type does. `all` keeps the flat-list detail strings.
const metaFor = (schema) => ({
  byType: Object.fromEntries(schema.defs.map((d) => [d.name,
    Object.fromEntries(Object.entries(d.fields).filter(([, sp]) => sp.pool !== false)
      .map(([f, sp]) => [f, { type: d.name, min: sp.range[0], max: sp.range[1] }]))])),
  all: [...new Set(schema.defs.flatMap((d) =>
    Object.entries(d.fields).filter(([, sp]) => sp.pool !== false).map(([f]) => f)))],
  owners: (f) => schema.defs.filter((d) => d.fields[f] && d.fields[f].pool !== false).map((d) => d.name),
});
let META = { byType: {}, all: [], owners: () => [] };   // boot value; parseRule swaps in the world's schema
let TYPES = TYPE_NAME;
let SPATIAL = {};                                        // RD-025: typeName -> {x,y} | undefined
// -> {m} | {owner: <other type that owns it>} | {unknown:true}
const fieldMeta = (ownType, f) => {
  const m = META.byType[ownType]?.[f];
  if (m) return { m };
  const owners = META.owners(f);
  return owners.length ? { owner: owners[0] } : { unknown: true };
};

// ---- static validation ------------------------------------------------------
// Every error is localized: { rule, where, code, detail } — re-promptable, the
// RD-018.1 discipline (error TEXT specificity is load-bearing for weak models).
// RD-B7 aggregation scope: undefined/'all' = global (RD-B4 default), 'children'
// = the matched entity's direct children (the containment graph's "spatial"
// neighbourhood). Both are bounded by capacity, so the range proof is unchanged.
// RD-025: `of` may also be {near: R} — entities of the aggregated type whose
// declared coordinates lie within integer radius R of the MATCHED entity's own
// (self is excluded, like children/subtree exclude self). Still a SUBSET of the
// global pool, so every range-proof interval below is unchanged.
function checkScope(of, errs, where, ownType, targetType) {
  if (of !== undefined && of !== null && typeof of === 'object') {
    if (!('near' in of) || Object.keys(of).length !== 1) {
      errs.push({ where, code: 'bad_scope', detail: `object scope must be exactly {near: <integer radius>}` });
      return false;
    }
    const r = of.near;
    let bad = false;
    if (!Number.isInteger(r) || r < 0) {
      errs.push({ where, code: 'bad_scope', detail: `near radius must be a non-negative integer (got ${JSON.stringify(r)})` }); bad = true;
    }
    for (const [ty, role] of [[ownType, 'the matched type'], [targetType, 'the aggregated type']]) {
      if (ty !== undefined && !SPATIAL[ty]) {
        errs.push({ where, code: 'not_spatial', detail: `${ty} (${role}) declares no coordinates — define it with spatial:{x,y} to use near` }); bad = true;
      }
    }
    return !bad;
  }
  if (of !== undefined && of !== 'all' && of !== 'children' && of !== 'subtree') {
    errs.push({ where, code: 'bad_scope', detail: `of "${of}" — use "all" (default), "children", "subtree", or {near: R}` });
    return false;
  }
  return true;
}
// RD-B7.1: validate a field-aggregation spec {field,type,where?,of?} used by
// sum/min/max. Returns the owning field META or null (on error).
function checkFieldAgg(s, errs, where, capacity, ownType) {
  if (!TYPES.includes(s.type)) { errs.push({ where, code: 'unknown_type', detail: s.type }); return null; }
  const r = fieldMeta(s.type, s.field);
  if (r.unknown) { errs.push({ where, code: 'unknown_field', detail: `${s.field} — needs a numeric field: ${META.all.join(',')}` }); return null; }
  if (r.owner) { errs.push({ where, code: 'field_not_owned', detail: `${s.field} is a ${r.owner} field but the aggregation is over ${s.type}` }); return null; }
  if (!checkScope(s.of, errs, where, ownType, s.type)) return null;
  if (s.where) checkPred(s.where, s.type, errs, where, capacity);
  return r.m;
}
function checkPred(p, ownType, errs, where, capacity) {
  if (!p || typeof p !== 'object') return errs.push({ where, code: 'bad_pred' });
  if (p.all) return p.all.forEach(q => checkPred(q, ownType, errs, where, capacity));
  if (p.any) return p.any.forEach(q => checkPred(q, ownType, errs, where, capacity));
  const r = fieldMeta(ownType, p.field);
  if (r.unknown) return errs.push({ where, code: 'unknown_field', detail: `${p.field} — known: ${META.all.join(',')}` });
  if (r.owner) return errs.push({ where, code: 'field_not_owned', detail: `${p.field} is a ${r.owner} field but this predicate matches ${ownType}` });
  if (!CMPS[p.cmp]) return errs.push({ where, code: 'bad_cmp', detail: `${p.cmp} — use <,<=,==,>=,>,!=` });
  if (typeof p.value !== 'number') return errs.push({ where, code: 'bad_value' });
}
// interval arithmetic: the RANGE PROOF. Returns [lo,hi] reachable by the expr.
function checkExpr(x, ownType, errs, where, capacity) {
  if (typeof x === 'number') { if (!Number.isInteger(x)) errs.push({ where, code: 'noninteger_const', detail: String(x) }); return [x, x]; }
  if (x && typeof x === 'object') {
    if ('field' in x) {
      const r = fieldMeta(ownType, x.field);
      if (r.unknown) { errs.push({ where, code: 'unknown_field', detail: x.field }); return [0, 0]; }
      if (r.owner) { errs.push({ where, code: 'field_not_owned', detail: `${x.field} is ${r.owner}, rule matches ${ownType}` }); return [0, 0]; }
      return [r.m.min, r.m.max];
    }
    if ('count' in x) { // bounded aggregation: count entities of a type matching a pred
      const t = x.count.type;
      if (!TYPES.includes(t)) { errs.push({ where, code: 'unknown_type', detail: t }); return [0, 0]; }
      if (!checkScope(x.count.of, errs, where + '.count', ownType, t)) return [0, 0];
      if (x.count.where) checkPred(x.count.where, t, errs, where + '.count', capacity); // pred fields owned by the COUNTED type
      return [0, capacity];   // <= capacity entities total (RD-B4); children scope is a subset
    }
    if ('sum' in x) { // RD-B7: bounded SUM of a numeric field over matching entities
      const m = checkFieldAgg(x.sum, errs, where + '.sum', capacity, ownType);
      if (!m) return [0, 0];
      // capacity-aware bound: <= capacity entities, each field in [min,max].
      return [capacity * Math.min(0, m.min), capacity * m.max];
    }
    // RD-B7.1: min/max as FIELD AGGREGATIONS (object arg) — vs the binary
    // min/max operators (array arg) below. A field's min/max over matching
    // entities stays within the field's OWN range (empty set -> 0).
    for (const agg of ['min', 'max']) if (agg in x && !Array.isArray(x[agg])) {
      const m = checkFieldAgg(x[agg], errs, where + '.' + agg, capacity, ownType);
      if (!m) return [0, 0];
      return [Math.min(0, m.min), m.max];
    }
    for (const op of ['add', 'sub', 'mul', 'min', 'max']) if (op in x && Array.isArray(x[op])) {
      if (x[op].length !== 2) { errs.push({ where, code: 'bad_arity', detail: op }); return [0, 0]; }
      const [a, b] = x[op].map(y => checkExpr(y, ownType, errs, where, capacity));
      if (op === 'add') return [a[0] + b[0], a[1] + b[1]];
      if (op === 'sub') return [a[0] - b[1], a[1] - b[0]];
      // RD-028 mul: interval = the extremes of the four corner products. Total,
      // deterministic, statically provable — loops/RNG/hidden state stay
      // unrepresentable, so the grammar's safety properties are untouched. It is
      // what makes branchless conditionals (cond * value) authorable.
      if (op === 'mul') { const p = [a[0] * b[0], a[0] * b[1], a[1] * b[0], a[1] * b[1]];
        return [Math.min(...p), Math.max(...p)]; }
      if (op === 'min') return [Math.min(a[0], b[0]), Math.min(a[1], b[1])];
      return [Math.max(a[0], b[0]), Math.max(a[1], b[1])];
    }
  }
  errs.push({ where, code: 'bad_expr', detail: JSON.stringify(x)?.slice(0, 40) });
  return [0, 0];
}

// RD-031: does this expression read any world state? A constant-valued expression
// that reads nothing is a legitimate `set x to 5`; one that reads fields and STILL
// cannot vary is a bug the interval proof can see.
function referencesField(x) {
  if (!x || typeof x !== 'object') return false;
  if ('field' in x || 'count' in x || 'sum' in x) return true;
  for (const op of ['add', 'sub', 'mul', 'min', 'max'])
    if (op in x) {
      if (!Array.isArray(x[op])) return true;                 // object-form min/max = an aggregation
      if (x[op].some(referencesField)) return true;
    }
  return false;
}

// Does this expression read the matched entity's OWN field `f` (a {field:f} read)?
// Aggregations (count/sum, object-form min/max) read OTHER entities' fields, not
// self — they do NOT make a write self-referential — so we recurse ONLY into
// array-form arithmetic. This is the precise "F = g(F)" test.
function referencesFieldNamed(x, f) {
  if (!x || typeof x !== 'object') return false;
  if (x.field === f) return true;
  for (const op of ['add', 'sub', 'mul', 'min', 'max'])
    if (op in x && Array.isArray(x[op]) && x[op].some((e) => referencesFieldNamed(e, f))) return true;
  return false;
}

// =============================================================================
// RD-035 — the UNCONDITIONAL-WRITE smell (author-time advisory, NEVER a reject).
// A branchless conditional write is still an UNCONDITIONAL write. A rule whose
// effect is `set F to <expr reading F>` with NO where-guard writes F on every
// entity of its type EVERY tick — and on the ticks where the expr evaluates to
// F's current value (the intended "else, leave it alone") it is STILL a write of
// F, so it enters RD-005 arbitration. When F has no fold, any concurrent writer
// of F on the same entity that tick — another rule OR a plain player command —
// DEFERS, and neither change applies. The gate is behaving correctly; the AUTHOR
// almost never intends it.
//
// MEASURED LIVE (2026-07-17): Pong's `paddle_move` (match {type:paddle}, no where,
// `set y to clamp(y + input_dir*speed)`) silently defeated the editor's flagship
// "move left paddle down" — the player's y write DEFERRED against the rule's no-op
// y=y write every tick (intent2_e2e_pong_test.js). This class of bug is invisible
// (it only shows as deferral spam) and a non-technical author cannot diagnose it
// from a raw deferral message — exactly the kind of thing an AI-authored rule will
// produce constantly. So the gate now NAMES it at install/propose time.
//
// PRECISION (why this doesn't cry wolf): flagged iff  (no where/uuid guard)  AND
// (F is non-foldable)  AND  (the effect expr reads F itself). In Pong v2 that fires
// on exactly `ball_move_y` (a true, dismissable "physics owns the ball's y —
// confirm intended") and, before its fix, `paddle_move` (the real bug) — the
// guarded bounce/reset/score rules are correctly silent. Advisory only: `ok` stays
// true; these ride on the install result as `warnings`, distinct from `errors`.
// =============================================================================
function writeSmells(engine, rule) {
  const out = [];
  const t = rule?.match?.type;
  const def = engine.w.schema.defs.find((d) => d.name === t);
  if (!def) return out;
  const foldOf = (f) => def.fields?.[f]?.fold;                 // undefined => non-foldable => contention DEFERS
  const guarded = !!(rule.match?.where || rule.match?.uuid);   // some discriminating condition on which entities/ticks
  const otherWritersOf = (f) => {
    const names = [];
    for (const [name, src] of (engine.ruleSources ?? new Map())) {
      if (name === rule.name) continue;                       // exclude the rule being (re)installed (replace case)
      if (src?.match?.type !== t) continue;                   // a different subject type can't contend on the SAME entity
      if ((src.effects ?? []).some((ef) => ef.set === f)) names.push(name);
    }
    return names;
  };
  for (const ef of (rule.effects ?? [])) {
    if (ef?.set === undefined || ef.set === 'name') continue;
    const f = ef.set;
    if (foldOf(f)) continue;                                   // foldable => concurrent writes MERGE, no silent stall
    const others = otherWritersOf(f);
    if (!guarded && referencesFieldNamed(ef.to, f)) {
      out.push({ rule: rule.name, where: 'effects', code: 'unconditional_write',
        detail: `'${rule.name}' writes '${f}' of every ${t} every tick as a function of '${f}' itself, with no where-guard — a branchless write of ${f}'s current value is still a write, so it enters arbitration every tick. `
          + `Because ${f} has no fold, any concurrent writer of ${f} on the same ${t} — a player command or another rule — DEFERS and neither change applies`
          + (others.length ? ` (${others.length} other rule(s) also write ${f}: ${others.join(', ')})` : ``)
          + `. If ${f} should change only sometimes, add a where-guard so this rule fires only then; if simultaneous writes should combine, declare a fold on ${f}. Confirm this every-tick write is intended.` });
    } else if (!guarded && others.length) {
      out.push({ rule: rule.name, where: 'effects', code: 'contended_field',
        detail: `'${rule.name}' writes '${f}' of every ${t} unconditionally, and ${others.length} other rule(s) also write ${f}: ${others.join(', ')}. ${f} has no fold, so whenever two of them match the same ${t} in one tick the write DEFERS and neither applies. Scope the writers apart with mutually-exclusive where-guards, or declare a fold on ${f}.` });
    }
  }
  return out;
}

// ---- evaluation (only ever reached by a VALIDATED rule) ---------------------
function evalPred(p, get) {
  if (p.all) return p.all.every(q => evalPred(q, get));
  if (p.any) return p.any.some(q => evalPred(q, get));
  return CMPS[p.cmp](get(p.field), p.value);
}
// aggregation pool for count/sum: global (allOfType) or the matched entity's
// direct children of that type ('children' scope). `self` is the current
// matched entity's uuid (RD-B7 threads it in for scoped aggregations).
// ---- RD-026 acceleration ------------------------------------------------------
// Two mechanisms, both behind an UNCHANGED grammar, both keyed on the fact that a
// rule reads a FROZEN pre-tick view (RD-B1: systems are pure fns of pre-tick
// state), so nothing observable can change while one rule evaluates:
//   H1 memoize scope-invariant aggregations — an `of:'all'` aggregate does not
//      depend on the matched entity, so it is ONE value per (spec, tick): O(M*P) -> O(P).
//   H2 uniform grid for `near` — coordinates are bounded integers with a declared
//      range, so the field IS a grid; cell = radius makes a 3x3 cell scan cover the
//      query circle exactly. O(M*P) -> O(M*k).
// The cache is created per rule-evaluation and dies with it — no cross-tick state,
// nothing to invalidate, so undo/persistence/conflict layers are untouched.
// `setAccel(false)` exists ONLY so the equivalence bar can diff ON vs OFF.
let ACCEL = true;
const setAccel = (v) => { ACCEL = v !== false; };
const CELLS = 65536;                              // coords are bounded >= 0, so keys stay non-negative
function buildGrid(view, type, cell) {
  const g = new Map();
  for (const u of view.allOfType(type)) {         // insertion follows allOfType (deterministic)
    const c = view.coordsOf(u);
    if (!c) continue;
    const k = ((c.y / cell) | 0) * CELLS + ((c.x / cell) | 0);
    const b = g.get(k) ?? g.set(k, []).get(k);
    b.push({ u, x: c.x, y: c.y });                // carry coords: coordsOf is a map lookup, not free
  }
  return g;
}
function aggPool(spec, view, self, cache) {
  // RD-025 proximity scope. INTEGER squared distance — never sqrt, never floats:
  // RD-003 determinism and cross-machine replay depend on exact integer compare.
  // Excludes self (consistent with children/subtree). Validation guarantees both
  // types declare coordinates before this can ever run.
  if (spec.of && typeof spec.of === 'object' && spec.of.near !== undefined) {
    const c0 = view.coordsOf(self);
    if (!c0) return [];
    const R = spec.of.near, r2 = R * R;
    if (ACCEL && cache && R > 0) {                // H2: grid-accelerated
      const cell = R;
      const gk = `grid:${spec.type}:${cell}`;
      let grid = cache.get(gk);
      if (!grid) { grid = buildGrid(view, spec.type, cell); cache.set(gk, grid); }
      const cx = (c0.x / cell) | 0, cy = (c0.y / cell) | 0;
      const out = [];
      for (let gy = Math.max(0, cy - 1); gy <= cy + 1; gy++)
        for (let gx = Math.max(0, cx - 1); gx <= cx + 1; gx++) {
          const b = grid.get(gy * CELLS + gx);
          if (!b) continue;
          for (const e of b) {
            if (e.u === self) continue;
            const dx = e.x - c0.x, dy = e.y - c0.y;
            if (dx * dx + dy * dy <= r2) out.push(e.u);
          }
        }
      return out;
    }
    const out = [];
    for (const u of view.allOfType(spec.type)) {
      if (u === self) continue;
      const c = view.coordsOf(u);
      if (!c) continue;
      const dx = c.x - c0.x, dy = c.y - c0.y;
      if (dx * dx + dy * dy <= r2) out.push(u);
    }
    return out;
  }
  if (spec.of === 'children')
    return view.childrenOf(self).filter(u => view.typeOf(u) === spec.type);
  if (spec.of === 'subtree') {                    // RD-B7.1: transitive descendants
    const out = [], seen = new Set(); let frontier = view.childrenOf(self);
    while (frontier.length) {
      const next = [];
      for (const u of frontier) if (!seen.has(u)) { seen.add(u);      // acyclic (RD-005.2), seen guards anyway
        if (view.typeOf(u) === spec.type) out.push(u);
        next.push(...view.childrenOf(u)); }
      frontier = next;
    }
    return out;
  }
  return view.allOfType(spec.type);
}
// values of a field over an aggregation pool matching its where.
function aggValues(spec, view, self, cache) {
  const vals = [];
  for (const u of aggPool(spec, view, self, cache))
    if (!spec.where || evalPred(spec.where, (f) => view.field(u, f))) vals.push(view.field(u, spec.field));
  return vals;
}
// H1: is this aggregation independent of the matched entity? Only global scope is
// (children/subtree/near all read `self`). The compiled spec object is a stable
// identity across ticks, so it IS the cache key — no serialization needed.
const scopeInvariant = (spec) => spec.of === undefined || spec.of === 'all';
const memo = (cache, spec, compute) => {
  if (!ACCEL || !cache || !scopeInvariant(spec)) return compute();
  if (cache.has(spec)) return cache.get(spec);
  const v = compute();
  cache.set(spec, v);
  return v;
};
function evalExpr(x, get, view, self, cache) {
  if (typeof x === 'number') return x;
  if ('field' in x) return get(x.field);
  if ('count' in x) return memo(cache, x.count, () => {
    let n = 0;
    for (const u of aggPool(x.count, view, self, cache))
      if (!x.count.where || evalPred(x.count.where, (f) => view.field(u, f))) n++;
    return n;
  });
  if ('sum' in x) return memo(cache, x.sum, () => aggValues(x.sum, view, self, cache).reduce((a, b) => a + b, 0));
  // min/max FIELD aggregation (object arg); empty pool -> 0.
  if ('min' in x && !Array.isArray(x.min)) return memo(cache, x.min, () => { const v = aggValues(x.min, view, self, cache); return v.length ? Math.min(...v) : 0; });
  if ('max' in x && !Array.isArray(x.max)) return memo(cache, x.max, () => { const v = aggValues(x.max, view, self, cache); return v.length ? Math.max(...v) : 0; });
  if ('add' in x) return evalExpr(x.add[0], get, view, self, cache) + evalExpr(x.add[1], get, view, self, cache);
  if ('sub' in x) return evalExpr(x.sub[0], get, view, self, cache) - evalExpr(x.sub[1], get, view, self, cache);
  if ('mul' in x) return evalExpr(x.mul[0], get, view, self, cache) * evalExpr(x.mul[1], get, view, self, cache);
  if ('min' in x) return Math.min(evalExpr(x.min[0], get, view, self, cache), evalExpr(x.min[1], get, view, self, cache));
  return Math.max(evalExpr(x.max[0], get, view, self, cache), evalExpr(x.max[1], get, view, self, cache));
}

// =============================================================================
// parseRule(engine, jsonTextOrObject) ->
//   { ok:true, name, fn }  — fn is a phase-0 system, safe to registerSystem()
//   { ok:false, errors:[{rule,where,code,detail}] } — localized, re-promptable
// PURE: never mutates the engine.
// =============================================================================
function parseRule(engine, input) {
  META = metaFor(engine.w.schema); TYPES = engine.w.schema.TYPE_NAME;   // RD-024: this world's vocabulary
  SPATIAL = engine.w.schema.spatial ?? {};                               // RD-025
  let rule = input;
  if (typeof input === 'string') {
    try { rule = JSON.parse(input); }
    catch (e) { return { ok: false, errors: [{ where: 'json', code: 'malformed_json', detail: String(e.message).slice(0, 80) }] }; }
  }
  const errs = [];
  const capacity = engine.w.capacity;
  if (typeof rule?.name !== 'string' || !rule.name) errs.push({ where: 'name', code: 'missing_name' });
  // RD-030 STRICT KEYS: an unrecognised key is a REPAIRABLE MISTAKE, not noise.
  // MEASURED (RD-029, live Qwen-32B): the model knew it needed proximity and wrote
  // `"of":{"near":14}` at the RULE level, where it was silently dropped — installing
  // a bounce that fired every tick regardless of paddles and LOOKED correct. Ignoring
  // unknown keys converts a fixable error into a plausible lie; the repair loop had
  // three attempts left and no way to know. Hints name where the key belongs.
  if (rule && typeof rule === 'object') {
    const RULE_KEYS = new Set(['name', 'match', 'every', 'effects']);
    const HINT = { of: 'belongs INSIDE a count/sum/min/max aggregation', where: 'belongs inside match (match.where) or inside an aggregation',
      type: 'belongs inside match (match.type) or inside an aggregation', uuid: 'belongs inside match (match.uuid)',
      set: 'belongs inside an effects[] entry', to: 'belongs inside an effects[] entry',
      effect: 'did you mean "effects" (an array)?', rules: 'author ONE rule object, not a list' };
    for (const k of Object.keys(rule)) if (!RULE_KEYS.has(k))
      errs.push({ where: 'rule', code: 'unknown_key',
        detail: `"${k}" is not a rule key${HINT[k] ? ` — it ${HINT[k]}` : ''}. Rule keys: name, match, every, effects` });
    if (rule.match && typeof rule.match === 'object') {
      const MATCH_KEYS = new Set(['type', 'uuid', 'where']);
      for (const k of Object.keys(rule.match)) if (!MATCH_KEYS.has(k))
        errs.push({ where: 'match', code: 'unknown_key',
          detail: `"${k}" is not a match key${HINT[k] ? ` — it ${HINT[k]}` : ''}. Match keys: type, uuid, where` });
    }
  }
  const t = rule?.match?.type;
  if (!TYPES.includes(t)) {
    errs.push({ where: 'match', code: 'unknown_type', detail: `${t} — known: ${TYPES.join(',')}` });
    return { ok: false, errors: errs.map(e => ({ rule: rule?.name, ...e })) };
  }
  if (rule.match.uuid !== undefined) {
    if (typeof rule.match.uuid !== 'string' || !rule.match.uuid)
      errs.push({ where: 'match.uuid', code: 'bad_uuid', detail: 'must be a non-empty live uuid string' });
    else {
      const resolved = engine.w.resolve(rule.match.uuid);
      if (resolved.status !== 'live')
        errs.push({ where: 'match.uuid', code: 'target_not_live', detail: `${rule.match.uuid} is ${resolved.status}` });
      else if (TYPES[engine.w.type[resolved.e]] !== t)
        errs.push({ where: 'match.uuid', code: 'type_mismatch', detail: `${rule.match.uuid} is a ${TYPES[engine.w.type[resolved.e]]}, but match.type is ${t}` });
    }
  }
  if (rule.match.where) checkPred(rule.match.where, t, errs, 'match.where', capacity);
  if (rule.every !== undefined && (!Number.isInteger(rule.every) || rule.every < 1))
    errs.push({ where: 'every', code: 'bad_period', detail: 'must be an integer >= 1' });
  if (!Array.isArray(rule.effects) || !rule.effects.length) errs.push({ where: 'effects', code: 'no_effects' });
  for (const [k, ef] of (rule.effects ?? []).entries()) {
    const where = `effects[${k}]`;
    if (ef?.set !== undefined) {
      if (ef.set === 'name') { if (typeof ef.to !== 'string') errs.push({ where, code: 'bad_value', detail: 'name takes a string constant' }); continue; }
      const r = fieldMeta(t, ef.set);
      if (r.unknown) { errs.push({ where, code: 'unknown_field', detail: `${ef.set} — known: ${META.all.join(',')},name` }); continue; }
      if (r.owner) { errs.push({ where, code: 'field_not_owned', detail: `${ef.set} is a ${r.owner} field but this rule matches ${t}` }); continue; }
      const m = r.m;
      const [lo, hi] = checkExpr(ef.to, t, errs, where, capacity);
      // THE RANGE PROOF: reject any effect whose reachable interval escapes the
      // field's range — the author must STATE the clamp (min/max), the engine
      // never silently truncates (RD-B1/A5; RD-018 free-form corruption).
      if (lo < m.min || hi > m.max) errs.push({ where, code: 'range_unprovable',
        detail: `${ef.set} could reach [${lo},${hi}] but its range is [${m.min},${m.max}] — wrap with min/max to state your clamp` });
      // RD-031 DEGENERATE INTERVAL: the proof computed [c,c] for an expression that
      // READS FIELDS — i.e. the value can never vary, so the reads are dead. Almost
      // always an inverted clamp. MEASURED (RD-029, live Qwen-32B, BOTH arms, several
      // goals): `min:[max:[e,255],0]` is identically 0 and passes the range proof
      // honestly ([0,0] IS in range) — perfectly safe, entirely useless. The gate
      // already KNOWS the interval; saying so turns a silent no-op into a repair.
      else if (lo === hi && referencesField(ef.to)) errs.push({ where, code: 'degenerate_expr',
        detail: `${ef.set} always evaluates to exactly ${lo} even though it reads fields — the value can never change.`
          + ` A clamp is usually min:[max:[expr, ${m.min}], ${m.max}] (max with the LOW bound first, then min with the HIGH bound);`
          + ` min:[max:[expr, ${m.max}], ${m.min}] collapses to a constant.` });
    } else if (ef?.delete) { /* always valid */ }
    else if (ef?.reparent) {
      if (typeof ef.reparent.to !== 'string') errs.push({ where, code: 'bad_reparent', detail: 'reparent.to must be a uuid string' });
      else if (engine.w.resolve(ef.reparent.to).status !== 'live') errs.push({ where, code: 'target_not_live', detail: `reparent.to ${ef.reparent.to} is ${engine.w.resolve(ef.reparent.to).status}` });
    } else if (ef?.spawn) {
      if (!TYPES.includes(ef.spawn.type)) errs.push({ where, code: 'unknown_type', detail: ef.spawn.type });
      if (!Number.isInteger(ef.spawn.cap) || ef.spawn.cap < 1 || ef.spawn.cap > SPAWN_CAP_MAX)
        errs.push({ where, code: 'spawn_cap_required', detail: `spawn must declare "cap": 1..${SPAWN_CAP_MAX} (per tick) — bounded growth is a static requirement` });
      // RD-035 audit: spawn props are written into the pools at CREATION with no range
      // check (an out-of-range prop was silently wrapped). Reject unknown / out-of-range
      // props at AUTHOR time so the gate teaches — same discipline as the setfield range
      // proof; the engine's createChild validate layer is the runtime backstop.
      if (TYPES.includes(ef.spawn.type)) for (const [pf, pv] of Object.entries(ef.spawn.props ?? {})) {
        if (pf === 'name') { if (typeof pv !== 'string') errs.push({ where, code: 'bad_value', detail: 'spawn name must be a string' }); continue; }
        const pm = META.byType[ef.spawn.type]?.[pf];
        if (!pm) { errs.push({ where, code: 'unknown_field', detail: `${pf} is not a pooled field of ${ef.spawn.type}` }); continue; }
        if (!Number.isInteger(pv) || pv < pm.min || pv > pm.max) errs.push({ where, code: 'range_unprovable', detail: `spawn prop ${pf}=${pv} outside [${pm.min},${pm.max}] — clamp it or pass an in-range value` });
      }
    } else errs.push({ where, code: 'unknown_effect', detail: 'use set/delete/reparent/spawn' });
  }
  if (errs.length) return { ok: false, errors: errs.map(e => ({ rule: rule?.name, ...e })) };

  const fn = (view) => {
    if (rule.every && view.tick % rule.every !== 0) return [];
    const ops = [];
    let spawned = 0;
    const cache = new Map();                      // RD-026: per-evaluation only; dies with this call
    for (const u of view.allOfType(t)) {          // ascending index: deterministic
      if (rule.match.uuid !== undefined && u !== rule.match.uuid) continue;
      const get = (f) => view.field(u, f);
      if (rule.match.where && !evalPred(rule.match.where, get)) continue;
      for (const ef of rule.effects) {
        if (ef.set !== undefined) ops.push({ kind: 'setfield', target: u, field: ef.set, value: ef.set === 'name' ? ef.to : evalExpr(ef.to, get, view, u, cache) });
        else if (ef.delete) ops.push({ kind: 'delete', target: u });
        else if (ef.reparent) ops.push({ kind: 'reparent', target: u, parent: ef.reparent.to });
        else if (ef.spawn && spawned < ef.spawn.cap) { spawned++;
          // RD-032 FIX: resolve against THIS WORLD's schema, not the module-level
          // farm table. Pre-fix this read TYPE['ENEMY2'] -> undefined -> spawn()
          // crashed on `schema.defs[undefined].fields`. It survived RD-024 because
          // every spawner until now spawned a farm type ('crop'), so the farm table
          // happened to answer correctly. A second genre was the only thing that
          // could surface it: validation was schema-aware, the RUNTIME was not.
          // Read through `engine` (not a captured schema) — defineType REPLACES the
          // schema object, so a captured reference would go stale.
          ops.push({ kind: 'createChild', type: engine.w.schema.TYPE_NAME.indexOf(ef.spawn.type), parent: u, props: { ...(ef.spawn.props ?? {}) } }); }
      }
    }
    return ops;
  };
  return { ok: true, name: rule.name, fn, rule };
}

// validate + register in one call. Rejected rules never touch the engine.
// Duplicate names are a WIRE error (localized, re-promptable), not a throw:
// a rule's name is its actor identity (see registerSystem).
//
// RD-B6 (rule lifecycle): an installed rule's SOURCE is retained on the engine
// (engine.ruleSources, name -> canonical parsed JSON). Rules are AUTHORED
// CONTENT — part of the world, unlike trusted hand-written systems (code) — so
// the source is what persistence saves and what a reload re-validates through
// the same wire (see persistence.js). The compiled fn is never serialized.
// opts.replace: versioning — atomically swap an installed rule of the same
// name for the new one (the new rule must VALIDATE before the old one is
// removed; a bad revision can never uninstall a good rule).
function installRule(engine, input, opts = {}) {
  const r = parseRule(engine, input);
  if (!r.ok) return r;
  const sysName = `rule:${r.name}`;
  const installed = engine.systems.some(s => s.name === sysName);
  if (installed && !opts.replace)
    return { ok: false, errors: [{ rule: r.name, where: 'name', code: 'duplicate_name',
      detail: `a rule named '${r.name}' is already installed — pick a distinct name (names are actor identities), or pass {replace:true} to version it` }] };
  // RD-035: compute the unconditional-write advisory BEFORE retaining this rule's
  // source, so "other rules writing this field" reflects the rest of the world.
  // Advisory only — never blocks the install; the rule is valid and safe.
  r.warnings = writeSmells(engine, r.rule);
  if (installed) engine.systems = engine.systems.filter(s => s.name !== sysName);
  // RD-M0.1: authored rules submit one tx per matched entity — an entity's
  // effects stay atomic; cross-entity collateral rejection is gone.
  engine.registerSystem(sysName, r.fn, { txPerEntity: true });
  (engine.ruleSources ??= new Map()).set(r.name, JSON.parse(JSON.stringify(r.rule)));
  return r;
}

// remove an installed rule (system + retained source). Localized error, not a
// throw, when nothing by that name is installed.
function uninstallRule(engine, name) {
  const sysName = `rule:${name}`;
  if (!engine.systems.some(s => s.name === sysName))
    return { ok: false, errors: [{ rule: name, where: 'name', code: 'not_installed',
      detail: `no rule named '${name}' is installed` }] };
  engine.systems = engine.systems.filter(s => s.name !== sysName);
  engine.ruleSources?.delete(name);
  return { ok: true, name };
}

module.exports = { parseRule, installRule, uninstallRule, writeSmells, SPAWN_CAP_MAX, setAccel };
