'use strict';
// RD-005 — Conflict-resolution POLICY.
//
// RD-004 established: identity DETECTS "same field, both branches changed it"
// and refuses to silently pick a winner. RD-005 asks the deferred question:
// when we DO have to produce a value, who wins?
//
// Rather than argue one policy is "best", we do what RD-004 did for identity:
// define competing policies as pure functions, run them against a battery of
// concrete conflicts with real field semantics, and score each against the
// PROPERTIES a resolution can preserve or violate. The output is not a single
// winner — it's a map of which policy is admissible for which kind of field.
//
// Anchor: the Oil-Lantern vs Brass-Lantern name clash from RD-004, plus a
// counter, an additive resource, and a set — because the right answer visibly
// differs by field semantics. Zero deps. `node resolution_policies.js`.

// A conflict: common base value + two competing edits, tagged with the field's
// semantics and a logical clock per branch (NOT wall-clock — we want order to
// come from causality, not from whose machine's clock drifted).
function C(field, semantics, base, a, b, clockA, clockB) {
  return { field, semantics, base, a, b, clockA, clockB };
}

// --- candidate policies -----------------------------------------------------
// Each returns { value, resolved, residue } where:
//   resolved = did the policy settle it WITHOUT deferring to a human?
//   residue  = what was discarded (must be recoverable; null = nothing lost).

const policies = {
  // Last-write-wins by logical clock. Settles everything. Discards the loser.
  LWW(c) {
    const winner = c.clockA >= c.clockB ? c.a : c.b;
    const loser  = c.clockA >= c.clockB ? c.b : c.a;
    return { value: winner, resolved: true, residue: loser };
  },

  // Defer: never invents a value; emits an explicit unresolved marker that
  // carries both sides. This is RD-004's "detect, don't resolve" as a policy.
  Defer(c) {
    return { value: { __UNRESOLVED__: true, branchA: c.a, branchB: c.b }, resolved: false, residue: null };
  },

  // Domain rule: resolve ONLY when the field's semantics make a merge
  // meaningful and order-independent; otherwise fall back to Defer.
  Domain(c) {
    switch (c.semantics) {
      case 'additive':      // e.g. water/resource deltas: apply both
        return { value: c.base + (c.a - c.base) + (c.b - c.base), resolved: true, residue: null };
      case 'max':           // e.g. growth stage: the further-along wins, nothing lost
        return { value: Math.max(c.a, c.b), resolved: true, residue: (Math.min(c.a, c.b) === c.base ? null : Math.min(c.a, c.b)) };
      case 'set':           // e.g. tags/inventory: union both, nothing lost
        return { value: [...new Set([...c.a, ...c.b])], resolved: true, residue: null };
      default:              // opaque/label fields: no safe merge -> defer
        return policies.Defer(c);
    }
  },

  // AI-proposed: a stand-in. A real build would ask the model for a value;
  // CRUCIALLY it does not get to commit — it proposes, and the proposal is
  // treated as unresolved-until-validated (here: always deferred for review).
  AIProposed(c) {
    const proposal = c.semantics === 'label' ? `${c.a} / ${c.b}` : c.a; // pretend synthesis
    return { value: { __AI_PROPOSAL__: proposal, needsReview: true, branchA: c.a, branchB: c.b }, resolved: false, residue: null };
  },
};

// --- semantic canonicalization (compare MEANING, not representation) --------
// The first version of this suite compared JSON strings and wrongly flagged
// set-unions ([a,b,c] vs [a,c,b]) and symmetric defer-markers as
// "non-deterministic". Canon normalizes those before comparison.
function canon(v) {
  if (Array.isArray(v)) return JSON.stringify([...v].sort());
  if (v && typeof v === 'object') {
    // an unresolved / proposal marker is symmetric in its two branches:
    // sort the pair so A/B labeling can't masquerade as a difference.
    if ('branchA' in v && 'branchB' in v) {
      const pair = [JSON.stringify(v.branchA), JSON.stringify(v.branchB)].sort();
      return JSON.stringify({ resolvedShape: v.__UNRESOLVED__ ? 'unresolved' : v.__AI_PROPOSAL__ !== undefined ? 'proposal' : 'obj', pair });
    }
    return JSON.stringify(v);
  }
  return JSON.stringify(v);
}
// The canonical order-independent fold for foldable semantics, or null.
function fold(c) {
  if (c.semantics === 'additive') return c.base + (c.a - c.base) + (c.b - c.base);
  if (c.semantics === 'max')      return Math.max(c.a, c.b);
  if (c.semantics === 'set')      return [...new Set([...c.a, ...c.b])];
  return null; // label / opaque: no principled fold exists
}

