// LEGACORE — ORDERING TWO REQUESTED BEHAVIOURS.
//
// Every family so far has had ONE operation, and `R4` - the multi-operation rung - has been deferred
// four times for want of a family rather than for want of machinery. This is the missing piece.
//
// THE QUESTION. When a request asks for two new behaviours whose domains OVERLAP, the finished program
// must apply them in some order, and the order is not a style choice: it decides what the overlapping
// inputs return. "Values below 10 return small, values below 0 return tiny" has one correct program and
// several plausible wrong ones, and the difference is entirely ordering.
//
// THE RULE, and it is derived rather than chosen: where one requested domain STRICTLY CONTAINS the
// other, the contained one must be reachable, so it goes first. Otherwise the wider guard shadows it
// completely and the narrower behaviour is dead code - a program that is syntactically fine, passes a
// casual reading, and silently never produces one of the two results it was asked for.
//
// WHAT THIS MUST NOT DO. It must not order behaviours whose domains merely INTERSECT without
// containment, because then neither is dead under either order and the specification genuinely has not
// said which wins - that is the same `UNDETERMINED` answer `derivePrecedence` gives for an existing
// behaviour, and inventing an order here would be LegaCore acting as an oracle. It declines instead.
//
// It also must not order DISJOINT behaviours. They cannot shadow each other, so both orders are legal
// and picking one would be an ENGINEERING CHOICE presented as a derivation.
// The membership predicate is IMPORTED, not reimplemented. This file used to carry its own copy, and it
// silently returned false for every `set` domain the moment that kind existed - which would have made
// DECIDE call every pair of sets DISJOINT while PROVE judged them correctly. Re-exported so existing
// callers keep working, but there is only one implementation.
import { NL, containsPoint } from './predicates.mjs';
import { relate, RELATION } from './domain-algebra.mjs';

const isInterval = (d) => d && d.kind === 'interval';
const lo = (d) => (d.lo === null || d.lo === undefined ? -Infinity : d.lo);
const hi = (d) => (d.hi === null || d.hi === undefined ? Infinity : d.hi);

export { containsPoint };

// Does `outer` contain every point of `inner`, and strictly more? Decided on the bounds, then WITNESSED
// on actual values, because a containment claim that no example supports is the kind of derivation this
// project refuses to ship.
export function strictlyContains(outer, inner) {
  if (!outer || !inner) return null;
  // SETS. Strict containment is PROPER SUBSET, and the witnesses are real members rather than bounds:
  // one value inside both, and one inside the outer but not the inner. A set has no lo/hi, so nothing
  // here can fall back on interval reasoning - which is the point of having a second domain kind.
  if (outer.kind === 'set' || inner.kind === 'set') {
    if (outer.kind !== 'set') {
      // An interval or point can strictly contain a set: it holds every member, and holds something the
      // set does not.
      if (!inner.values || !inner.values.every((v) => containsPoint(outer, v))) return null;
      const near = [];
      for (const m of inner.values) near.push(m + 1, m - 1);
      const outsideInner = near.find((v) => containsPoint(outer, v) && !containsPoint(inner, v));
      if (outsideInner === undefined) return null;
      return { inside: inner.values[0], outsideInner };
    }
    if (inner.kind !== 'set') {
      // A finite set cannot strictly contain an interval, and contains a point only when the point is a
      // member and the set has another member.
      if (inner.kind !== 'point') return null;
      if (!outer.values.includes(inner.value)) return null;
      const other = outer.values.find((v) => v !== inner.value);
      return other === undefined ? null : { inside: inner.value, outsideInner: other };
    }
    if (!inner.values.every((v) => outer.values.includes(v))) return null;
    const outsideInner = outer.values.find((v) => !inner.values.includes(v));
    // Equal sets are containment but not STRICT containment, so there is no precedence to derive.
    if (outsideInner === undefined) return null;
    return { inside: inner.values[0], outsideInner };
  }
  if (inner.kind === 'point') {
    if (!containsPoint(outer, inner.value)) return null;
    // A point is strictly inside anything that also holds some other value.
    const other = [inner.value + 1, inner.value - 1, 0, 1, -1].find((v) => v !== inner.value && containsPoint(outer, v));
    return other === undefined ? null : { inside: inner.value, outsideInner: other };
  }
  if (!isInterval(outer) || !isInterval(inner)) return null;
  const loOk = lo(outer) < lo(inner)
    || (lo(outer) === lo(inner) && (!outer.loOpen || inner.loOpen));
  const hiOk = hi(outer) > hi(inner)
    || (hi(outer) === hi(inner) && (!outer.hiOpen || inner.hiOpen));
  if (!loOk || !hiOk) return null;
  const strict = lo(outer) < lo(inner) || hi(outer) > hi(inner)
    || (outer.loOpen !== inner.loOpen) || (outer.hiOpen !== inner.hiOpen);
  if (!strict) return null;
  // Witness both halves of the claim on real values, not on the bounds that produced it.
  const candidates = [];
  const h = hi(inner); const l = lo(inner);
  for (const v of [l, l + 1, l - 1, h, h - 1, h + 1, 0, 1, -1]) if (Number.isFinite(v)) candidates.push(v);
  const inside = candidates.find((v) => containsPoint(inner, v) && containsPoint(outer, v));
  const outsideInner = candidates.find((v) => !containsPoint(inner, v) && containsPoint(outer, v));
  if (inside === undefined || outsideInner === undefined) return null;
  return { inside, outsideInner };
}

