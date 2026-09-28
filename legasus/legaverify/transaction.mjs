// LEGAVERIFY — TRANSACTION PROBES. Verification for a change made of more than one operation.
//
// THE QUESTION R4 ASKS: can Legasus preserve correctness when two INDIVIDUALLY VALID operations
// interact, and their relationship decides whether the combined program is right?
//
// This is the first verifier in the project that can answer it, because it is the first that takes the
// ORDER as part of the contract rather than as an incidental property of how the fragments happened to
// be assembled. Two guards that are each perfectly correct in isolation compose into a program that
// silently never produces one of the two requested results, if the wider one is placed first.
//
//     if n < 10:  return "small"        each fragment is correct
//     if n < 0:   return "tiny"         the second is now DEAD CODE
//
// That program loads, reads plausibly, contains every predicate and every result the specification
// asked for, and passes any check that looks at the fragments rather than at the composition. The
// controls beside this module exist to prove it is caught.
//
// WHERE THE EXPECTATION COMES FROM, and the rule is the same one PROVE has always followed: the
// contract and the current program, never a reference implementation.
//
//     the preserved behaviour, where precedence says it wins        its existing result
//     otherwise the FIRST requested behaviour whose domain holds v  in the DERIVED order
//     otherwise                                                     what the ORIGINAL program does
//
// THE ORDER IS AN INPUT HERE, NOT A DERIVATION. `legacore/ordering.mjs` derives it and declines when
// the specification has not determined one. A verifier that derived its own order would be grading the
// planner's homework with the planner's own answers.
import { contractProbes, probeValues, containsPoint, normalizeDomain } from './probes.mjs';

const NL = String.fromCharCode(10);

// Probe values for a transaction: every bound either requested behaviour names, every bound the
// existing program names, and deep interiors for every open end in either domain.
export function transactionProbeValues({ requested, existing = [] }) {
  const vs = new Set();
  for (const r of requested) {
    for (const v of probeValues({ requested: r.domain, existing })) vs.add(v);
  }
  // The other behaviour's bounds are part of THIS behaviour's interrogation too: an input just inside
  // the narrow domain is exactly where a wrong order shows up, and neither domain alone names it.
  for (const r of requested) {
    const d = normalizeDomain(r.domain);
    if (!d) continue;
    if (d.kind === 'point') { vs.add(d.value - 1); vs.add(d.value); vs.add(d.value + 1); }
    if (d.kind === 'interval') {
      for (const b of [d.lo, d.hi]) {
        if (Number.isFinite(b)) { vs.add(b - 1); vs.add(b); vs.add(b + 1); }
      }
    }
  }
  return [...vs].sort((a, b) => a - b);
}

// The expectation, from the contract plus the committed order plus the original program.
//
// `order` is the list of requested-behaviour ids in the order they will appear. It comes from DECIDE.
export function transactionProbes({ requested, order, preserved, preservedWins, existing = [] },
  originalResult) {
  const byId = new Map(requested.map((r) => [r.id, r]));
  for (const id of order) {
    if (!byId.has(id)) throw new Error('order names an operation that is not in the transaction: ' + id);
  }
  if (order.length !== requested.length) {
    throw new Error('the order must cover every operation exactly once - refusing to verify a'
      + ' transaction whose composition is only partly specified');
  }

  const values = transactionProbeValues({ requested, existing });
  const out = [];
  for (const v of values) {
    const heldBack = preservedWins && containsPoint(preserved, v);
    let expected = null;
    let why = '';
    if (heldBack) {
      expected = originalResult(v);
      why = 'the preserved behaviour wins this input';
    } else {
      for (const id of order) {
        const r = byId.get(id);
        if (containsPoint(r.domain, v)) {
          expected = r.result;
          why = id + ' is the first requested behaviour in the committed order whose domain holds this';
          break;
        }
      }
      if (expected === null) {
        expected = originalResult(v);
        why = 'outside every requested domain, so the existing behaviour must survive';
      }
    }
    out.push({ input: v, expected, why });
  }
  return out;
}

