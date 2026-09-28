// LEGACORE — THE DOMAIN ALGEBRA. One definition of what a domain MEANS, for every stage.
//
// WHY THIS EXISTS, and it is not tidiness. `containsPoint` had forked into two implementations, one in
// `ordering.mjs` and one in `probes.mjs`, kept in agreement by discipline. Adding the `set` kind broke
// that agreement instantly and silently: the ordering copy returned false for every set, so `DECIDE`
// would have called every pair of sets DISJOINT and derived no precedence, while `PROVE` judged the same
// pairs correctly. Both components would have passed their own tests.
//
//     DECIDE's definition of domain truth  !=  PROVE's definition of domain truth
//
// That is lethal in principle, not just untidy: the stage that decides what must be true and the stage
// that checks whether it became true can disagree while each looks healthy. So the semantic primitives
// live in ONE place and every stage consumes them:
//
//     membership   containment   strict containment   disjointness   overlap   equivalence
//
// THE RELATION IS THE PRIMITIVE. `relate(a, b)` returns one of five answers, and everything else in the
// architecture is a consumer of it. `DECIDE` turns CONTAINS into a precedence edge and refuses on
// OVERLAP; `PROVE` turns the same relation into probe expectations. Neither re-derives it.
//
// UNKNOWN IS A REAL ANSWER. A pair this algebra cannot decide returns `UNKNOWN`, never a guess. An
// architecture that refuses is recoverable; one that quietly picks is not.
import { containsPoint, normalizeDomain, atomKindOf } from './predicates.mjs';

export const RELATION = {
  EQUAL: 'EQUAL',
  CONTAINS: 'CONTAINS',            // a strictly contains b
  CONTAINED: 'CONTAINED',          // b strictly contains a
  DISJOINT: 'DISJOINT',
  OVERLAP: 'OVERLAP',              // they share values and neither contains the other
  UNKNOWN: 'UNKNOWN',
};

const KNOWN = new Set(['interval', 'point', 'set', 'complement_point', 'universe', 'prefix', 'suffix']);
const decidable = (d) => !!d && KNOWN.has(d.kind);

// STRING WITNESSES, and none of the numeric machinery survives the move.
//
// There is no neighbour of "cat", no triple around "admin_", and no gap to probe between "cat" and "dog".
// So the witnesses are constructed from the STRUCTURE of the domains being compared:
//
//   a set          each member, and each member extended, so "is it exactly this" is separable from
//                  "does it merely start with this"
//   a prefix p     p itself, p extended, and p with its last character removed - the three places where
//                  membership changes
//   a suffix q     q itself, q extended on the LEFT, and q with its first character removed
//
// AND THE CROSS PRODUCTS, which is the part that is easy to miss and fatal to omit. A prefix and a suffix
// can OVERLAP - `startswith("a")` and `endswith("z")` share "az" - but neither domain generates "az" on
// its own. Without p + q the algebra would report DISJOINT for a genuinely overlapping pair, which is the
// same class of silent wrongness as the forked membership predicate.
function stringWitnesses(domains) {
  const vs = new Set(['', 'x', 'zzz']);
  const prefixes = []; const suffixes = [];
  for (const d of domains) {
    if (!d) continue;
    if (d.kind === 'set') {
      for (const m of d.values) { vs.add(m); vs.add(m + 'x'); if (m.length > 1) vs.add(m.slice(0, -1)); }
    } else if (d.kind === 'prefix') {
      prefixes.push(d.prefix);
      vs.add(d.prefix); vs.add(d.prefix + 'x');
      if (d.prefix.length > 1) vs.add(d.prefix.slice(0, -1));
    } else if (d.kind === 'suffix') {
      suffixes.push(d.suffix);
      vs.add(d.suffix); vs.add('x' + d.suffix);
      if (d.suffix.length > 1) vs.add(d.suffix.slice(1));
    }
  }
  for (const p of prefixes) {
    for (const q of suffixes) vs.add(p + q);
    // A string that starts with p and ends with something else, so containment stays separable.
    vs.add(p + 'q');
  }
  return [...vs].sort();
}

// The values worth interrogating when comparing two domains. Bounds, members, and their neighbours for
// numbers; structural variants and cross products for strings. A relation between two domains is decided
// exactly at the places where one of them changes.
export function witnessValues(a, b) {
  const da = normalizeDomain(a); const db = normalizeDomain(b);
  const kinds = [atomKindOf(da), atomKindOf(db)].filter(Boolean);
  if (kinds.includes('string')) return stringWitnesses([da, db]);

  const vs = new Set([0, 1, -1]);
  for (const d of [da, db]) {
    if (!d) continue;
    if (d.kind === 'point' || d.kind === 'complement_point') {
      for (const v of [d.value - 1, d.value, d.value + 1]) vs.add(v);
    } else if (d.kind === 'set') {
      for (const m of d.values) for (const v of [m - 1, m, m + 1]) vs.add(v);
    } else if (d.kind === 'interval') {
      for (const edge of [d.lo, d.hi]) {
        if (Number.isFinite(edge)) for (const v of [edge - 1, edge, edge + 1]) vs.add(v);
      }
      // Somewhere deep in each unbounded direction, so an unbounded end is actually interrogated.
      if (d.lo === -Infinity) vs.add((Number.isFinite(d.hi) ? d.hi : 0) - 1000000);
      if (d.hi === Infinity) vs.add((Number.isFinite(d.lo) ? d.lo : 0) + 1000000);
    }
  }
  return [...vs].sort((x, y) => x - y);
}