// The order two requested behaviours must appear in, or a declared refusal to say.
//
//   ORDERED      one domain strictly contains the other; the contained one is first, with a witness
//                input that would be LOST under the other order
//   DISJOINT     neither can shadow the other; both orders legal, so this is an ENGINEERING CHOICE
//   UNDETERMINED domains intersect without containment; the specification has not said, and inventing
//                an answer here would make LegaCore an oracle
// DECIDE IS A CONSUMER OF THE DOMAIN ALGEBRA, not a second implementation of it.
//
// This function used to decide containment itself and then sweep the integers from -1000 to 1000 looking
// for a shared value. Both were numeric assumptions hiding inside a stage whose claim is about DOMAINS:
// the sweep cannot find a shared value between two string prefixes, and a hand-rolled containment test
// has to learn every new kind separately. `relate()` knows all of them and returns a witness with each
// answer, so DECIDE's job is only to turn a RELATION into an AUTHORITY decision:
//
//     CONTAINS / CONTAINED   a precedence edge - the narrower must be reachable first
//     DISJOINT               no edge, and choosing an order is an ENGINEERING CHOICE
//     EQUAL                  no edge is derivable, and none is needed
//     OVERLAP                REFUSE - the specification has not said which wins on the shared inputs
//     UNKNOWN                REFUSE - and say that it is the algebra declining, not the spec being vague
//
// The stages are allowed to disagree about AUTHORITY. They are not allowed to disagree about MATHEMATICS.
export function orderRequested(a, b) {
  const r = relate(a.domain, b.domain);
  const w = r.witness || {};

  if (r.relation === RELATION.CONTAINS || r.relation === RELATION.CONTAINED) {
    const contains = r.relation === RELATION.CONTAINS;
    const inner = contains ? b : a;
    const outer = contains ? a : b;
    return { status: 'ORDERED', first: inner.id, second: outer.id,
      reason: inner.id + ' is strictly inside ' + outer.id
        + ', so it must be reachable before the wider guard',
      witness: { input: w.shared,
        under_correct_order: inner.result,
        under_reversed_order: outer.result,
        why: 'this input satisfies both, so the reversed order silently loses ' + inner.result } };
  }

  if (r.relation === RELATION.DISJOINT) {
    return { status: 'DISJOINT', witness: { inA: w.inA, inB: w.inB },
      reason: 'no input satisfies both, so neither can shadow the other and both orders are legal',
      note: 'choosing one is an ENGINEERING CHOICE and must be labelled as one' };
  }

  if (r.relation === RELATION.EQUAL) {
    return { status: 'UNDETERMINED', witness: { input: w.shared },
      reason: 'the domains are equivalent, so there is no containment to derive an order from; two'
        + ' requested behaviours over the same domain are a specification conflict, not an ordering' };
  }

  if (r.relation === RELATION.UNKNOWN) {
    return { status: 'UNDETERMINED',
      reason: 'the domain algebra declines this pair: ' + r.why
        + '. That is the algebra refusing, not the specification being ambiguous' };
  }

  return { status: 'UNDETERMINED', witness: { input: w.shared, onlyA: w.onlyA, onlyB: w.onlyB },
    reason: 'the domains intersect without containment, so the specification has not said which wins'
      + ' on the shared inputs; deriving an order here would be LegaCore acting as an oracle' };
}