// Is every requested behaviour REACHABLE in the committed order? A transaction that composes into a
// program where one of its operations can never fire has satisfied the letter of the request and lost
// one of the two behaviours it was asked for.
//
// Reported separately from probe failures because it is a different defect: probes say the program
// answers wrongly somewhere, this says an operation is dead regardless of what anything returns.
export function reachability({ requested, order, preserved, preservedWins }) {
  const byId = new Map(requested.map((r) => [r.id, r]));
  const probe = [];
  for (let v = -100000; v <= 100000; v += 1) { probe.push(v); if (Math.abs(v) > 300) v += 97; }
  const dead = [];
  for (let i = 0; i < order.length; i++) {
    const me = byId.get(order[i]);
    const earlier = order.slice(0, i).map((id) => byId.get(id));
    const reachable = probe.some((v) => {
      if (preservedWins && containsPoint(preserved, v)) return false;
      if (!containsPoint(me.domain, v)) return false;
      return !earlier.some((e) => containsPoint(e.domain, v));
    });
    if (!reachable) dead.push(order[i]);
  }
  return { allReachable: dead.length === 0, dead };
}

// ---------------------------------------------------------------------------------------------
// REACHABILITY BY EXECUTION, and why the planned version above is not enough.
//
// `reachability` asks the PLAN whether an operation can fire: it takes the requested domains and the
// committed order, and never sees the emitted program. That makes its verdict a pure function of
// (plan, order) - identical for every model and every realization of the same plan.
//
// It therefore REJECTS A LEGITIMATE ALTERNATIVE. Assemble this in an order the plan calls wrong:
//
//     if n == 3:              return "three"
//     if n < 10 and n >= 0:   return "low"        a SELF-DEFENDING realization
//     if n > 100:             return "high"
//     if n < 0:               return "micro"
//
// Executed, every requested behaviour fires and there is no dead code in the program. The planned
// check calls `micro` dead anyway, because the plan says n<0 is inside n<10 and `low` came first.
// The model wrote code that carved out the domain it would otherwise have shadowed, and the verifier
// cannot see it.
//
//     ANYTHING WITH THE AUTHORITY TO REJECT MUST PROVE THAT IT CAN ADMIT LEGITIMATE ALTERNATIVES.
//
// So deadness is asked of the ARTIFACT instead: an operation is dead when no probe input actually
// produces its result. That is the property the defect was ever about - an operation that can never
// fire - and it is realization-agnostic by construction.
//
// The planned version is KEPT, not deleted. It is the right thing to ask of a PLAN, and the gap
// between the two is itself a measurement: plan-dead but execution-alive is exactly a self-defending
// realization, and counting those is how the rescue rate gets measured at all.

// The instrument can only attribute an observed result to an operation if the labels distinguish them.
// It refuses rather than guesses - two operations sharing a result value, or a requested result that
// the untouched program already produces, would both make "this op fired" unattributable.
export function auditResultLabels({ requested, originalResults = [] }) {
  const problems = [];
  const seen = new Map();
  for (const r of requested) {
    if (!r.result) { problems.push('operation ' + r.id + ' has no result label to observe'); continue; }
    if (seen.has(r.result)) {
      problems.push('operations ' + seen.get(r.result) + ' and ' + r.id + ' share the result ' + r.result
        + ', so an observation cannot be attributed to either');
    }
    seen.set(r.result, r.id);
    if (originalResults.includes(r.result)) {
      problems.push('operation ' + r.id + ' returns ' + r.result + ', which the untouched program'
        + ' already produces, so observing it proves nothing');
    }
  }
  return { ok: problems.length === 0, problems };
}

// Deadness as a property of the EMITTED PROGRAM.
//
//   requested   the operations, each carrying the result label it is supposed to produce
//   observed    the set of results the assembled program actually returned over the probe inputs
//
// An operation is dead when its label never appears. Nothing here consults the order or the domains,
// which is the entire point: a realization that defends itself is admitted, and one that is genuinely
// shadowed is still caught because a shadowed branch cannot produce its result for any input.
export function reachabilityExecuted({ requested, observed }) {
  const have = observed instanceof Set ? observed : new Set(observed);
  const dead = requested.filter((r) => !have.has(r.result)).map((r) => r.id);
  return { allReachable: dead.length === 0, dead, basis: 'EXECUTED' };
}

export { contractProbes, containsPoint, NL };
