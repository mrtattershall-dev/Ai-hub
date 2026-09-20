// LEGASCREEN v3, slice 1 — SEMANTIC LINEAGE, discovered counterfactually.
//
// v2 compared FIELD NAMES. It perturbed an output dimension by stripping an input key of the same
// name, which works only when the names coincide, and reports UNSCREENED when they do not -
// `scope.criterion` is derived from `identity.producer`, so v2 could say nothing about it. Worse, the
// first version of that probe REPORTED A POSITIVE for exactly that case, because a no-op perturbation
// "failed" the invariant.
//
// The names are not the thing. THE DEPENDENCY IS. So this discovers support from execution:
//
//     F(I) = O                        a WITNESSED call, per legaexercise's rule since r2
//     remove ONE input coordinate     I with I[k] absent
//     re-run and diff the output      which output coordinates moved?
//
// and the matrix that falls out is the support structure, built with no knowledge of any name.
//
// AGGREGATION IS OBSERVABLE BY THE SAME MEANS, which is the part that matters. Remove one of several
// inputs: if an output dimension SURVIVES, the operation behaves disjunctively for it; if it
// DISAPPEARS, conjunctively. So "is this a conjunction?" stops being a fact a human writes down - and
// C2 becomes a MISMATCH BETWEEN OBSERVED AND DECLARED AGGREGATION rather than something a probe had
// to be told to look for.
//
// FOUR STATES, FIRST-CLASS. v2's vacuity check was an assertion inside one function, which is how it
// shipped the defect it later caught. Every case now resolves to one of these, and only the last
// carries evidence about the subject:
//
//     NO_OPPORTUNITY         the legitimate call did not succeed. Nothing is screened.
//     VACUOUS_PERTURBATION   the mutation changed nothing. ZERO EVIDENCE, never a positive.
//     NO_OBSERVATION         the perturbed call could not be observed.
//     OBSERVED               the invariant was actually evaluated.
export const CASE = {
  NO_OPPORTUNITY: 'NO_OPPORTUNITY',
  VACUOUS_PERTURBATION: 'VACUOUS_PERTURBATION',
  NO_OBSERVATION: 'NO_OBSERVATION',
  OBSERVED: 'OBSERVED',
};

export const AGGREGATION = {
  ALL_OF: 'ALL_OF',       // removing any one supporting input removes the output coordinate
  ANY_OF: 'ANY_OF',       // the output survives the loss of at least one supporting input
  UNSUPPORTED: 'UNSUPPORTED',   // no input removal affects it - it came from somewhere else
  UNKNOWN: 'UNKNOWN',     // too few observations to say
};

// A coordinate address inside one input: which input, and which key of its authority map.
const coords = (obj, mapKeys) => {
  const out = [];
  for (const k of mapKeys) {
    if (obj && obj[k] && typeof obj[k] === 'object') {
      for (const d of Object.keys(obj[k])) out.push({ map: k, key: d });
    }
  }
  return out;
};

const without = (obj, c) => {
  const next = { ...obj, [c.map]: { ...obj[c.map] } };
  delete next[c.map][c.key];
  return next;
};

// Does this object carry an authority map at all? A result with none - `{minted: false, why}` - was
// REFUSED rather than computed, and that is not an observation of anything.
const hasMap = (o, mapKeys) => !!(o && typeof o === 'object'
  && mapKeys.some((k) => o[k] && typeof o[k] === 'object'));

const readOut = (o, mapKeys) => {
  const flat = {};
  if (!o || typeof o !== 'object') return flat;
  for (const k of mapKeys) {
    if (o[k] && typeof o[k] === 'object') {
      for (const [d, v] of Object.entries(o[k])) {
        if (v !== null && v !== undefined) flat[k + '.' + d] = String(v);
      }
    }
  }
  return flat;
};