export { NL };

// ---- N OPERATIONS. R4 ordered pairs; a transaction of three or more needs a partial order.
//
// THE STRUCTURE: strict containment is a partial order, so the operations form a DAG and any
// topological sort of it is legal. Where two operations are incomparable AND disjoint, their relative
// position is an ENGINEERING CHOICE - both orders leave both reachable. Where two are incomparable and
// INTERSECT, the specification has not said which wins on the shared inputs, and the WHOLE transaction
// is undetermined: there is no order that is derivable, so Legasus must decline rather than pick.
//
// ONE UNDETERMINED PAIR POISONS THE TRANSACTION. That is deliberate. A transaction is committed or it
// is not; shipping the determinable part and leaving the ambiguous part out would be a different change
// from the one that was requested, decided by the apparatus rather than by the specification.
export function orderTransaction(reqs) {
  if (reqs.length < 2) return { status: 'ORDERED', order: reqs.map((r) => r.id), pairs: [] };
  const pairs = [];
  const contains = new Map();       // id -> Set of ids strictly inside it
  for (const r of reqs) contains.set(r.id, new Set());

  for (let i = 0; i < reqs.length; i++) {
    for (let j = i + 1; j < reqs.length; j++) {
      const a = reqs[i]; const b = reqs[j];
      const rel = orderRequested(a, b);
      pairs.push({ a: a.id, b: b.id, status: rel.status, first: rel.first, witness: rel.witness });
      if (rel.status === 'UNDETERMINED') {
        return { status: 'UNDETERMINED', order: null, pairs,
          blocking: { a: a.id, b: b.id, witness: rel.witness },
          reason: a.id + ' and ' + b.id + ' intersect without containment, so no order over the'
            + ' transaction is derivable; committing part of it would be a different change from the'
            + ' one requested, chosen by the apparatus' };
      }
      if (rel.status === 'ORDERED') {
        const outer = rel.first === a.id ? b.id : a.id;
        const inner = rel.first;
        contains.get(outer).add(inner);
      }
    }
  }

  // Topological sort: an operation may be placed once everything strictly inside it is already placed.
  const placed = [];
  const remaining = new Set(reqs.map((r) => r.id));
  const basis = [];
  while (remaining.size) {
    const ready = [...remaining].filter((id) => [...contains.get(id)].every((c) => placed.includes(c)));
    if (!ready.length) {
      return { status: 'UNDETERMINED', order: null, pairs,
        reason: 'the containment relation is cyclic, which means the containment test is wrong rather'
          + ' than the specification being ambiguous' };
    }
    // Several ready at once means they are mutually incomparable and disjoint: both orders legal.
    if (ready.length > 1) basis.push({ tie: ready.slice(), resolved_by: 'ENGINEERING_CHOICE' });
    const next = ready.sort()[0];
    placed.push(next);
    remaining.delete(next);
  }
  return { status: 'ORDERED', order: placed, pairs, ties: basis,
    orderBasis: basis.length ? 'DERIVED_WITH_ENGINEERING_CHOICE' : 'DERIVED' };
}
