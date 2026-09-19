// THE JUSTIFICATION GRAPH — why is Legasus currently ENTITLED to act as though this is true?
//
// THE DEEPEST INVARIANT CURRENTLY VISIBLE:
//
//     NO ACTION MAY EXERCISE MORE AUTHORITY THAN CAN BE TRACED THROUGH SURVIVING JUSTIFICATION TO
//     EVIDENCE WITHIN THE SAME SCOPE.
//
// Every failure this project has found is one boundary of that sentence being crossed:
//
//     wrong code committed         authority exceeded evidence
//     shadowed Python source       observation attached to the wrong reality
//     a probe that could not fail  no falsification opportunity
//     checklist progress           authored expectation masquerading as independent evidence
//     permanent KNOWN_FALSE        a claim outliving its scope
//     line aliasing                evidence transferred between identities
//     20,000 correct commits       local correctness widened into project advancement
//
// SCOPE INFLATION IS THE COMMON FORM. Observed once -> "works". Passed tests -> "correct". Connected under
// a witness -> "relevant". Failed at S0 -> "impossible". Worked on packaging -> "general". These are one
// error, and it is mechanizable: a claim carries the quantifiers it was established under, and any
// consumer wanting more has to prove the widening.
//
// THE ASYMMETRY THAT KEEPS THIS HONEST, and the reason this is not an ordinary truth-maintenance system:
//
//     INVALIDATION PROPAGATES AUTOMATICALLY. REVALIDATION NEVER DOES.
//
// If repairing a site-identity node silently restored every claim above it, the system would have started
// REASONING about its beliefs instead of RE-TESTING them. Every defect this project has actually caught
// was caught by re-running something. Upward validity must cost a re-execution, every time. A graph that
// can restore its own conclusions is a graph that will eventually be confidently wrong for a month.
import { createHash } from 'node:crypto';

const sha = (s) => createHash('sha256').update(String(s)).digest('hex').slice(0, 12);

export const NODE = {
  ASSUMPTION: 'ASSUMPTION',      // the ground: tracer semantics, corpus identity, environment
  OBSERVATION: 'OBSERVATION',    // something that happened and was recorded
  INTERPRETATION: 'INTERPRETATION',
  CLAIM: 'CLAIM',
};

export const VALIDITY = {
  ESTABLISHED: 'ESTABLISHED',
  UNESTABLISHED: 'UNESTABLISHED',  // an ancestor moved; this must be re-derived, not re-reasoned
  INVALID: 'INVALID',              // positively refuted
};

// ANY is the only symbol that may sit in a scope without evidence, and only where the claim genuinely was
// established for all values - which is almost never, and never by default.
export const ANY = Symbol('ANY');

export const DIMENSIONS = ['repository', 'environment', 'invocation', 'implementation'];

export function scope(partial = {}) {
  const s = {};
  for (const d of DIMENSIONS) s[d] = Object.hasOwn(partial, d) ? partial[d] : null;
  return s;
}

// Is `granted` broad enough to license `required`? null means "not established over this dimension at
// all", which licenses nothing. ANY licenses anything. Otherwise the values must match exactly.
export function covers(granted, required) {
  const missing = [];
  for (const d of DIMENSIONS) {
    const g = granted[d]; const r = required[d];
    if (r === null || r === undefined) continue;          // the consumer does not care about this axis
    if (g === ANY) continue;
    if (g === null || g === undefined) { missing.push(d + ': never established'); continue; }
    if (g !== r) missing.push(d + ': established over ' + String(g) + ', asked for ' + String(r));
  }
  return { ok: missing.length === 0, missing };
}

export function node({ kind, proposition, scope: sc, basis, supports = [], evidence = [] }) {
  const id = sha([kind, proposition, JSON.stringify(supports)].join('|'));
  return { id, kind, proposition, scope: sc || scope(), basis, supports: [...supports], evidence,
    validity: VALIDITY.ESTABLISHED };
}

export const graph = () => ({ nodes: {}, dependents: {} });

export function add(g, n) {
  g.nodes[n.id] = n;
  for (const s of n.supports) (g.dependents[s] = g.dependents[s] || []).push(n.id);
  return n.id;
}

