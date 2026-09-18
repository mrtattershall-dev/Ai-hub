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
import { NL } from './predicates.mjs';

const isInterval = (d) => d && d.kind === 'interval';
const lo = (d) => (d.lo === null || d.lo === undefined ? -Infinity : d.lo);
const hi = (d) => (d.hi === null || d.hi === undefined ? Infinity : d.hi);

export function containsPoint(d, v) {
  if (!d) return false;
  if (d.kind === 'point') return v === d.value;
  if (d.kind === 'complement_point') return v !== d.value;
  if (d.kind === 'universe') return true;
  if (!isInterval(d)) return false;
  const okLo = lo(d) === -Infinity || (d.loOpen ? v > lo(d) : v >= lo(d));
  const okHi = hi(d) === Infinity || (d.hiOpen ? v < hi(d) : v <= hi(d));
  return okLo && okHi;
}

// Does `outer` contain every point of `inner`, and strictly more? Decided on the bounds, then WITNESSED
// on actual values, because a containment claim that no example supports is the kind of derivation this
// project refuses to ship.
export function strictlyContains(outer, inner) {
  if (!outer || !inner) return null;
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
export function orderRequested(a, b) {
  const aContains = strictlyContains(a.domain, b.domain);
  const bContains = strictlyContains(b.domain, a.domain);

  if (aContains && bContains) {
    return { status: 'UNDETERMINED', reason: 'each domain appears to contain the other, which means the'
      + ' containment test is wrong rather than the specification being ambiguous' };
  }
  if (aContains) {
    return { status: 'ORDERED', first: b.id, second: a.id,
      reason: b.id + ' is strictly inside ' + a.id + ', so it must be reachable before the wider guard',
      witness: { input: aContains.inside,
        under_correct_order: b.result,
        under_reversed_order: a.result,
        why: 'this input satisfies both, so the reversed order silently loses ' + b.result } };
  }
  if (bContains) {
    return { status: 'ORDERED', first: a.id, second: b.id,
      reason: a.id + ' is strictly inside ' + b.id + ', so it must be reachable before the wider guard',
      witness: { input: bContains.inside,
        under_correct_order: a.result,
        under_reversed_order: b.result,
        why: 'this input satisfies both, so the reversed order silently loses ' + a.result } };
  }

  // No containment. Do they overlap at all?
  const probe = [];
  for (let v = -1000; v <= 1000; v++) probe.push(v);
  const shared = probe.find((v) => containsPoint(a.domain, v) && containsPoint(b.domain, v));
  if (shared === undefined) {
    return { status: 'DISJOINT',
      reason: 'no input satisfies both, so neither can shadow the other and both orders are legal',
      note: 'choosing one is an ENGINEERING CHOICE and must be labelled as one' };
  }
  return { status: 'UNDETERMINED', witness: { input: shared },
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
