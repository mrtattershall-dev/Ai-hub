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

// TYPED EDGES, each carrying a PROOF OBLIGATION narrow enough to state. The obligations are the content;
// the node-and-edge syntax by itself proves nothing at all, and a "unified graph" that still needs five
// unrelated algorithms underneath is the old architecture wearing graph notation.
export const EDGE = {
  OBSERVES: 'OBSERVES',           // obligation: the observation actually occurred (non-vacuity)
  IDENTIFIES: 'IDENTIFIES',       // obligation: the identity is non-aliasing - implementation is PINNED
  DERIVED_FROM: 'DERIVED_FROM',   // obligation: the parent is established at this scope
  SUPPORTS: 'SUPPORTS',           // obligation: the parent is established at this scope
  REQUIRES: 'REQUIRES',           // obligation: conjunctive - every parent, at this scope
  GENERALIZES: 'GENERALIZES',     // obligation: carries its own authority; absorbs ONE dimension
  REFUTES: 'REFUTES',             // obligation: if the refuter is established, the target is INVALID
  // ALTERNATIVE justification, added in v2 AFTER the shadow-graph experiment localised the gap: a claim
  // may rest on several INDEPENDENT justifications and needs only one of them to survive. Conjunctive
  // supports under-admitted exactly the 65 subjects that had more than one justifying execution.
  // Obligation: AT LEAST ONE alternative must be entitled at this scope. Zero surviving alternatives is
  // a refusal, not a pass - otherwise this edge would be a universal escape hatch.
  ANY_OF: 'ANY_OF',
};

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

// HISTORY was forced by the doctest experiment. An example that runs after two others is not an
// assertion about the source alone: it is an assertion about SOURCE x EXECUTION HISTORY. Two systems
// evaluating "the same example" under different histories are evaluating DIFFERENT SUBJECTS, and must be
// refused a comparison rather than scored as disagreeing.
export const DIMENSIONS = ['repository', 'environment', 'invocation', 'implementation', 'history',
  'criterion'];

// ---------------------------------------------------------------------------------------------------
// PRODUCER #3 REPAIR — THE GATE IS NOW THE ONLY DOOR.
//
// admissibility.mjs has always held the gate deciding whether a NEW coordinate may exist, carrying the
// entire anti-overfitting argument. Producer #3 showed BY EXECUTION that it was never wired to anything:
// admitDimension answered `admitted: true` for pytest's collectionCohort and scope() dropped the
// coordinate anyway, because scope(), covers() and joinConflicts() all read a module constant. THE
// DECIDING PATH AND THE ADVISORY PATH WERE NOT THE SAME PATH.
//
// And worse than the drop, which was not predicted: two pytest verdicts for the SAME nodeid - one PASSED,
// one FAILED, differing only in which other tests were collected alongside it - produced IDENTICAL scopes
// over all six dimensions, no join conflict, and mutual coverage. THE CLOSED SET DID NOT MERELY LOSE
// INFORMATION; IT REPORTED A CONTRADICTION AS AGREEMENT.
//
// Two things follow and both are enforced below.
//
//   NOTHING VANISHES    a coordinate outside the active set is RECORDED under UNADMITTED, never dropped.
//                       Absent, unknown and unadmitted are three different states, and the producer #2
//                       lesson - a fabricated coordinate is a lie, a vanished one is a different lie -
//                       applies in this direction too.
//   NOTHING SNEAKS IN   an unadmitted coordinate may NEVER defeat a comparison. covers() and
//                       joinConflicts() do not read UNADMITTED at all, so RECORDING a difference cannot
//                       become an EXCUSE for refusing to compare. That is the invariant admissibility.mjs
//                       exists to protect and the repair must not trade one defect for it.
//
// THE MUTABLE REGISTRY IS A REAL HAZARD, named rather than hidden: module-level state makes test order
// matter. It is accepted because the alternative - threading a registry through every caller - leaves the
// DEFAULT path unwired, which is the defect being repaired. resetScopeDimensions() exists for hygiene,
// and an admission must declare its own side of the CONTEXT/SUBJECT split because law 5 turns on it.
import { admitDimension, registry, RELEVANCE, ARGUED_FROM } from './admissibility.mjs';

