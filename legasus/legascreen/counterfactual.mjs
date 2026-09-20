// LEGASCREEN v3, slice 2 — LAWFUL COUNTERFACTUAL EXECUTION.
//
// Slice 1 could not screen HEAD's calculus. It perturbed by copying a token and modifying the copy,
// and the C3 repair brands a token by membership in a module-private WeakSet - so the copy was not a
// token and `derive` correctly refused it. The screen was defeated by the property it exists to
// protect.
//
//     A SECURE AUTHORITY OBJECT AND A SCREENABLE ONE HAVE CONFLICTING REQUIREMENTS, UNLESS THE
//     COUNTERFACTUAL IS GENERATED UPSTREAM OF AUTHORITY ISSUANCE.
//
// So this never fabricates an authority object. It fabricates a NEIGHBOURING VALID WORLD and lets the
// legitimate constructor mint from that:
//
//     BASELINE        facts  -> construct() -> valid token -> operation -> output
//     COUNTERFACTUAL  facts' -> construct() -> DIFFERENT valid token -> same operation -> output'
//
// THERE IS NO BACKDOOR AND THERE MUST NEVER BE ONE. This module exports no mint, no forge, no
// test-only constructor. `construct` is supplied by the caller and calls the target's own production
// API. A privileged path would weaken exactly the property being screened, and security is therefore
// part of EXPERIMENTAL VALIDITY: the screen earns its counterfactual by obtaining another token the
// way production does. The screen is not exempt from the authority laws - it is bound harder.
//
// AND NON-VACUITY LIVES HERE, NOT IN THE PROBES. Slice 1 shipped three defects of exactly this class:
// a refused input read as a dependency, two opposite findings sharing one label, and "could not
// measure" sharing `undefined` with "was removed". The engine now PROVES the intended intervention
// happened and PROVES the operation ran, and a probe cannot score without both.

// TAGGED OUTCOMES. Every stage failure is its own state carrying its own reason. Nothing epistemic is
// carried by null, undefined, or an empty value anywhere in this control flow.
export const OUTCOME = {
  OBSERVED: 'OBSERVED',                             // and ONLY this may be scored
  NO_BASELINE: 'NO_BASELINE',                       // the legitimate call never ran
  BASELINE_UNSTABLE: 'BASELINE_UNSTABLE',           // replay did not reproduce the baseline
  COORDINATE_ABSENT: 'COORDINATE_ABSENT',           // the fact to intervene on is not there
  NO_CHANGE: 'NO_CHANGE',                           // the intervention changed nothing: VACUOUS
  RECONSTRUCTION_FAILED: 'RECONSTRUCTION_FAILED',   // the constructor refused the mutated facts
  AUTHORITY_REFUSED: 'AUTHORITY_REFUSED',           // the operation rejected a legitimately built input
  OUTPUT_UNOBSERVABLE: 'OUTPUT_UNOBSERVABLE',       // the operation ran and produced no authority map
};

export const SCORES = new Set([OUTCOME.OBSERVED]);

export const AGGREGATION = { ALL_OF: 'ALL_OF', ANY_OF: 'ANY_OF', UNSUPPORTED: 'UNSUPPORTED',
  UNKNOWN: 'UNKNOWN' };

const MAPS = ['context', 'scope', 'identity'];
const hasMap = (o) => !!(o && typeof o === 'object' && MAPS.some((k) => o[k] && typeof o[k] === 'object'));
const readOut = (o) => {
  const flat = {};
  if (!o || typeof o !== 'object') return flat;
  for (const k of MAPS) {
    if (o[k] && typeof o[k] === 'object') {
      for (const [d, v] of Object.entries(o[k])) if (v !== null && v !== undefined) flat[k + '.' + d] = String(v);
    }
  }
  return flat;
};
const clone = (f) => JSON.parse(JSON.stringify(f));

