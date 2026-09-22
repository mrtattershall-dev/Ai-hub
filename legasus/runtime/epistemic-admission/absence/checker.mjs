// THE DECLARED NON-ARM (prereg A1.4). A mechanical query-adequacy check, and nothing else:
// case-insensitive re-run over the asserted scope, plus a cross-check of the query against the
// identifier set the code actually contains.
//
// It is NOT an arm. It is here so that, if it performs best, the supported conclusion is
// "this checker sufficed ON THESE CASES" - not a general verdict about epistemology, and not
// something that can later be relabelled a Legasus mechanism.
//
// It deliberately does NOT do the baseline's wrapper inspection or its RUNTIME handling. That is
// the point: it is the cheapest thing that addresses the two defects actually observed.

import { DECISION, MEANING, DENIED, grep, identifierSet, scopeContained } from './harness.mjs';

export function checkerDecide(claim, corpus, ledger, initial) {
  const asserted = claim.asserted_scope;
  const core = initial.query;

  const wide = grep(corpus, ledger, core, { ci: true, from: asserted.from, to: asserted.to });
  if (wide === DENIED) return { decision: DECISION.UNRESOLVED, why: 'budget exhausted before the wide search' };

  const ids = identifierSet(corpus, ledger, asserted.from, asserted.to);
  const risk = [];
  if (ids !== DENIED) {
    const lc = core.toLowerCase();
    for (const id of ids) {
      if (!id.toLowerCase().includes(lc)) continue;
      if (id.includes(core)) continue;
      risk.push(id);
    }
    risk.sort();
  }

  const hits = [...wide.hit_lines];
  for (const id of risk.slice(0, 3)) {
    const r = grep(corpus, ledger, id, { ci: false, from: asserted.from, to: asserted.to });
    if (r === DENIED) break;
    for (const l of r.hit_lines) if (!hits.includes(l)) hits.push(l);
  }
  hits.sort((a, b) => a - b);

  const contained = scopeContained(asserted, [{ from: wide.from, to: wide.to }]);
  if (hits.length) {
    return { decision: DECISION.REFUSE,
      why: 'counterexample: ' + hits.length + ' occurrence(s), first at line ' + hits[0]
        + (risk.length ? '; spelling variant(s) ' + risk.join(', ') : ''), risk };
  }
  if (!contained) {
    return { decision: DECISION.UNRESOLVED, why: 'searched scope does not contain the asserted scope', risk };
  }
  // The checker has no way to settle a RUNTIME claim, and says so rather than guessing.
  if (claim.meaning === MEANING.RUNTIME) {
    return { decision: DECISION.UNRESOLVED, why: 'lexical checker cannot settle a RUNTIME claim', risk };
  }
  return { decision: DECISION.ACCEPT, why: 'no occurrence; query cross-checked against the identifier set', risk };
}