export const UNADMITTED = 'UNADMITTED';

const ARG = (name, side, argument) => ({ name, side, relevance: RELEVANCE.COMPARISON_ENTITLEMENT,
  argument, arguedFrom: ARGUED_FROM.DESIGN, establishedAt: 'r3 ontology, before producer #3' });

// The six, each stating the argument it has always rested on, so the gate is RUN on them rather than
// them being privileged by having been hard-coded.
const BASE_ENTRIES = [
  ARG('repository', 'CONTEXT', 'a claim established against one tree is not established against another'),
  ARG('environment', 'CONTEXT', 'interpreter and platform change what the same source does'),
  ARG('history', 'CONTEXT', 'a doctest example after two others asserts SOURCE x EXECUTION HISTORY'),
  ARG('criterion', 'CONTEXT', 'two authorities applying different criteria are not disagreeing'),
  ARG('invocation', 'SUBJECT', 'which call was made is part of what the claim is about'),
  ARG('implementation', 'SUBJECT', 'which code object ran is part of what the claim is about'),
];

let ENTRIES = [...BASE_ENTRIES];
let ACTIVE = registry(ENTRIES);

const activeDims = () => ACTIVE.discriminating();
const sideOf = (name) => (ENTRIES.find((e) => e.name === name) || {}).side;

// THE ONLY DOOR. A coordinate reaches comparison through the gate or it does not reach it at all, and a
// refusal comes back WITH ITS REASON rather than as silence.
export function admitScopeDimension(entry) {
  if (!entry || !entry.side || !['CONTEXT', 'SUBJECT'].includes(entry.side)) {
    return { admitted: false, name: entry && entry.name,
      why: 'a scope dimension must declare its SIDE - CONTEXT (the world a claim was established in) or'
        + ' SUBJECT (what the claim is about). Law 5 turns on that split and it may not be defaulted.' };
  }
  const r = admitDimension(entry);
  if (!r.admitted) return r;                        // refused, with a reason; nothing changes
  if (activeDims().includes(entry.name)) return { ...r, alreadyActive: true };
  ENTRIES = [...ENTRIES, entry];
  ACTIVE = registry(ENTRIES);
  return r;
}

export const scopeDimensions = () => [...activeDims()];
export function resetScopeDimensions() { ENTRIES = [...BASE_ENTRIES]; ACTIVE = registry(ENTRIES); }

// LAW 5 — COMPOSITIONAL ENTITLEMENT.
//
//     INDIVIDUALLY JUSTIFIED CLAIMS MAY COMPOSE ONLY OVER A COMPATIBLE CONTEXT, OR THROUGH AN
//     AUTHORIZED BRIDGE.
//
// The hole this closes was real in this file: each premise was checked against the QUERY's scope and
// never against the OTHER PREMISES. With any dimension left unpinned by the consumer, two premises
// established in different worlds both passed and the conclusion was entitled. Nothing was destroyed, no
// referent moved and nobody self-ratified - THE AUTHORITY APPEARED BETWEEN THE EDGES.
//
//     day 3   A -> B verified at S100
//     day 17  B -> C verified at S900
//     day 41  C -> D verified at S3100
//     the graph now shows A -> D, which was never true in any single world.
//
// THE DISTINCTION THAT MAKES THIS WORKABLE: premises may legitimately differ in WHAT THEY ARE ABOUT, but
// not in THE WORLD THEY WERE ESTABLISHED IN. "utils.foo is in the region because specifiers.bar reaches
// it" is a perfectly good join between claims about different subjects. Joining a claim from S100 with a
// claim from S900 is not.
export const CONTEXT_DIMENSIONS = ['repository', 'environment', 'history', 'criterion'];
export const SUBJECT_DIMENSIONS = ['invocation', 'implementation'];

// The ACTIVE split, which is the base six plus whatever the gate has admitted. The two constants above
// stay exported unchanged so existing readers are unaffected.
const contextDims = () => activeDims().filter((d) => sideOf(d) === 'CONTEXT');