// Discover what supports what, for ONE transformation.
//
//   inputs   the authority-bearing arguments of a legitimate call
//   call     (inputs) => output
//   mapKeys  where authority lives on these objects; both names are used in this repository
export function lineage({ name, inputs, call, mapKeys = ['context', 'scope', 'identity'] }) {
  let witness;
  try { witness = call(inputs); } catch (e) {
    return { name, state: CASE.NO_OPPORTUNITY, edges: [], aggregation: {},
      why: 'the legitimate call threw (' + e.message + '); no witnessed execution, nothing screened' };
  }
  const baseline = readOut(witness, mapKeys);
  if (!Object.keys(baseline).length) {
    return { name, state: CASE.NO_OPPORTUNITY, edges: [], aggregation: {},
      why: 'the call succeeded and established no output coordinate, so every perturbation below'
        + ' would be vacuous' };
  }

  const edges = [];
  const cases = { [CASE.VACUOUS_PERTURBATION]: 0, [CASE.NO_OBSERVATION]: 0, [CASE.OBSERVED]: 0 };
  // outKey -> which input indices, when removed alone, changed it
  const affectedBy = new Map(Object.keys(baseline).map((k) => [k, new Set()]));
  const supportingInputs = new Map(Object.keys(baseline).map((k) => [k, new Set()]));

  for (let i = 0; i < inputs.length; i++) {
    for (const c of coords(inputs[i], mapKeys)) {
      const mutated = inputs.map((x, j) => (j === i ? without(x, c) : x));
      // PERTURBATION VALIDITY, checked centrally rather than per probe.
      if (JSON.stringify(mutated[i]) === JSON.stringify(inputs[i])) {
        cases[CASE.VACUOUS_PERTURBATION]++;
        continue;
      }
      let after;
      try { after = call(mutated); } catch (e) { cases[CASE.NO_OBSERVATION]++; continue; }
      // A REFUSED INPUT IS NOT A DEPENDENCY. If the perturbed call comes back with no authority map
      // at all - `{minted: false, why}` - the operation REJECTED the mutated input rather than
      // processing it. The first version of this file read that as "every output coordinate depends
      // on every input coordinate", which is how it reported a confident ALL_OF for calculus.derive
      // at HEAD where nothing had been observed at all. The cause is the C3 repair: a token is
      // branded by WeakSet membership, so the spread copy this perturbation builds IS NOT AN
      // AUTHORITY TOKEN and derive correctly refuses it. THE ARCHITECTURE'S OWN UNFORGEABILITY
      // DEFEATS PERTURBATION FROM OUTSIDE, and the honest report is NO_OBSERVATION.
      if (!hasMap(after, mapKeys)) { cases[CASE.NO_OBSERVATION]++; continue; }
      const now = readOut(after, mapKeys);
      cases[CASE.OBSERVED]++;
      for (const [outKey, wasValue] of Object.entries(baseline)) {
        if (now[outKey] !== wasValue) {
          edges.push({ from: 'input[' + i + '].' + c.map + '.' + c.key, to: outKey,
            effect: now[outKey] === undefined ? 'REMOVED' : 'CHANGED' });
          affectedBy.get(outKey).add(i);
          supportingInputs.get(outKey).add(i);
        }
      }
    }
  }

  // "NO SINGLE INPUT AFFECTS IT" IS AMBIGUOUS, and the first version resolved it the wrong way. It
  // means EITHER the coordinate came from outside the inputs (UNSUPPORTED) OR it survived the loss of
  // every single one (ANY_OF, which for a declared conjunction is the defect). Those are opposite
  // findings and only the all-inputs-stripped run separates them - so it is run, rather than guessed.
// AND THE RESULT MUST SAY WHETHER IT WAS MEASURED, SEPARATELY FROM WHAT IT MEASURED. The first
// version returned a bare value, so "I could not observe this" and "the coordinate was REMOVED" were
// both `undefined` - opposite facts sharing one representation, which is this project's oldest defect
// class reproduced inside the layer built to find it. It reported UNKNOWN for calculus.derive at
// b11e51f, where the honest answer was the defect.
  const strippedAll = (dimKey) => {
    const [mapName, key] = [dimKey.slice(0, dimKey.indexOf('.')), dimKey.slice(dimKey.indexOf('.') + 1)];
    const mutated = inputs.map((x) => (x && x[mapName] ? without(x, { map: mapName, key }) : x));
    if (JSON.stringify(mutated) === JSON.stringify(inputs)) return { measured: false, why: 'vacuous' };
    try {
      const o = call(mutated);
      if (!hasMap(o, mapKeys)) return { measured: false, why: 'refused' };
      return { measured: true, value: readOut(o, mapKeys)[dimKey] };
    } catch (e) { return { measured: false, why: 'threw' }; }
  };

  const aggregation = {};
  for (const [outKey, wasValue] of Object.entries(baseline)) {
    const supporters = [...supportingInputs.get(outKey)];
    if (inputs.length < 2) { aggregation[outKey] = AGGREGATION.UNKNOWN; continue; }
    if (supporters.length === inputs.length) { aggregation[outKey] = AGGREGATION.ALL_OF; continue; }
    if (supporters.length) { aggregation[outKey] = AGGREGATION.ANY_OF; continue; }
    const all = strippedAll(outKey);
    if (!all.measured) { aggregation[outKey] = AGGREGATION.UNKNOWN; continue; }
    // It survived every SINGLE removal. If stripping it from ALL inputs finally moves it, the inputs
    // DO support it and the operation is behaving disjunctively. If not, it came from elsewhere.
    aggregation[outKey] = all.value === wasValue ? AGGREGATION.UNSUPPORTED : AGGREGATION.ANY_OF;
  }

  return { name, state: CASE.OBSERVED, edges, aggregation, baseline, cases,
    why: 'support discovered by counterfactual perturbation of witnessed inputs; names played no part' };
}

// THE INVARIANT THIS LAYER MAKES POSSIBLE. An operation that DECLARES conjunction must be OBSERVED to
// conjoin. The declaration is still a human sentence - what has changed is that the observation is
// mechanical, and the mismatch is what gets reported.
export function aggregationMismatch({ lin, declared }) {
  const out = [];
  for (const [outKey, observed] of Object.entries(lin.aggregation || {})) {
    if (!declared || !declared[outKey]) continue;
    if (observed === AGGREGATION.UNKNOWN || observed === AGGREGATION.UNSUPPORTED) continue;
    if (observed !== declared[outKey]) {
      out.push({ subject: lin.name, coordinate: outKey, declared: declared[outKey], observed,
        why: lin.name + ' declares ' + declared[outKey] + ' for ' + outKey + ' and is OBSERVED to be '
          + observed + '. An implementation that behaves disjunctively where its contract says'
          + ' conjunction takes a coordinate not all of its inputs established.' });
    }
  }
  return out;
}