// Does `outer` hold every value `inner` holds? Decided on witnesses, and REFUSED rather than guessed when
// either side is a kind this algebra does not model.
export function contains(outer, inner) {
  if (!decidable(outer) || !decidable(inner)) return null;
  const vs = witnessValues(outer, inner);
  let sawInner = false;
  for (const v of vs) {
    if (!containsPoint(inner, v)) continue;
    sawInner = true;
    if (!containsPoint(outer, v)) return false;
  }
  // An inner domain that no witness satisfies is not evidence of containment.
  return sawInner ? true : null;
}

// The single relation primitive. Witnesses are returned with it, because a relation no example supports
// is the kind of derivation this project refuses to ship.
export function relate(a, b) {
  if (!decidable(a) || !decidable(b)) {
    return { relation: RELATION.UNKNOWN,
      why: 'one of the domains is a kind the algebra does not model, so no relation is claimed' };
  }
  // A numeric domain and a string domain have no relation this algebra can decide. Saying so is the
  // correct answer; returning DISJOINT because no witness satisfies both would be a decided answer to a
  // question that was never meaningful.
  const ka = atomKindOf(a); const kb = atomKindOf(b);
  if (ka && kb && ka !== kb) {
    return { relation: RELATION.UNKNOWN,
      why: 'one domain ranges over ' + ka + ' and the other over ' + kb
        + ', so no containment or disjointness between them is meaningful' };
  }
  const vs = witnessValues(a, b);
  const inA = vs.filter((v) => containsPoint(a, v));
  const inB = vs.filter((v) => containsPoint(b, v));

  // WHICH witness gets reported is not arbitrary. A shared value a million below the bound proves
  // containment just as well as one beside it and teaches the reader nothing; the informative witness is
  // the one CLOSEST TO WHERE MEMBERSHIP CHANGES. So candidates are ranked by distance to the nearest
  // literal either domain names, and the nearest wins. For strings, shortest wins for the same reason.
  const literals = [];
  for (const d of [normalizeDomain(a), normalizeDomain(b)]) {
    if (!d) continue;
    if (d.kind === 'point' || d.kind === 'complement_point') literals.push(d.value);
    else if (d.kind === 'set') for (const m of d.values) literals.push(m);
    else if (d.kind === 'interval') for (const e of [d.lo, d.hi]) if (Number.isFinite(e)) literals.push(e);
  }
  const interest = (v) => {
    if (typeof v === 'string') return v.length;
    const nums = literals.filter((x) => typeof x === 'number');
    if (!nums.length) return Math.abs(v);
    return Math.min(...nums.map((x) => Math.abs(v - x)));
  };
  const nearest = (pred) => {
    const cands = vs.filter(pred);
    if (!cands.length) return undefined;
    return cands.reduce((best, v) => (interest(v) < interest(best) ? v : best), cands[0]);
  };

  const both = nearest((v) => containsPoint(a, v) && containsPoint(b, v));
  const onlyA = nearest((v) => containsPoint(a, v) && !containsPoint(b, v));
  const onlyB = nearest((v) => !containsPoint(a, v) && containsPoint(b, v));

  if (!inA.length || !inB.length) {
    return { relation: RELATION.UNKNOWN,
      why: 'no witness satisfies one of the domains, so nothing can be concluded about the pair' };
  }
  if (both === undefined) {
    return { relation: RELATION.DISJOINT, witness: { inA: inA[0], inB: inB[0] },
      why: 'no value satisfies both, so neither can shadow the other and any order is legal' };
  }
  if (onlyA === undefined && onlyB === undefined) {
    return { relation: RELATION.EQUAL, witness: { shared: both },
      why: 'every witness that satisfies one satisfies the other, so there is no precedence to derive' };
  }
  if (onlyB === undefined) {
    return { relation: RELATION.CONTAINS, witness: { shared: both, onlyOuter: onlyA },
      why: 'b is strictly inside a, so b must be reachable before a' };
  }
  if (onlyA === undefined) {
    return { relation: RELATION.CONTAINED, witness: { shared: both, onlyOuter: onlyB },
      why: 'a is strictly inside b, so a must be reachable before b' };
  }
  return { relation: RELATION.OVERLAP, witness: { shared: both, onlyA, onlyB },
    why: 'they share ' + both + ' while ' + onlyA + ' is only in a and ' + onlyB + ' is only in b,'
      + ' so neither contains the other and no precedence is derivable' };
}

export const disjoint = (a, b) => relate(a, b).relation === RELATION.DISJOINT;
export const equivalent = (a, b) => relate(a, b).relation === RELATION.EQUAL;
export const overlaps = (a, b) => {
  const r = relate(a, b).relation;
  return r === RELATION.OVERLAP || r === RELATION.CONTAINS || r === RELATION.CONTAINED
    || r === RELATION.EQUAL;
};

export { containsPoint, normalizeDomain };