// Concrete-and-different on a CONTEXT dimension blocks a join. A dimension either side leaves open is not
// a conflict - it is simply unestablished, and that is handled by covers().
//
// UNADMITTED IS NOT READ HERE, deliberately. A difference the gate has not admitted is recorded and
// IGNORED; letting it block a join is how an accidental difference becomes an excuse, which is the exact
// failure admissibility.mjs was written to prevent.
export function joinConflicts(a, b) {
  const out = [];
  for (const d of contextDims()) {
    const x = a[d]; const y = b[d];
    if (x === null || x === undefined || y === null || y === undefined) continue;
    if (x === ANY || y === ANY) continue;
    if (x !== y) out.push({ dimension: d, a: String(x), b: String(y) });
  }
  return out;
}

// A coordinate outside the active set is RECORDED, never dropped. The key appears only when there is
// something to record, so a scope built from declared coordinates alone is byte-identical to before.
// An already-carried UNADMITTED block is MERGED rather than discarded - the first version of this repair
// filtered the key out and quietly threw the carried coordinates away, which is the same defect wearing a
// third face. Flattening also gives PROMOTION for free: when the gate later admits a coordinate, a scope
// that has been carrying it unadmitted starts reading it as a discriminating dimension, with no
// re-observation and no rewriting of the stored record.
export function scope(partial = {}) {
  const active = activeDims();
  const carried = (partial[UNADMITTED] && typeof partial[UNADMITTED] === 'object')
    ? partial[UNADMITTED] : {};
  const flat = { ...carried, ...partial };
  delete flat[UNADMITTED];
  const s = {};
  for (const d of active) s[d] = Object.hasOwn(flat, d) ? flat[d] : null;
  const extras = Object.keys(flat).filter((k) => !active.includes(k));
  if (extras.length) s[UNADMITTED] = Object.fromEntries(extras.map((k) => [k, flat[k]]));
  return s;
}

// Is `granted` broad enough to license `required`? null means "not established over this dimension at
// all", which licenses nothing. ANY licenses anything. Otherwise the values must match exactly.
//
// UNADMITTED is not read here either, and for the same reason.
export function covers(granted, required) {
  const missing = [];
  for (const d of activeDims()) {
    const g = granted[d]; const r = required[d];
    if (r === null || r === undefined) continue;          // the consumer does not care about this axis
    if (g === ANY) continue;
    if (g === null || g === undefined) { missing.push(d + ': never established'); continue; }
    if (g !== r) missing.push(d + ': established over ' + String(g) + ', asked for ' + String(r));
  }
  return { ok: missing.length === 0, missing };
}

// A support may be given as a bare id (meaning SUPPORTS) or as {id, edge}. Normalised once, here, so no
// consumer has to know both shapes.
const normalize = (supports) => supports.map((s) =>
  (typeof s === 'string' ? { id: s, edge: EDGE.SUPPORTS } : { id: s.id, edge: s.edge || EDGE.SUPPORTS }));

export function node({ kind, proposition, scope: sc, basis, supports = [], evidence = [] }) {
  const norm = normalize(supports);
  const id = sha([kind, proposition, JSON.stringify(norm.map((n) => n.id + ':' + n.edge))].join('|'));
  return { id, kind, proposition, scope: sc || scope(), basis, supports: norm, evidence,
    validity: VALIDITY.ESTABLISHED };
}

export const graph = () => ({ nodes: {}, dependents: {}, refuters: {} });