// ONE lawful counterfactual: remove `key` from fact `index`, rebuild, re-run.
function intervene({ facts, index, key, construct, operate }) {
  const mutated = clone(facts);
  if (!Object.hasOwn(mutated[index], key)) {
    return { outcome: OUTCOME.COORDINATE_ABSENT,
      why: 'fact[' + index + '] has no coordinate ' + key + ', so there was nothing to intervene on' };
  }
  delete mutated[index][key];
  // THE ENGINE PROVES THE INTERVENTION HAPPENED. A probe never has to remember to.
  if (JSON.stringify(mutated) === JSON.stringify(facts)) {
    return { outcome: OUTCOME.NO_CHANGE,
      why: 'removing ' + key + ' from fact[' + index + '] changed nothing; a perturbation that does'
        + ' not perturb carries ZERO evidence about the subject' };
  }
  let inputs;
  try { inputs = construct(mutated); } catch (e) {
    return { outcome: OUTCOME.RECONSTRUCTION_FAILED,
      why: 'the PRODUCTION constructor refused the mutated facts (' + e.message + '), so no lawful'
        + ' neighbouring world exists for this intervention' };
  }
  if (!inputs) {
    return { outcome: OUTCOME.RECONSTRUCTION_FAILED,
      why: 'the production constructor produced nothing from the mutated facts' };
  }
  let out;
  try { out = operate(inputs); } catch (e) {
    return { outcome: OUTCOME.AUTHORITY_REFUSED, why: 'the operation threw: ' + e.message };
  }
  if (!hasMap(out)) {
    // The operation REFUSED a legitimately constructed input, or produced nothing to observe. Either
    // way it is not evidence of a dependency - which is precisely what slice 1 got wrong.
    return { outcome: OUTCOME.AUTHORITY_REFUSED,
      why: 'the operation returned no authority map from a LEGITIMATELY CONSTRUCTED input'
        + (out && out.why ? ': ' + String(out.why).slice(0, 90) : '') };
  }
  return { outcome: OUTCOME.OBSERVED, observed: readOut(out) };
}