// --- the property suite -----------------------------------------------------
const properties = {
  // 1. Deterministic (semantic): swapping A<->B must not change the meaning of
  //    the settled value. Convergence across replicas.
  deterministic(policy, c) {
    const forward = policy(c).value;
    const swapped = policy(C(c.field, c.semantics, c.base, c.b, c.a, c.clockB, c.clockA)).value;
    return canon(forward) === canon(swapped);
  },
  // 2. Fold-when-resolved: IF a policy autonomously settles a foldable field,
  //    the value MUST equal the order-independent fold (both intents present).
  //    Deferring is fine (vacuously passes). LWW resolves but ignores the fold.
  foldWhenResolved(policy, c) {
    const r = policy(c);
    if (!r.resolved) return true;          // didn't settle -> nothing to check
    const f = fold(c);
    if (f === null) return true;           // no fold defined for this semantics
    return canon(r.value) === canon(f);
  },
  // 3. No blind arbitration: for fields with NO principled fold (labels), a
  //    policy must not autonomously pick one author's value into the live
  //    state. This is "communication, not arbitration" as a testable property.
  noBlindArbitration(policy, c) {
    const r = policy(c);
    if (fold(c) !== null) return true;     // foldable -> arbitration not at issue
    return r.resolved === false;           // label clash must be deferred, not picked
  },
  // 4. No silent loss: if it settles to something that is neither the full fold
  //    nor a marker, the dropped side must be recoverable via residue.
  noSilentLoss(policy, c) {
    const r = policy(c);
    if (!r.resolved) return true;
    const f = fold(c);
    if (f !== null && canon(r.value) === canon(f)) return true; // both intents folded in
    if (r.value && typeof r.value === 'object') return true;    // a marker keeps both sides
    return r.residue !== null;                                  // else the loser must survive
  },
  // 5. Autonomous: settles without a human. Throughput BONUS, not a safety req.
  autonomous(policy, c) {
    return policy(c).resolved === true;
  },
};

// --- battery of conflicts ---------------------------------------------------
const battery = [
  C('name',   'label',    'Lantern', 'Oil Lantern', 'Brass Lantern', 2, 3), // the RD-004 clash
  C('growth', 'max',       50,        80,            65,              2, 3), // both advanced a crop
  C('water',  'additive',  0,         40,            30,              2, 3), // two players watered
  C('tags',   'set',      ['a'],     ['a','b'],     ['a','c'],        2, 3), // both tagged
];

// --- run --------------------------------------------------------------------
const policyNames = Object.keys(policies);
const propNames = Object.keys(properties);

for (const c of battery) {
  console.log(`\n=== field "${c.field}" (${c.semantics})  A=${JSON.stringify(c.a)}  B=${JSON.stringify(c.b)} ===`);
  for (const pn of policyNames) {
    const r = policies[pn](c);
    const flags = propNames.map(prop => `${prop}:${properties[prop](policies[pn], c) ? 'Y' : 'N'}`).join('  ');
    console.log(`  ${pn.padEnd(11)} value=${JSON.stringify(r.value).padEnd(40)} ${flags}`);
  }
}

// --- verdict: safety = the four safety props; autonomous is a separate bonus -
console.log('\n=== admissibility across the whole battery (safety props only) ===');
const safety = ['deterministic', 'foldWhenResolved', 'noBlindArbitration', 'noSilentLoss'];
for (const pn of policyNames) {
  const violations = [];
  let autoCount = 0;
  for (const c of battery) {
    if (properties.autonomous(policies[pn], c)) autoCount++;
    for (const prop of safety) {
      if (!properties[prop](policies[pn], c)) violations.push(`${c.field}:${prop}`);
    }
  }
  const throughput = `[settles ${autoCount}/${battery.length} autonomously]`;
  console.log(`  ${pn.padEnd(11)} ${violations.length === 0 ? 'ADMISSIBLE' : 'INADMISSIBLE — ' + violations.join(', ')}  ${throughput}`);
}