export function add(g, n) {
  g.nodes[n.id] = n;
  for (const s of n.supports) {
    if (s.edge === EDGE.REFUTES) {
      (g.refuters[s.id] = g.refuters[s.id] || []).push(n.id);
    } else {
      (g.dependents[s.id] = g.dependents[s.id] || []).push(n.id);
    }
  }
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
    // A node whose ANY_OF alternatives include one that is STILL ESTABLISHED has not lost its
    // justification, so invalidation does not reach it. Propagation follows justification, not proximity.
    const alts = c.supports.filter((sp) => sp.edge === EDGE.ANY_OF);
    if (alts.length && alts.some((sp) => (g.nodes[sp.id] || {}).validity === VALIDITY.ESTABLISHED)) {
      continue;
    }
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
  // `inProgress` carries the nodes on the CURRENT path. A claim reached again while it is still being
  // evaluated is justifying itself through a cycle, and CIRCULAR JUSTIFICATION IS NOT JUSTIFICATION -
  // that branch fails rather than succeeding by assumption.
  const path = [];
  const walk = (cur, need, inProgress) => {
    const n = g.nodes[cur];
    if (!n) return [{ id: cur, why: 'justification refers to a node that does not exist' }];
    if (inProgress.has(cur)) return [{ id: cur, why: 'CIRCULAR JUSTIFICATION at "' + n.proposition + '"' }];
    path.push(n.proposition);
    const problems = [];
    if (n.validity !== VALIDITY.ESTABLISHED) {
      problems.push({ id: cur, why: n.proposition + ' is ' + n.validity + ': ' + (n.why || '') });
    }
    const c = covers(n.scope, need);
    if (!c.ok) {
      problems.push({ id: cur, why: 'SCOPE INFLATION at "' + n.proposition + '" - ' + c.missing.join('; ') });
    }
    for (const r of (g.refuters[cur] || [])) {
      const rn = g.nodes[r];
      if (rn && rn.validity === VALIDITY.ESTABLISHED) {
        problems.push({ id: cur, why: 'REFUTED by "' + rn.proposition + '"' });
      }
    }
    const next = new Set(inProgress); next.add(cur);
    // LAW 5. Conjunctive premises must have been established in a COMPATIBLE WORLD - checked against each
    // other and against this node, never merely against what the consumer happened to ask for.
    const conj = n.supports.filter((sp) => sp.edge !== EDGE.REFUTES && sp.edge !== EDGE.ANY_OF
      && sp.edge !== EDGE.GENERALIZES);
    for (let i = 0; i < conj.length; i++) {
      const pi = g.nodes[conj[i].id];
      if (!pi) continue;
      for (let j = i + 1; j < conj.length; j++) {
        const pj = g.nodes[conj[j].id];
        if (!pj) continue;
        for (const cf of joinConflicts(pi.scope, pj.scope)) {
          if ((n.joinBridges || {})[cf.dimension]) continue;
          problems.push({ id: cur, why: 'INVALID JOIN at "' + n.proposition + '": premises differ in '
            + cf.dimension + ' (' + cf.a + ' vs ' + cf.b + ') and no bridge was established. Each premise'
            + ' may be valid and the composite still never true in any single world.' });
        }
      }
      for (const cf of joinConflicts(pi.scope, n.scope)) {
        if ((n.joinBridges || {})[cf.dimension]) continue;
        problems.push({ id: cur, why: 'INVALID DERIVATION at "' + n.proposition + '": the conclusion is'
          + ' stated for ' + cf.dimension + ' ' + cf.b + ' from a premise established at ' + cf.a });
      }
    }
    const alternatives = [];
    for (const sp of n.supports) {
      if (sp.edge === EDGE.REFUTES) continue;
      if (sp.edge === EDGE.IDENTIFIES && (n.scope.implementation === null
        || n.scope.implementation === undefined)) {
        problems.push({ id: cur, why: 'IDENTIFIES edge from "' + n.proposition
          + '" without a pinned implementation: that is a name, not an identity' });
      }
      const sub = (sp.edge === EDGE.GENERALIZES && n.generalizedDimension)
        ? { ...need, [n.generalizedDimension]: null }
        : need;
      if (sp.edge === EDGE.ANY_OF) { alternatives.push({ sp, sub }); continue; }
      problems.push(...walk(sp.id, sub, next));
    }
    if (alternatives.length) {
      const attempts = alternatives.map((a) => walk(a.sp.id, a.sub, next));
      if (!attempts.some((p) => p.length === 0)) {
        problems.push({ id: cur, why: 'no surviving alternative justification for "' + n.proposition
          + '" (' + alternatives.length + ' tried)' });
      }
    }
    return problems;
  };
  const problems = walk(id, required, new Set());
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
    basis: 'GENERALIZATION:' + via, supports: [{ id, edge: EDGE.GENERALIZES }], evidence });
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
