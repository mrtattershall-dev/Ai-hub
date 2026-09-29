'use strict';
// =============================================================================
// RD-040 experiment — a MINIMAL relational rule evaluator to decide H1: can L1
// (within-entity field-vs-field predicates) + L2 (relational reads — aggregation
// filters keyed to the MATCHED entity's fields, and predicate values that are
// aggregates) express asymmetric-role mechanics with ONLY self-writes?
//
// It is deliberately NOT the real gate. It is a focused prototype whose whole job
// is to answer the EXPRESSIVENESS question and check the two safety-relevant
// properties (determinism, double-buffer / order-independence). The safety claim
// for the real engine rests on ONE structural fact this harness ENFORCES BY
// CONSTRUCTION: every op a rule emits targets the MATCHED entity — there is no
// syntax to write another entity. So L1/L2 can only ever produce the self-write
// setfield ops the real engine already handles under RD-005. If a mechanic can't
// be written here, that is exactly the L3a/L3b residue.
//
// Grammar (subset + the relational extensions):
//   rule    : { name, type, where?, effects:[{set, to}] }
//   pred    : { field, cmp, value } | { all:[...] } | { any:[...] }
//     value : number                      (constant, today's grammar)
//           | { field: g }                (L1: the PRIMARY entity's own field g)
//           | { self:  g }                (L2: the MATCHED entity's field g — for
//                                           aggregation filters, where primary≠self)
//           | <expr>                       (L2: an aggregate, e.g. {min:{...}})
//   expr    : number | {field:f} | {self:f}
//           | {add|sub|mul|min|max:[e,e,...]} | {clamp:[e,lo,hi]}
//           | {count:{type,where?,near?}} | {sum|min|max:{type,field,where?,near?}}
//     near  : R  (integer) — squared distance from the MATCHED entity's x/y
// =============================================================================

const CMP = { '<': (a, b) => a < b, '<=': (a, b) => a <= b, '==': (a, b) => a === b,
  '>=': (a, b) => a >= b, '>': (a, b) => a > b, '!=': (a, b) => a !== b };

function makeWorld() {
  let seq = 0;
  const entities = [];
  const w = {
    entities,
    spawn(type, fields = {}) { const e = { id: `${type}${seq++}`, type, f: { ...fields } }; entities.push(e); return e.id; },
    byId: (id) => entities.find((e) => e.id === id),
    get: (id, f) => { const e = w.byId(id); return e ? e.f[f] : undefined; },
    all: (type) => entities.filter((e) => e.type === type),
  };
  return w;
}

// snapshot = frozen pre-tick read view (the double-buffer). Rules read this only.
function snapshot(world) {
  return { list: world.entities.map((e) => ({ id: e.id, type: e.type, f: { ...e.f } })) };
}
const snapAll = (snap, type) => snap.list.filter((e) => e.type === type);
const snapGet = (snap, id, f) => { const e = snap.list.find((x) => x.id === id); return e ? e.f[f] : undefined; };
const d2 = (a, b) => (a.f.x - b.f.x) ** 2 + (a.f.y - b.f.y) ** 2;

// evaluate an expression in the context of the MATCHED entity `self` (a snap row).
function evalExpr(x, self, snap) {
  if (typeof x === 'number') return x;
  if (x && typeof x === 'object') {
    if ('field' in x) return self.f[x.field] ?? 0;
    if ('self' in x) return self.f[x.self] ?? 0;         // same as field at expr level; kept for symmetry
    if ('clamp' in x) { const [e, lo, hi] = x.clamp; return Math.max(evalExpr(lo, self, snap), Math.min(evalExpr(hi, self, snap), evalExpr(e, self, snap))); }
    // ARRAY-form min/max/add/sub/mul = arithmetic (RD-B7.1 disambiguation by Array.isArray)
    for (const op of ['add', 'sub', 'mul', 'min', 'max']) if (op in x && Array.isArray(x[op])) {
      const vs = x[op].map((e) => evalExpr(e, self, snap));
      if (op === 'add') return vs.reduce((a, b) => a + b, 0);
      if (op === 'sub') return vs.reduce((a, b) => a - b);
      if (op === 'mul') return vs.reduce((a, b) => a * b, 1);
      if (op === 'min') return Math.min(...vs);
      if (op === 'max') return Math.max(...vs);
    }
    // OBJECT-form count/sum/min/max = aggregation over a pool
    const kind = 'count' in x ? 'count' : 'sum' in x ? 'sum'
      : ('min' in x && !Array.isArray(x.min)) ? 'min' : ('max' in x && !Array.isArray(x.max)) ? 'max' : null;
    if (kind) {
      const spec = x[kind];
      let pool = snapAll(snap, spec.type);
      if (spec.near != null) pool = pool.filter((e) => e.id !== self.id && d2(self, e) <= spec.near ** 2);
      if (spec.where) pool = pool.filter((e) => evalPred(spec.where, e, self, snap));  // primary=counted, self=matched (L2)
      if (kind === 'count') return pool.length;
      const vals = pool.map((e) => e.f[spec.field] ?? 0);
      if (kind === 'sum') return vals.reduce((a, b) => a + b, 0);
      if (!vals.length) return 0;                        // empty aggregate identity
      return kind === 'min' ? Math.min(...vals) : Math.max(...vals);
    }
  }
  throw new Error('bad expr ' + JSON.stringify(x));
}

// resolve a predicate value against (primary, self).
function resolveVal(v, primary, self, snap) {
  if (typeof v === 'number') return v;
  if (v && typeof v === 'object') {
    if ('field' in v && Object.keys(v).length === 1) return primary.f[v.field] ?? 0;   // L1: primary's own field
    if ('self' in v) return self.f[v.self] ?? 0;                                        // L2: the matched entity's field
    return evalExpr(v, self, snap);                                                     // L2: an aggregate in self's context
  }
  return v;
}

function evalPred(p, primary, self, snap) {
  if (p.all) return p.all.every((q) => evalPred(q, primary, self, snap));
  if (p.any) return p.any.some((q) => evalPred(q, primary, self, snap));
  return CMP[p.cmp](primary.f[p.field] ?? 0, resolveVal(p.value, primary, self, snap));
}

// one tick: compute every rule's ops vs the pre-tick snapshot, then apply. Returns
// {ops, contended} — ops are ALWAYS self-writes (target = the matched entity), which
// the harness enforces structurally. `contended` = same (entity,field) written to
// two different values in one tick (the RD-005 defer case; should be empty for H1).
function step(world, rules, order = null) {
  const snap = snapshot(world);
  const ops = [];
  const rs = order ? order.map((i) => rules[i]) : rules;
  for (const r of rs) {
    let pool = snapAll(snap, r.type);
    for (const e of pool) {
      if (r.where && !evalPred(r.where, e, e, snap)) continue;   // match.where: primary=self=matched (L1)
      for (const ef of r.effects) ops.push({ rule: r.name, target: e.id, field: ef.set, value: evalExpr(ef.to, e, snap) });
    }
  }
  // detect cross-field contention (two rules, same target+field, different value)
  const seen = new Map(), contended = [];
  for (const o of ops) { const k = o.target + '|' + o.field; if (seen.has(k) && seen.get(k) !== o.value) contended.push(k); else seen.set(k, o.value); }
  // apply (self-writes only — target is always the matched entity by construction)
  for (const o of ops) { if (contended.includes(o.target + '|' + o.field)) continue; const e = world.byId(o.target); if (e) e.f[o.field] = o.value; }
  return { ops, contended: [...new Set(contended)] };
}

module.exports = { makeWorld, step, evalExpr, evalPred, snapshot };