// INVALIDATION PROPAGATES. Discovering that site identity was computed incorrectly must not require
// manually hunting everything downstream of it.
export function invalidate(g, id, why) {
  const n = g.nodes[id];
  if (!n) return { touched: [] };
  n.validity = VALIDITY.INVALID;
  n.why = why;
  const touched = [id];
  const queue = [...(g.dependents[id] || [])];
  while (queue.length) {
    const cur = queue.shift();
    const c = g.nodes[cur];
    if (!c || c.validity === VALIDITY.UNESTABLISHED) continue;
    c.validity = VALIDITY.UNESTABLISHED;
    c.why = 'an ancestor was invalidated: ' + why;
    touched.push(cur);
    queue.push(...(g.dependents[cur] || []));
  }
  return { touched };
}

// REVALIDATION DOES NOT PROPAGATE. Restoring a node restores exactly that node. Everything above it stays
// UNESTABLISHED until it is itself re-derived by re-running the thing that established it.
export function reestablish(g, id, { evidence, scope: sc }) {
  const n = g.nodes[id];
  if (!n) return null;
  n.validity = VALIDITY.ESTABLISHED;
  n.evidence = evidence || n.evidence;
  if (sc) n.scope = sc;
  n.why = 'directly re-established; DEPENDENTS ARE NOT RESTORED and must each be re-derived';
  return n;
}

// THE ENTITLEMENT QUESTION. Walk the justification to its leaves: every ancestor must be ESTABLISHED, and
// every ancestor's scope must cover what is being asked for.
export function entitled(g, id, required = scope()) {
  const seen = new Set();
  const problems = [];
  const path = [];
  // A GENERALIZATION node is precisely the authority for asking its ancestors less than the consumer
  // asked of it. Walking down through one RELAXES the requirement on the dimension it generalized - and
  // only that dimension. Without this, a widening could never be used and `widen` would be decorative;
  // with it applied to every dimension, `widen` would be a universal escape hatch. It is neither.
  const walk = (cur, need) => {
    const mark = cur + '@' + DIMENSIONS.map((d) => String(need[d])).join(',');
    if (seen.has(mark)) return;
    seen.add(mark);
    const n = g.nodes[cur];
    if (!n) { problems.push({ id: cur, why: 'justification refers to a node that does not exist' }); return; }
    path.push(n.proposition);
    if (n.validity !== VALIDITY.ESTABLISHED) {
      problems.push({ id: cur, why: n.proposition + ' is ' + n.validity + ': ' + (n.why || '') });
    }
    const c = covers(n.scope, need);
    if (!c.ok) {
      problems.push({ id: cur, why: 'SCOPE INFLATION at "' + n.proposition + '" — ' + c.missing.join('; ') });
    }
    const next = n.generalizedDimension
      ? { ...need, [n.generalizedDimension]: null }
      : need;
    for (const s of n.supports) walk(s, next);
  };
  walk(id, required);
  return { ok: problems.length === 0, problems, path };
}

// WIDENING A QUANTIFIER IS ITSELF A CLAIM, and needs its own authority. Three witnesses at 5, 7 and 9 do
// not give you "for all integers" - they give you three witnesses.
export const GENERALIZATION = {
  EXHAUSTIVE: 'EXHAUSTIVE',      // the domain was enumerated and all of it was checked
  PROOF: 'PROOF',                // an argument covering the domain
  DECLARED: 'DECLARED',          // a human took responsibility for the widening
};

export function widen(g, id, { dimension, to, via, evidence = [] }) {
  const n = g.nodes[id];
  if (!n) return { rejected: true, why: 'no such claim' };
  if (!Object.values(GENERALIZATION).includes(via)) {
    return { rejected: true, why:
      'SCOPE INFLATION: widening ' + dimension + ' requires a generalization authority. Observations do'
      + ' not widen themselves - that is the error behind "observed once, therefore works".' };
  }
  if (via !== GENERALIZATION.DECLARED && !evidence.length) {
    return { rejected: true, why: 'a ' + via + ' generalization must carry the evidence that covers the domain' };
  }
  const widened = node({ kind: NODE.CLAIM,
    proposition: n.proposition + ' [generalized over ' + dimension + ']',
    scope: { ...n.scope, [dimension]: to },
    basis: 'GENERALIZATION:' + via, supports: [id], evidence });
  widened.generalizedDimension = dimension;
  add(g, widened);
  return widened;
}

// A compact report of what the system is currently entitled to, which is the only honest summary of what
// it knows.
export function standing(g) {
  const out = { ESTABLISHED: 0, UNESTABLISHED: 0, INVALID: 0 };
  for (const n of Object.values(g.nodes)) out[n.validity]++;
  return out;
}