// A counterfactual witness over one transformation.
//
//   facts      pre-authority source data, plain and cloneable
//   construct  (facts) => inputs, using the target's OWN production constructors
//   operate    (inputs) => output
//   declared   { 'context.repository': { value: ALL_OF, authority: '<where the requirement comes from>' } }
export function counterfactual({ name, facts, construct, operate, declared = {} }) {
  const stages = Object.fromEntries(Object.values(OUTCOME).map((o) => [o, 0]));

  // ---- OPPORTUNITY
  let baseline;
  try { baseline = operate(construct(clone(facts))); } catch (e) {
    return { name, outcome: OUTCOME.NO_BASELINE, aggregation: {}, stages,
      why: 'the legitimate baseline could not be witnessed: ' + e.message };
  }
  if (!hasMap(baseline)) {
    return { name, outcome: OUTCOME.NO_BASELINE, aggregation: {}, stages,
      why: 'the baseline call produced no authority map, so there is nothing to hold constant' };
  }
  const base = readOut(baseline);

  // ---- REPLAY. A CONSTRUCTION PATH THAT CANNOT REPRODUCE ITSELF CANNOT SUPPORT A COUNTERFACTUAL.
  let replay;
  try { replay = readOut(operate(construct(clone(facts)))); } catch (e) { replay = null; }
  if (!replay || JSON.stringify(replay) !== JSON.stringify(base)) {
    return { name, outcome: OUTCOME.BASELINE_UNSTABLE, aggregation: {}, stages, baseline: base,
      why: 'rebuilding from the same facts did not reproduce the baseline observation, so no'
        + ' difference measured against it could be attributed to an intervention' };
  }

  // ---- INTERVENTION over every (fact, coordinate)
  const supporters = new Map(Object.keys(base).map((k) => [k, new Set()]));
  const edges = [];
  for (let i = 0; i < facts.length; i++) {
    for (const key of Object.keys(facts[i])) {
      const r = intervene({ facts, index: i, key, construct, operate });
      stages[r.outcome]++;
      if (r.outcome !== OUTCOME.OBSERVED) continue;
      for (const [outKey, was] of Object.entries(base)) {
        if (r.observed[outKey] !== was) {
          edges.push({ from: 'fact[' + i + '].' + key, to: outKey,
            effect: r.observed[outKey] === undefined ? 'REMOVED' : 'CHANGED' });
          supporters.get(outKey).add(i);
        }
      }
    }
  }

  // ---- OBSERVED AGGREGATION. "No single fact affects it" is ambiguous, so the all-facts run
  // separates the two opposite readings rather than guessing between them (slice 1, defect 2).
// STRIPPING "THE SAME-NAMED FACT" WOULD BE THE NAME ASSUMPTION AGAIN. An output coordinate is often
// derived from differently-named facts - that is the whole reason slice 1 built lineage - so asking
// "does this come from the facts AT ALL" means emptying the facts, not deleting a key that happens to
// share the output's name. Caught by CF-5, where the output `context.fixed` is a constant and the
// facts are named `a`: the same-name strip was vacuous and reported UNKNOWN where the answer is
// UNSUPPORTED.
  const stripAll = () => {
    const mutated = facts.map(() => ({}));
    if (JSON.stringify(mutated) === JSON.stringify(facts)) return { measured: false };
    try {
      const o = operate(construct(mutated));
      if (!hasMap(o)) return { measured: false };
      return { measured: true, out: readOut(o) };
    } catch (e) { return { measured: false }; }
  };
  const emptied = stripAll();

  const aggregation = {};
  for (const [outKey, was] of Object.entries(base)) {
    const sup = [...supporters.get(outKey)];
    if (facts.length < 2) { aggregation[outKey] = AGGREGATION.UNKNOWN; continue; }
    if (sup.length === facts.length) { aggregation[outKey] = AGGREGATION.ALL_OF; continue; }
    if (sup.length) { aggregation[outKey] = AGGREGATION.ANY_OF; continue; }
    if (!emptied.measured) { aggregation[outKey] = AGGREGATION.UNKNOWN; continue; }
    aggregation[outKey] = emptied.out[outKey] === was ? AGGREGATION.UNSUPPORTED : AGGREGATION.ANY_OF;
  }

  return { name, outcome: OUTCOME.OBSERVED, baseline: base, edges, aggregation, stages, declared,
    why: 'counterfactuals were minted by the target\'s own constructors from mutated FACTS; no'
      + ' authority object was fabricated or modified' };
}

// A DECLARATION WITHOUT AN AUTHORITY IS NOT COMPARABLE. Minimal anti-self-ratification at the
// contract layer: if nobody says where a requirement came from, an implementation that disagrees with
// it is not thereby wrong - and an implementation and a criterion that move together must not be
// able to pass silently. Pinning the declaration to a STATE is not built, and is recorded as such.
export function mismatches(cf) {
  const out = [];
  if (cf.outcome !== OUTCOME.OBSERVED) return out;
  for (const [outKey, observed] of Object.entries(cf.aggregation || {})) {
    const d = (cf.declared || {})[outKey];
    if (!d) continue;
    if (!d.authority) {
      out.push({ subject: cf.name, coordinate: outKey, verdict: 'UNCOMPARABLE',
        why: 'a declared aggregation with no stated AUTHORITY cannot convict an implementation:'
          + ' criterion and implementation could have been changed together' });
      continue;
    }
    if (observed === AGGREGATION.UNKNOWN || observed === AGGREGATION.UNSUPPORTED) continue;
    if (observed !== d.value) {
      out.push({ subject: cf.name, coordinate: outKey, verdict: 'MISMATCH',
        declared: d.value, authority: d.authority, observed,
        why: cf.name + ' declares ' + d.value + ' for ' + outKey + ' on the authority of "'
          + d.authority + '", and is OBSERVED to be ' + observed + '.' });
    }
  }
  return out;
}
