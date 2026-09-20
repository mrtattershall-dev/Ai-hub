// DIMENSION ADMISSIBILITY — the anti-overfitting protection for the ontology itself.
//
//     EXPLANATORY POWER DOES NOT GRANT DISCRIMINATIVE AUTHORITY.
//
// Every distinction added to this architecture - provenance, history, repository state, criterion,
// subject/context - increases its power to classify discrepancies. That is good, and it creates a
// scientific hazard that is lethal if ignored:
//
//     GIVEN ENOUGH DIMENSIONS, ALMOST ANY DISAGREEMENT CAN BE REDESCRIBED AS INCOMPARABLE.
//
//     disagreement -> invent dimension D -> the systems differ on D -> NOT_COMPARABLE
//
// That would make the entitlement algebra unfalsifiable, which is worse than wrong. So:
//
//     A DISTINCTION MAY DEFEAT COMPARISON ONLY IF ITS RELEVANCE TO THE CLAIM TYPE WAS ESTABLISHED
//     INDEPENDENTLY OF THE DISAGREEMENT IT EXPLAINS.
//
// This is preregistration applied to the ontology. `history` earned its place that way: its relevance was
// argued from what a doctest example IS, then frozen as H1/H2 before the residual was scored. A dimension
// admitted because it happened to reconcile something has not earned anything.
//
// THE OPERATIONAL CONSEQUENCE, and it is the whole point: an UNADMITTED coordinate present in a referent
// is IGNORED. Two claims differing only in hostname, temporary filename, wall-clock nanosecond or JSON
// field ordering must still be compared. External data contains thousands of accidental differences and
// every one of them is a potential excuse.

export const RELEVANCE = {
  // Varying it changes what the proposition MEANS or whether it is true.
  TRUTH_CONDITIONS: 'TRUTH_CONDITIONS',
  // Varying it changes whether two claims are about the same thing.
  COMPARISON_ENTITLEMENT: 'COMPARISON_ENTITLEMENT',
  // It differs between runs and changes nothing that matters.
  INCIDENTAL: 'INCIDENTAL',
};

// WHERE THE RELEVANCE ARGUMENT CAME FROM. This is a TYPED field and not prose, because the first version
// of this gate pattern-matched `motivatedBy` for words like "discrepancy" - and duly refused a perfectly
// legitimate argument whose text said it was established BEFORE any discrepancy was scored. Syntactic
// similarity does not establish semantic role; that lesson has been paid for elsewhere in this project and
// it applies to the guard itself.
export const ARGUED_FROM = {
  SPECIFICATION: 'SPECIFICATION',         // from what the thing IS - how doctest defines an example
  SOURCE_INSPECTION: 'SOURCE_INSPECTION', // from reading the system, before any discrepancy was scored
  DESIGN: 'DESIGN',                       // from a design decision that predates the data
  OWNER: 'OWNER',                         // a human declared it relevant
  OBSERVED_DISCREPANCY: 'OBSERVED_DISCREPANCY',   // the forbidden route
};

const INDEPENDENT = new Set([ARGUED_FROM.SPECIFICATION, ARGUED_FROM.SOURCE_INSPECTION,
  ARGUED_FROM.DESIGN, ARGUED_FROM.OWNER]);

// A dimension may only be admitted when its relevance was argued from a source INDEPENDENT of the
// discrepancy it would explain. The provenance is declared structurally so the illegitimate route has to
// be named to be taken.
// A DIMENSION NAME IS AN IDENTIFIER, AND THE BOOKKEEPING KEY IS NOT ONE. Composition attack C5 admitted
// a dimension literally named UNADMITTED; scope() then wrote its recorded block under an active key,
// covers() compared two identical blocks by object identity, and NOT_COMPARABLE was manufactured out of
// a key that exists to carry what is NOT authoritative. The gate refuses the reserved name and anything
// that is not a plain identifier, so a bookkeeping key can never become a dimension by being named.
const RESERVED_NAMES = new Set(['UNADMITTED']);
const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function admitDimension({ name, relevance, argument, arguedFrom, motivatedBy, establishedAt }) {
  if (typeof name !== 'string' || !IDENTIFIER.test(name) || RESERVED_NAMES.has(name)) {
    return { admitted: false, name,
      why: 'REFUSED: "' + String(name) + '" is not a dimension name. A dimension is a plain identifier,'
        + ' and the reserved bookkeeping key UNADMITTED - which carries what is recorded and NOT'
        + ' authoritative - can never itself be a dimension.' };
  }
  if (!argument || !arguedFrom) {
    return { admitted: false, name,
      why: 'a dimension must state its relevance ARGUMENT and where that argument was ARGUED FROM. A'
        + ' coordinate that cannot say why it matters cannot be allowed to defeat a comparison.' };
  }
  if (relevance === RELEVANCE.INCIDENTAL) {
    return { admitted: false, name, relevance,
      why: name + ' is incidental: it varies between runs without changing truth conditions or'
        + ' comparison entitlement. It may be RECORDED, and it may never defeat a comparison.' };
  }
  if (!INDEPENDENT.has(arguedFrom)) {
    return { admitted: false, name, arguedFrom,
      why: 'REFUSED: the relevance argument is drawn from ' + arguedFrom + ', which is the very'
        + ' disagreement it would explain. Explanatory power does not grant discriminative authority.'
        + ' Establish relevance independently - and before scoring the discrepancy - or do not admit it.' };
  }
  if (!Object.values(RELEVANCE).includes(relevance)) {
    return { admitted: false, name, why: 'unknown relevance class' };
  }
  return { admitted: true, name, relevance, argument, arguedFrom,
    motivatedBy: motivatedBy ?? null, establishedAt: establishedAt ?? null };
}

// The registry consulted by comparison. Anything not in here is invisible to covers() and to joins.
export function registry(entries) {
  const admitted = new Map();
  const refused = [];
  for (const e of entries) {
    const r = admitDimension(e);
    if (r.admitted) admitted.set(r.name, r); else refused.push(r);
  }
  return {
    admitted,
    refused,
    // THE CONTROL SURFACE. A coordinate present in the data but not admitted is ignored, not honoured.
    discriminating: () => [...admitted.keys()],
    mayDefeatComparison: (name) => admitted.has(name),
    describe: (name) => admitted.get(name) || { admitted: false, name,
      why: name + ' is not an admitted dimension; differences in it are recorded and ignored' },
  };
}

// Restrict a referent to its admitted coordinates. This is what comparison should be handed, and it is
// what makes an accidental difference incapable of becoming an excuse.
export function discriminatingProjection(referent, reg) {
  const out = {};
  for (const k of reg.discriminating()) if (k in referent) out[k] = referent[k];
  return out;
}

// THE ANTI-EXPLANATION AUDIT. Given two referents that differ, how much of the difference is entitled to
// matter? A comparison defeated ENTIRELY by unadmitted coordinates is an illegitimate refusal.
export function comparisonDefeat({ a, b, reg }) {
  const differing = [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter((k) => (a[k] ?? null) !== (b[k] ?? null));
  const entitled = differing.filter((k) => reg.mayDefeatComparison(k));
  const incidental = differing.filter((k) => !reg.mayDefeatComparison(k));
  return {
    defeats: entitled.length > 0,
    entitled,
    incidental,
    why: entitled.length
      ? 'comparison is defeated by ' + entitled.join(', ') + ', whose relevance was established'
        + ' independently'
      : differing.length
        ? 'the referents differ only in ' + incidental.join(', ') + ', none of which is entitled to'
          + ' defeat a comparison. THESE CLAIMS MUST STILL BE COMPARED.'
        : 'the referents do not differ',
  };
}
